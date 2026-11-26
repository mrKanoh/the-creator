import { expect, test } from 'claude-code/testing'
import { findPush, MSG_PUSH, MSG_PUSH_UNCLEAR, namesPush } from '../hooks/push.ts'

// Rule 7 (CRE-PUSH-1): a push passes only in one of the method's three clear forms, in any
// folder; texts that only mention it pass; the rest stops. The commands are only strings.

const kindOf = (command: string) => findPush(command)?.kind ?? 'pass'
const expectKind = (commands: string[], kind: 'push' | 'unclear' | 'pass') => {
  for (const c of commands) expect([c, kindOf(c)]).toEqual([c, kind])
}

test('rule 7: the three clear forms pass, alone or after other commands, with an optional 2>&1', () => {
  expectKind([
    'git push -u origin tarea/x', 'git push origin tarea/x', 'git push origin --delete tarea/x',
    'git push -u origin tarea/fix-x', 'git push -u origin tarea/cre-push-1', 'git push origin --delete tarea/cre-push-1',
    'git push -u origin tarea/a1-b2', 'git push -u origin tarea/x 2>&1', 'git push origin tarea/x 2>&1', 'git push origin --delete tarea/x 2>&1',
    'cd C:/repos/otro && git push -u origin tarea/x', 'git add a.md && git commit -m "etapa 1: x" && git push -u origin tarea/x',
    'git push -u origin tarea/x; $LASTEXITCODE', 'git push -u origin tarea/x\ngh pr create --draft --fill', '(git push origin tarea/x)',
  ], 'pass')
})

// Catches the orchestrator's adjustment 1: `push` counts only as a whole word, not inside a branch name.
test('rule 7: push inside another word does not count; commands that do not push pass', () => {
  expectKind([
    'git branch -d tarea/cre-push-1', 'git switch tarea/fix-push', 'git branch -d tarea/push', 'git switch -c tarea/push-x',
    'git status --short --branch', 'git log --oneline -1', 'npm run push', 'npm run pushx', 'git pull --ff-only', 'pushd D:/x',
    'git fetch origin', 'git -C D:/x status', 'git -C D:/x/push-y log -1',
  ], 'pass')
})

// Texts that only mention a push, with the same closed list as rule 6; `-C` and `-c` before a commit (B6).
test('rule 7: texts that only mention a push pass, also git commit and log with -C and commit with -c', () => {
  expectKind([
    'git commit -m "git push origin main"', 'git commit -m "nota sobre push"', 'git -C C:/repos/x commit -m "nota sobre push"',
    'git -C . commit -m "git push -u origin tarea/x -uf"', 'git -C . log --grep push', 'git -C D:/x log --grep "git push"',
    'git -c core.quotepath=false commit -m "nota sobre push"', 'git -c user.name=x commit -m "git push origin main"',
    'git log --grep push', 'git grep -n "git push origin"', 'echo "git push origin main"', 'printf "push\\n"',
    'grep -n "git push" README.md', 'rg "push origin" skills', 'Select-String -Pattern "git push" README.md',
    'gh pr create --draft --title x --body "usa git push -u origin tarea/x"', 'gh pr comment 3 --body "git push origin main"',
    'git commit -m "push" && git push -u origin tarea/x', 'cat notas.md | grep "git push"',
  ], 'pass')
})

// Catches: a project's report and the audit of stage 1 (M3, A1).
test('rule 7: the reported holes stop as a push outside the clear form', () => {
  expectKind([
    // Report: no branch, global options, grouped short flags.
    'git push origin', 'git push -u origin', 'git -C . push -u origin tarea/x', 'git -c x=y push -u origin tarea/x',
    'git push origin tarea/x -uf', 'git push origin tarea/x -fu', 'git push -uf origin tarea/x', 'git push -fu origin tarea/x',
    // A1: a second argument with a wildcard is a refspec pattern that pushes main.
    'git push origin tarea/x ref*', 'git push origin tarea/x r*',
    // M3: spellings the permission globs do not cover.
    'git push origin -u', 'git push -u', 'git push --set-upstream origin', 'git push -q origin', 'git --git-dir=.git push origin',
    'git --no-pager -C . push origin', 'git  push origin',
  ], 'push')
})

test('rule 7: other branches, flags, refspecs, redirections, pipes and spellings stop', () => {
  expectKind([
    'git push', 'git push origin main', 'git push origin master', 'git push origin HEAD', 'git push origin tarea/domain-fix',
    'git push origin tarea/x-head', 'git push origin tarea/x:main', 'git push origin tarea/x:tarea/x', 'git push origin +tarea/x',
    'git push origin tarea/x --force', 'git push --force-with-lease origin tarea/x', 'git push -f origin tarea/x', 'git push origin tarea/X',
    'git push origin tarea/x/y', 'git push origin tarea/x_y', 'git push origin feature/x', 'git push upstream tarea/x',
    'git push -u origin tarea/x tarea/y', 'git push --all origin', 'git push --mirror origin', 'git push --tags origin', 'git push origin --delete main',
    'git push -u origin tarea/x --dry-run', 'git push origin -u tarea/x', 'git push --delete origin tarea/x',
    // Adjustment 2: only ` 2>&1`, exact, at the end.
    'git push -u origin tarea/x 2>&1 | tail -3', 'git push -u origin tarea/x > out.txt', 'git push -u origin tarea/x 2>/dev/null',
    'git push -u origin tarea/x 2> err.txt', 'git push -u origin tarea/x  2>&1', 'git push -u origin tarea/x 2>&1 2>&1', 'git push -u origin tarea/x >&2',
    'echo y | git push -u origin tarea/x', 'git push -u origin tarea/x | cat',
    // Wrappers git reads, assignments, other spellings.
    'GIT_SSH_COMMAND=x git push -u origin tarea/x', 'env git push -u origin tarea/x', 'time git push -u origin tarea/x',
    'git.exe push -u origin tarea/x', 'GIT push origin main', 'git PUSH origin main', 'git pu\\sh origin main', 'git pu\u200bsh origin main',
    'git push\u00a0origin tarea/x', 'git "push" origin main', "git 'push' -u origin tarea/x", 'if true; then git push -u origin tarea/x; fi',
    '{ git push -u origin tarea/x; }', 'git push>out origin main', 'git --exec-path=x push origin tarea/x', 'git --work-tree . push origin tarea/x',
    // An unquoted substitution splits the segment: the push inside is read as its own command.
    'echo $(git push origin main)', 'r=$(git push origin main)',
    // Continuations: joined and unjoined readings both count.
    'git push -u origin tarea/x \\\n--force', 'git \\\npush origin main', 'git push `\n origin main',
  ], 'push')
})

test('rule 7: wrappers, interpreters, variables, aliases and texts that run stop as unclear', () => {
  expectKind([
    'bash -c "git push origin main"', 'sh -c "git push -u origin tarea/x"', 'pwsh -c "git push origin main"', 'cmd /c git push origin main',
    'xargs git push', 'echo origin | xargs git push', 'sudo git push -u origin tarea/x', 'nohup git push origin main', 'timeout 60 git push origin main',
    'Invoke-Expression "git push origin main"', 'iex "git push origin main"', 'node -e "require(\'child_process\').execSync(\'git push origin main\')"',
    'python -c "import os; os.system(\'git push origin main\')"', 'echo "git push origin main" | bash', 'echo "git push origin main" > p.sh',
    'echo "git push origin main" >> p.ps1', '$g push origin main', '& $git push origin main', '%g% push origin main', 'p=push; git $p origin main',
    '$p = "push"; git $p origin main', 'git -c alias.p=push p origin main', "git -c alias.p='!git push' p", 'git.cmd push origin main',
    'git commit -m "push" ; bash q.sh', 'git commit -m "$(git push origin main)"', 'git commit -m "`git push origin main`"',
    '$r = git push origin main', 'git -c core.pager=x log --grep push',
    'git -c core.pager="git push origin main" log', 'git show push', 'git -C . grep -O push',
  ], 'unclear')
})

// Catches: A1 of the stage 2 audit. A `push` split by quotes or by an expansion was not seen
// (`git pu"sh" -q origin main` pushed main in a real Bash): quotes are now removed before
// reading the words, and a push that appears only once expansions are removed stops.
test('rule 7 (A1): push split by quotes or expansions stops', () => {
  expectKind([
    'git pu"sh" origin main', "git pu''sh origin main", 'git "pu"sh origin main', 'git pu"sh" -q origin main',
  ], 'push')
  for (const c of [
    'git pu$()sh origin main', 'git pu${x}sh origin main', 'git pu$@sh origin main', 'git pu$1sh origin main',
    'git -c alias.p=pu"sh" p origin main', 'bash -c "git pu\'\'sh origin main"', 'git -c alias.p=pu${x}sh p origin main',
    'echo push; git -c alias.p=pu${x}sh p origin main', 'git pus{h,} origin main', 'git pu%x%sh origin main',
  ]) expect([c, kindOf(c) === 'pass']).toEqual([c, false])
})

// Catches: A1 of the stage 2 audit, round 2. Typographic quotes (PowerShell reads them as quotes),
// `$''` and `$""` (squash took `$sh` for a variable), nested substitutions (the regex stopped at
// the first `)`) and backtick pairs (a Bash substitution) still joined a push.
test('rule 7 (A1, round 2): typographic quotes, $\'\' and $"", nested substitutions and backtick pairs stop', () => {
  expectKind([
    'git pu\u201csh\u201d origin main', 'git \u201cpush\u201d origin main', 'git pu\u2018sh\u2019 origin main',
    'git \u2018push\u2019 origin main', 'git pu\u201esh\u201d origin main',
  ], 'push')
  for (const c of [
    "git pu$''sh origin main", 'git pu$""sh origin main', 'git pu$(echo $(true))sh origin main', 'git pu$(:;(:))sh origin main',
    'git pu$(echo ")")sh origin main', 'git pu`true`sh origin main', 'git pu$(echo sh origin main',
  ]) expect([c, kindOf(c) === 'pass']).toEqual([c, false])
})

// Catches: M4 of round 3. A `$(` read as unclosed (an apostrophe or a lone `"` inside it) stopped
// any command naming git; now it stops only when a reading without that substitution names push.
test('rule 7 (M4): an unclosed $( stops only when a reading without it names a push', () => {
  expectKind([
    "git commit -m \"$(cat <<'EOF'\nfix: don't crash\nEOF\n)\"", "git commit -m \"$(cat <<'EOF'\nusa 1\" de margen\nEOF\n)\"",
    'git log -1 --format=%s | grep -c "$(echo it\'s)"', "git commit -m 'cuesta $(5'",
  ], 'pass')
  for (const c of ['git pu$(echo sh origin main', 'git pu$(echo $(true))sh origin main', "git pu$(echo it's)sh origin main"]) {
    expect([c, kindOf(c) === 'pass']).toEqual([c, false])
  }
})

// Catches: M1 of the closing audit. An alias or function for git defined in the same command
// (`Set-Alias gx git; gx push origin main`) pushed main: the push segment did not name git.
test('rule 7 (closing M1): an alias or function for git defined in the command makes a later push unclear', () => {
  for (const c of [
    'Set-Alias gx git; gx push origin main', 'New-Alias gx git; gx push origin main', 'sal gx git; gx push origin main',
    'nal gx git; gx push origin main', 'alias gx=git; gx push origin main', 'doskey gx=git $*\ngx push origin main',
    'gx() { git "$@"; }; gx push origin main', 'function gx { git @args }; gx push origin main',
  ]) expect([c, kindOf(c) === 'pass']).toEqual([c, false])
  expectKind(['git add x; npm run push', 'git add x && npm run push'], 'pass')
})

// Catches: M2 of the closing audit. An expansion or a shell wildcard in git's subcommand
// (`git ${x:-push} origin main`, `a=pu; b=sh; git $a$b …`) could stand for push and passed.
test('rule 7 (closing M2): an expansion or wildcard in the subcommand of git is unclear', () => {
  for (const c of [
    'git ${x:-push} origin main', 'git ${x-push} origin main', 'a=pu; b=sh; git $a$b origin main', 'git $x origin main',
    'git pus[h] origin main', 'git pus? origin main', 'git p*sh origin main', 'git pu$(echo s)h origin main', 'git %x% origin main',
  ]) expect([c, kindOf(c) === 'pass']).toEqual([c, false])
  expectKind([
    'git -C "$dir" commit -m x', 'git -C $dir status', 'git -c user.name=$n commit -m x', 'git log --format=%h -1',
    'git commit -m "usa git (x) y push"', '(git status)',
  ], 'pass')
  // B1 limits in the subcommand close too.
  for (const c of ["git $'\\x70ush' origin main", 'git %p%sh origin main', "git ('pu'+'sh') origin main"]) {
    expect([c, kindOf(c) === 'pass']).toEqual([c, false])
  }
  // L1 closes too: the `$(` splits the word and leaves `pu$` as the subcommand.
  expect(kindOf('git pu$(: \\")sh origin main; (echo \\")') === 'pass').toBe(false)
})

// Catches: B1 and B2 of the second closing pass. `--attr-source` takes a value, so the word after
// it is no subcommand; and a `name()` inside quotes (a text) defines no function for git.
test('rule 7 (closing, 2nd pass): --attr-source takes a value; name() inside quotes defines nothing', () => {
  expect(kindOf('git --attr-source HEAD $y origin main') === 'pass').toBe(false)
  expectKind(['echo "usa main() y luego git push"', 'gh pr create --body "usa main() y git push"'], 'pass')
  expect(kindOf('gx() { git "$@"; }; gx push origin main') === 'pass').toBe(false)
})

// Documentation of the README (closing B2), not a regression test: it pins which here-document
// lines and unquoted substitutions stop, the behavior the README describes.
test('rule 7 (README): a here-document line or an unquoted substitution stops only when it is no text or no clear form', () => {
  expectKind(["git commit -F - <<'EOF'\nnota sobre push\nEOF", 'echo $(git push -u origin tarea/x)'], 'pass')
  for (const c of ["git commit -F - <<'EOF'\n- nota sobre push\nEOF", "git commit -F - <<'EOF'\ngit push origin main\nEOF", 'echo $(git push origin main)']) {
    expect([c, kindOf(c) === 'pass']).toEqual([c, false])
  }
})

// Catches: A3 of the stage 2 audit, round 2. An assignment or `env` before a git text runs the
// program it names (`GIT_EDITOR="git push -q origin tarea/x:main #" git commit --allow-empty`
// moved main in a real Bash): a segment that lost words to strip has no text exemption.
test('rule 7 (A3): an environment assignment before a git text that names a push does not pass', () => {
  for (const c of [
    'GIT_EDITOR="git push origin main #" git commit', 'GIT_EDITOR="git push origin main #" git commit --amend',
    'env GIT_EDITOR="git push origin main #" git commit', 'VISUAL="git push origin main #" git -C . commit',
    'GIT_SEQUENCE_EDITOR="git push origin main #" git commit', 'GIT_PAGER="git push origin main #" git log',
    'GIT_EDITOR="git push origin main #" git tag -a v9', 'GIT_EDITOR="git push origin main #" git notes edit',
    'GIT_EDITOR="git push -q origin tarea/x:main #" git commit --allow-empty',
  ]) expect([c, kindOf(c) === 'pass']).toEqual([c, false])
})

test('rule 7 (round 2): no regressions in the forms and texts that must pass', () => {
  expectKind([
    'git push -u origin tarea/x', 'git push origin tarea/x', 'git push origin --delete tarea/x',
    'git stash push -u', 'git stash push -m "wip"', 'git -C D:/x stash push', 'git tag -a v1 -m "push"', 'git notes add -m "push"',
    'git help push', 'gh issue create --title x --body "nota sobre push"', 'gh issue comment 4 --body "push"',
    'git commit -m "push"', 'git commit -m "nota sobre push"', 'git log --grep push', 'GIT_EDITOR=vim git commit',
    'git add -A && git commit -m "regla 7: push" && git push -u origin tarea/cre-push-1',
  ], 'pass')
})

// M3 of the stage 2 audit: commands that name push and push nothing pass, under isGitText's conditions.
test('rule 7 (M3): git stash push, tag/notes messages, git help push and gh issue bodies pass', () => {
  expectKind([
    'git stash push -m "antes de x"', 'git stash push -u', 'git stash push -- a.md', 'git -C D:/x stash push -m "wip push"',
    'git tag -a v1 -m "tras el push"', 'git notes add -m "sobre push"', 'git help push',
    'gh issue create --title x --body "git push origin main falla"', 'gh issue comment 4 --body "nota sobre push"',
  ], 'pass')
  for (const c of [
    'git stash push -m "$(git push origin main)"', 'git tag -a v1 -m "`git push origin main`"', 'gh issue create --body "$(git push origin main)"',
    'git -c alias.stash=push stash', 'git -c x=push stash push', 'git help push > ayuda.txt',
  ]) expect([c, kindOf(c) === 'pass']).toEqual([c, false])
})

// A here-document body is read as commands: a commit message there that names a push stops
// (accepted false positive, as in rule 6; use `git commit -F <file>`).
test('rule 7: a here-document body that names a push is read as a command', () => {
  expect(kindOf("git commit -F - <<'EOF'\ngit push origin main\nEOF")).toBe('push')
  expect(kindOf("git commit -F - <<'EOF'\n- nota sobre push\nEOF") === 'pass').toBe(false)
  expect(kindOf("git commit -F - <<'EOF'\netapa 1: x\nEOF")).toBe('pass')
})

test('rule 7: namesPush matches whole words only; the messages name the forms and el responsable', () => {
  for (const t of ['git push', 'x "git push y"', 'alias.p=push', 'push>out', 'pu\\sh', 'PUSH']) expect([t, namesPush(t)]).toEqual([t, true])
  for (const t of ['tarea/cre-push-1', 'tarea/fix-push', 'pushd x', 'pushx', 'npm run push-all']) expect([t, namesPush(t)]).toEqual([t, false])
  expect(findPush('git push origin main')?.why).toBe('git push origin main')
  for (const m of [MSG_PUSH('x'), MSG_PUSH_UNCLEAR('x')]) {
    expect(m.includes('git push -u origin tarea/<n>') && m.includes('git push origin --delete tarea/<n>') && m.includes('el responsable')).toBe(true)
  }
  expect(MSG_PUSH_UNCLEAR('x').includes('no lo entiendo con certeza')).toBe(true)
})
