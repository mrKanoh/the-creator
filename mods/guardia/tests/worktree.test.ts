import { expect, test } from 'claude-code/testing'
import { findWorktreeRemove, joinContinuations, MSG_WORKTREE_REMOVE, MSG_WORKTREE_UNCLEAR, namesWorktreeRemove } from '../hooks/worktree.ts'

// Rule 6 (CRE-GRD-WT-1): even without --force, `git worktree remove` follows an ignored
// junction and empties its target (audit A1, reproduced with git 2.53), so every
// `git worktree remove` stops in any folder. The commands here are only strings: nothing runs.

const kindOf = (command: string) => findWorktreeRemove(command)?.kind ?? 'pass'
const expectKind = (commands: string[], kind: 'remove' | 'unclear' | 'pass') => {
  for (const c of commands) expect([c, kindOf(c)]).toEqual([c, kind])
}

// Catches: A1, the remove without --force that emptied a junction's target.
test('rule 6: git worktree remove stops with or without --force, in any spelling', () => {
  expectKind([
    'git worktree remove .claude/worktrees/x', 'git worktree remove ../wt', 'git worktree remove C:\\repos\\otro\\.claude\\worktrees\\x',
    'git worktree remove "x y"', 'git worktree remove --force x', 'git worktree remove -f x', 'git worktree remove -ff x', 'git worktree remove x --force',
    'git worktree --force remove x', 'git -C C:/repos/otro worktree remove x', 'git -C $repo worktree remove x', 'git -c a=b --no-pager worktree remove x',
    'git --git-dir=D:/r/.git worktree remove x', 'git.exe worktree remove x', '"C:\\Program Files\\Git\\cmd\\git.exe" worktree remove x', '/usr/bin/git worktree remove x',
    'git worktree re\\move x', 'git work\\tree remove x', 'git Worktree REMOVE x', 'git w^orktree remove x', 'git worktree remove\u2003x',
    'git\u00a0worktree\u00a0remove\u00a0x', 'git worktree rem\u200bove x', 'cd D:/otro && git worktree remove x', 'git status; git worktree remove x',
    'GIT_TRACE=1 git worktree remove x', 'time git worktree remove x', 'if true; then git worktree remove x; fi', 'git worktree remove x 2>&1',
    'git worktree remove $wt', 'git worktree remove "$wt"', 'git worktree remove %WT%',
  ], 'remove')
})

// Catches: A2, the forms the first parse let through. Each stops (kind unclear or remove).
test('rule 6 (A2): continuations, PowerShell blocks, assignments, substitutions and outside wrappers stop', () => {
  const stopped = [
    // Line continuations in Bash (and PowerShell's backtick), at any point.
    'git worktree \\\nremove x', 'git \\\nworktree remove x', 'git worktree re\\\nmove x', 'git work\\\ntree remove x', 'git worktree `\nremove x',
    // PowerShell blocks.
    'try { git worktree remove x } catch { }', 'try { Write-Host a } catch { git worktree remove x }', 'if ($true) {git worktree remove x}',
    'if (Test-Path x) { git worktree remove x }', 'Get-ChildItem | ForEach-Object { git worktree remove $_ }', '1 | % { git worktree remove x }',
    'Start-Job -ScriptBlock { git worktree remove x }', 'function f { git worktree remove x }; f', '& { git worktree remove x }', '. { git worktree remove x }',
    // Assignments and substitutions.
    '$r = git worktree remove x', '$r=git worktree remove x', 'r=`git worktree remove x`', 'r=$(git worktree remove x)', 'echo `git worktree remove x`',
    'echo $(git worktree remove x)', 'echo "$(git worktree remove x)"', 'git worktree $(echo remove) x', 'git $w remove x', 'w=worktree; git $w remove x',
    '$v = "remove"; git worktree $v x', 'git worktree $op x --remove', 'git worktree $v x', 'git worktree "$v" x', 'git $w remove',
    // Wrappers outside the list.
    'env -i git worktree remove x', 'command -p git worktree remove x', 'git.cmd worktree remove x', 'busybox sh -c "git worktree remove x"',
    'git-bash -c "git worktree remove x"', 'bash -c "git worktree remove x"', 'pwsh -c "git worktree remove x"', 'cmd /c git worktree remove x',
    'xargs git worktree remove', 'echo x | xargs git worktree remove', 'timeout 60 git worktree remove x', 'sudo git worktree remove x',
    'Invoke-Expression "git worktree remove x"', 'node -e "require(\'child_process\').execSync(\'git worktree remove x\')"',
    '$g worktree remove x', '& $git worktree remove x', '%g% worktree remove x', 'git --weird worktree remove x', 'git --% worktree remove x',
    // A text that is run or written down to run later.
    'echo "git worktree remove x" | bash', 'echo "git worktree remove x" | iex', 'echo "git worktree remove x" > q.sh',
    'echo "git worktree remove x" >> q.ps1', 'git commit -m "worktree remove" ; bash q.sh', 'gh pr create --body "$(git worktree remove x)"',
    'git commit -m "`git worktree remove x`"', 'rg --pre q "worktree remove"', 'git grep -Oq "worktree remove"', 'git -c core.pager=q log --grep "worktree remove"',
  ]
  for (const c of stopped) expect([c, kindOf(c) === 'pass']).toEqual([c, false])
  expect(kindOf('$r = git worktree remove x')).toBe('unclear')
  expect(kindOf('try { git worktree remove x } catch { }')).toBe('unclear')
})

// Catches: M1 (round 2), a joining that hid the next line. The joining does not know the shell
// or an escaped escape, so the unjoined reading also counts, and a backtick voids the text exemption.
test('rule 6 (M1): a remove on the next line stops even when the joining would hide it', () => {
  expectKind([
    'Write-Output C:\\repos\\x\\\ngit worktree remove x', 'echo foo\\\\\ngit worktree remove x',
    'echo `\ndate`\ngit worktree remove x', 'Write-Host "a"`\ngit worktree remove x',
  ], 'remove')
  expect(kindOf('echo "`date` worktree remove"')).toBe('unclear')
  expect(namesWorktreeRemove('Write-Output D:\\x\\\ngit worktree remove x')).toBe(true)
  expectKind(['git commit -m "linea 1\nworktree remove"', 'git commit -m "frena git worktree remove"', 'gh pr edit 64 --body "worktree remove"'], 'pass')
})

// Catches: the rest of M1 (round 3), a wrong joining mixed with a real continuation in Bash.
// A continuation in the original voids the text exemption when the joined reading names both words.
test('rule 6 (M1, round 3): a wrong joining plus a real continuation stops', () => {
  for (const c of [
    'echo foo\\\\\ngit worktree \\\nremove x', 'echo foo\\\\\ngit worktree re\\\nmove x', 'echo foo\\\\\r\ngit worktree \\\r\nremove x',
    'echo foo\\\\\ngit -C . worktree \\\n  remove --force x', 'grep -r "a\\\\" . \\\\\ngit worktree \\\nremove x', 'echo ok # nota \\\ngit worktree \\\nremove x',
  ]) expect([c, kindOf(c) === 'pass']).toEqual([c, false])
  expectKind(['git commit -m "linea 1\nworktree remove"', 'git commit -m "frena git worktree remove"', 'echo "git worktree remove x"', 'gh pr edit 64 --body "worktree remove"'], 'pass')
})

// Catches: the texts this very task writes must keep passing (commit messages, PR bodies, searches).
test('rule 6: texts that only mention git worktree remove pass', () => {
  expectKind([
    'git commit -m "guardia: regla 6 frena git worktree remove"', "git commit -m 'git worktree remove ya no pasa'",
    'git commit -F - -m "worktree remove"', 'git commit -m "worktree remove" && git push -u origin tarea/cre-grd-wt-1',
    'gh pr create --draft --base main --title "regla 6" --body "frena git worktree remove con o sin --force"',
    'gh pr edit 64 --body "git worktree remove frena"', 'gh pr comment 64 --body "worktree remove"',
    'echo "git worktree remove x"', 'echo git worktree remove x', 'printf "%s" "worktree remove"', 'Write-Host "git worktree remove"',
    'grep -n "worktree remove" mods/guardia/README.md', 'grep -rn "worktree remove" . | head -5', 'rg "worktree remove" mods', 'rg -n "git worktree remove" | wc -l',
    'git grep -n "worktree remove"', 'git log --grep "worktree remove" --oneline', 'git --no-pager log --grep="worktree remove"',
    'Select-String -Path README.md -Pattern "worktree remove"', 'echo "git worktree remove x" 2>&1', 'echo "worktree remove" > /dev/null',
  ], 'pass')
})

// Catches: the other worktree subcommands and unrelated commands keep passing.
test('rule 6: add, list, prune, lock, unlock, move, repair and other commands pass', () => {
  expectKind([
    'git worktree add .claude/worktrees/x -b tarea/x origin/main', 'git worktree add -f ../w tarea/x', 'git worktree list', 'git worktree list --porcelain',
    'git worktree prune', 'git worktree prune --dry-run', 'git worktree lock x', 'git worktree unlock x', 'git worktree move a b', 'git worktree repair',
    'git worktree list; echo listo', 'git worktree list && echo "luego remove"','git branch -D tarea/x', 'git rm -f x.txt', 'Remove-Item -Recurse x', 'rm -rf node_modules', 'npm remove x',
    'cmd /c rmdir C:\\repos\\otro\\.claude\\worktrees\\x\\node_modules', 'bash -c "git worktree list"', 'git status',
  ], 'pass')
})

// Catches: the false positives the README accepts (B2) stay as documented.
test('rule 6: the documented false positives stop', () => {
  for (const c of [
    'timeout 5 grep "worktree remove" README.md', 'xargs grep "worktree remove"', 'node -e "console.log(\'worktree remove\')"',
    'sudo apt remove worktree', 'git --help worktree remove', 'ls D:\\x\\worktree\\remove\\y',
    'git commit -m "worktree remove"; $LASTEXITCODE', 'gh pr create --body "$(cat <<\'EOF\'\nworktree remove\nEOF\n)"',
    'gh pr create --title x \\\n--body "worktree remove"', 'gh pr create --title x `\n--body "worktree remove"', 'git commit -m "usa `worktree remove`"',
    // B4 (round 2).
    "git commit -F - <<'EOF'\nguardia: worktree remove\nEOF", 'rg "worktree remove" mods | sed -n 1p', 'gh pr review 64 --body "worktree remove"',
    'gh issue create --title x --body "worktree remove"', 'git -c user.name=x commit -m "worktree remove"', 'git branch -d tarea/remove-worktree',
    'git worktree list; Remove-Item $x',
  ]) expect([c, kindOf(c) === 'pass']).toEqual([c, false])
})

// Catches: the known limits of round 2 (B1-B3) stay as the README documents them; not fixed.
test('rule 6: the documented limits pass', () => {
  expectKind(['echo \\" ; git worktree remove x \\"', "git worktree ('re'+'move') x", 'echo "git worktree remove x" | cat > q.sh'], 'pass')
})

test('rule 6: the helpers join continuations and read the words', () => {
  expect(joinContinuations('git worktree \\\nremove x')).toBe('git worktree remove x')
  expect(joinContinuations('git worktree `\r\nremove x')).toBe('git worktree remove x')
  expect(namesWorktreeRemove('git work\\\ntree remove x')).toBe(true)
  expect(namesWorktreeRemove('cmd /c rmdir .claude\\worktrees\\x\\node_modules')).toBe(false)
  expect(namesWorktreeRemove('git worktrees removed')).toBe(false)
})

// Catches: the message must say who removes worktrees and why (C3), with no advice that is wrong in Bash.
test('rule 6: the messages say who removes a worktree and why, without cmd /c rmdir', () => {
  for (const msg of [MSG_WORKTREE_REMOVE('git worktree remove x'), MSG_WORKTREE_UNCLEAR('$r = git worktree remove x')]) {
    expect(msg).toContain('Al archivar la sesión, el worktree queda en la reserva de la app; quitarlo es del responsable, no tuyo')
    expect(msg).not.toContain('lo hace la app')
    expect(msg).toContain('Aun sin `--force`')
    expect(msg).toContain('junction')
    expect(msg).toContain('`.gitignore`')
    expect(msg).toContain('node_modules')
    expect(msg).toContain('vacía su destino')
    expect(msg).toContain('landing-cliente')
    expect(msg).not.toContain('rmdir')
    expect(msg).not.toMatch(/\b(vos|podés|tenés|querés|hacés)\b/)
  }
  expect(MSG_WORKTREE_REMOVE('git worktree remove x')).toContain('git worktree remove x')
  expect(MSG_WORKTREE_UNCLEAR('$r = git worktree remove x')).toContain('no lo entiendo con certeza')
})
