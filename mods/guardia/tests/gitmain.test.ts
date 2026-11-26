import { expect, test } from 'claude-code/testing'
import { findGitMain, MSG_GITMAIN, MSG_GITMAIN_UNCLEAR } from '../hooks/gitmain.ts'
import { findWorktreeRemove } from '../hooks/worktree.ts'

// Rule 5 (CRE-GRD-MAIN-1): in Creador's main folder git changes the checkout only in a
// clear form. The commands here are only strings: nothing is ever run.

const MAIN = 'C:\\repos\\creador'
const OTHER = 'C:\\repos\\otro'
const WORKTREE = 'C:\\repos\\creador\\.claude\\worktrees\\cre-grd-main-1'

const kindOf = (command: string, cwd: string) => findGitMain(command, cwd)?.kind ?? 'pass'
const stops = (commands: string[], cwd: string) => {
  for (const c of commands) expect([c, cwd, kindOf(c, cwd)]).not.toEqual([c, cwd, 'pass'])
}
const passes = (commands: string[], cwd: string) => {
  for (const c of commands) expect([c, cwd, kindOf(c, cwd)]).toEqual([c, cwd, 'pass'])
}

// Catches: a checkout or switch to anything but main in the main folder (the CRE-GRD-KILL-1 error).
test('rule 5: in the main folder, a switch to another branch or any path form stops', () => {
  for (const c of [
    'git checkout tarea/cre-grd-main-1', 'git switch tarea/x', 'git checkout -b tarea/x', 'git checkout -B tarea/x origin/main',
    'git switch -c x', 'git switch -C x', 'git switch --detach', 'git switch --detach HEAD~1', 'git checkout abc1234', 'git checkout v1.0',
    'git checkout origin/main', 'git switch origin/main', 'git checkout --detach', 'git checkout -- skills/x.md', 'git checkout -- .',
    'git checkout .', 'git checkout main -- skills/x.md', 'git restore skills/x.md', 'git restore --staged .', 'git restore --source=HEAD~1 .',
    'git switch -f main', 'git checkout -f main', 'git checkout --force main', 'git switch -', 'git checkout -', 'git checkout', 'git switch',
    'git checkout "tarea/x"', "git switch 'tarea/x'", 'git checkout Main', 'git checkout main main', 'git checkout master',
    'GIT_TRACE=1 git checkout tarea/x', 'git.exe checkout tarea/x', '"C:\\Program Files\\Git\\cmd\\git.exe" checkout tarea/x',
    '/usr/bin/git switch x', 'git -c core.pager=cat checkout x', 'git --no-pager switch x', 'git -C . checkout x', 'git -P switch x',
    'git switch main; git checkout tarea/x', 'git status && git checkout tarea/x', 'git pull --ff-only && git switch tarea/x',
    'echo hecho | git checkout tarea/x', 'git switch tarea/x 2>&1', 'git switch tarea/x | cat',
    'if ($true) { git checkout x }', 'if true; then git checkout x; fi', 'time git checkout x', 'command git checkout x',
  ]) {
    expect([c, findGitMain(c, MAIN)?.kind]).toEqual([c, 'branch'])
  }
  expect(findGitMain('git checkout tarea/x', MAIN)?.why).toBe('git checkout tarea/x')
})

// Catches: the clear forms must pass, or the normal flow (back to main, pull) breaks.
test('rule 5: the clear forms pass in the main folder', () => {
  passes([
    'git switch main', 'git checkout main', 'git checkout "main"', 'git pull', 'git pull --ff-only', 'git pull --ff-only origin main',
    'git fetch', 'git fetch --all --prune', 'git status', 'git status --short --branch', 'git log --oneline -3', 'git diff', 'git diff --check',
    'git diff HEAD~1 -- mods/guardia', 'git show HEAD:PROGRESS.md', 'git branch -d tarea/x', 'git branch --show-current',
    'git push origin --delete tarea/x', 'git merge-base HEAD origin/main', 'git stash list', 'git rev-parse --show-toplevel',
    'git switch main 2>&1', 'git checkout main | cat', 'git switch main && git pull --ff-only', 'git fetch; git switch main; git pull --ff-only',
    'git -C C:/repos/creador switch main', 'git -C C:/repos/creador status', 'git --no-pager log -3', 'git -c core.pager=cat log -3',
    'cd C:/repos/creador && git pull --ff-only', 'echo "git checkout tarea/x"', 'git commit -m "git checkout tarea/x"',
    'gh pr create --body "git switch x"', 'grep -n checkout mods/guardia/README.md', 'ls', 'git worktree list',
  ], MAIN)
})

// Catches: git worktree is guarded, but the way worktrees are made stays free.
test('rule 5: git worktree list, add outside the main files, remove and prune pass; anything else stops', () => {
  passes([
    'git worktree list', 'git worktree list --porcelain', 'git worktree prune', 'git worktree prune --dry-run',
    'git worktree add C:/repos/creador/.claude/worktrees/x -b tarea/x origin/main',
    'git worktree add C:\\repos\\creador\\.claude\\worktrees\\x -b tarea/x origin/main',
    'git worktree add .claude/worktrees/x -b tarea/x origin/main', 'git worktree add -b tarea/x .claude/worktrees/x origin/main',
    'git worktree add .claude/worktrees/x tarea/x', 'git worktree add --detach .claude/worktrees/x origin/main',
    'git worktree add ../otro-worktree -b tarea/y origin/main', 'git worktree add C:/tmp/w -b tarea/y origin/main',
    'git worktree add -f .claude/worktrees/x tarea/x', 'git worktree add --quiet --lock .claude/worktrees/x -B tarea/x origin/main',
    'git worktree remove .claude/worktrees/x',
    'git -C C:/repos/creador worktree add .claude/worktrees/x -b tarea/x origin/main',
  ], MAIN)
  // Rule 5 lets remove through (with or without -f), but rule 6 stops every remove first, in any
  // folder (CRE-GRD-WT-1): even without --force, git follows an ignored junction.
  for (const c of ['git worktree remove .claude/worktrees/x', 'git worktree remove --force .claude/worktrees/x', 'git worktree remove -f .claude/worktrees/x']) {
    expect([c, findWorktreeRemove(c)?.kind]).toEqual([c, 'remove'])
  }
  stops([
    'git worktree add', 'git worktree add -b tarea/x', 'git worktree add skills/x', 'git worktree add mods/x -b tarea/x origin/main',
    'git worktree add C:/repos/creador/mods/x tarea/x', 'git worktree add . tarea/x', 'git worktree add C:/repos/creador x',
    'git worktree add $p -b tarea/x', 'git worktree add .claude/worktrees/$n -b tarea/x', 'git worktree add --weird .claude/worktrees/x',
    'git worktree add .claude/worktrees/x origin/main extra', 'git worktree move a b', 'git worktree lock x', 'git worktree unlock x',
    'git worktree repair', 'git worktree', 'git worktree remove $p', 'git worktree frobnicate',
  ], MAIN)
})

// Catches: the same commands outside the main folder must not change behavior.
test('rule 5: the same commands pass outside the main folder and in its worktrees', () => {
  const commands = [
    'git checkout tarea/x', 'git switch -c tarea/x', 'git checkout -b tarea/x origin/main', 'git checkout -- skills/x.md',
    'git restore mods/x.ts', 'git switch --detach', 'git worktree add skills/x', 'git checkout abc1234', 'git switch tarea/x && git pull',
  ]
  passes(commands, OTHER)
  passes(commands, WORKTREE)
  passes(commands, `${WORKTREE}\\mods\\guardia`)
  passes(['git -C C:/repos/otro checkout x', `cd ${OTHER} && git switch -c x`, `git -C ${WORKTREE} checkout tarea/y`,
    'cd C:/repos/creador/.claude/worktrees/x && git checkout y', 'git -C C:/repos/creador/.claude/worktrees/x switch -c y',
    'cd ~ && git checkout x', 'cd ~/repo && git switch -c y', 'cd $HOME/repo && git checkout -b y', 'git -C $env:USERPROFILE\\repo checkout x',
  ], MAIN)
  passes(['git checkout main', 'git switch main', 'git pull --ff-only'], OTHER)
})

// Catches: the folder is main by the session's folder, by `cd` and by `-C`, in any spelling.
test('rule 5: a cd or -C into the main folder counts, in every spelling of the path', () => {
  for (const c of [
    'git -C C:/repos/creador checkout tarea/x', 'git -C /c/repos/creador switch x', 'git -C "C:\\repos\\creador" switch x',
    'git -C c:\\repos\\creador checkout x', 'git -C C:/repos/creador/mods checkout x', 'git -C C:/repos/creador/mods/guardia restore .',
    'git -C C:/repos/otro/../Creador checkout x', 'git -C C:/repos/creador/.claude/worktrees/.. checkout x',
    'git -C C:/repos/creador/. checkout x', 'git -C C:/repos/creador/ checkout x',
    'cd C:/repos/creador && git checkout x', 'cd /c/repos/creador && git switch x', 'cd "C:\\repos\\creador"; git switch x',
    'Set-Location C:\\repos\\creador; git checkout x', 'Set-Location -LiteralPath C:\\repos\\creador; git checkout x',
    'sl C:\\repos\\creador; git switch x', 'pushd C:\\repos\\creador; git switch x', 'cd C:/repos/otro/../Creador && git switch x',
    'cd C:/repos && cd Creador && git switch x', 'cd C:/repos/creador/mods && git checkout x', 'cd C:/repos/creador/mods/guardia && git restore .',
    'git -C C:/repos -C Creador checkout x', 'cd C:/repos && git -C Creador checkout x',
  ]) expect([c, findGitMain(c, OTHER)?.kind]).toEqual([c, 'branch'])
  // From a worktree, `-C ..` style paths that reach the main folder count too.
  expect(kindOf('git -C ../../.. checkout x', WORKTREE)).toBe('branch')
  expect(kindOf('cd ../../.. && git switch x', WORKTREE)).toBe('branch')
  // The session's own folder inside the main folder, below the main checkout's root.
  expect(kindOf('git checkout tarea/x', `${MAIN}\\mods\\guardia`)).toBe('branch')
  expect(kindOf('git checkout tarea/x', 'c:/repos/creador/')).toBe('branch')
  expect(kindOf('git checkout tarea/x', '/c/repos/creador')).toBe('branch')
  // A later cd out of the main folder frees the command.
  expect(kindOf('cd C:/repos/otro && git checkout x', MAIN)).toBe('pass')
  expect(kindOf('cd C:/repos/creador && git status && cd C:/repos/otro && git switch -c y', OTHER)).toBe('pass')
  expect(kindOf('git -C C:/repos/creador status; git switch -c y', OTHER)).toBe('pass')
})

// Catches: what the parse cannot place or follow stops, like rule 4's «forma clara».
test('rule 5: what cannot be placed or followed stops as unclear', () => {
  for (const [c, cwd] of [
    ['git -C $p checkout x', OTHER], ['cd $p && git switch x', OTHER], ['cd %REPO% && git checkout x', OTHER], ['git -C "$d" restore .', OTHER],
    ['cd C:/repos/Cre* && git checkout x', OTHER], ['cd - && git checkout x', OTHER],
    ['git --git-dir=C:/repos/creador/.git --work-tree=C:/repos/creador checkout x', OTHER],
    ['git --git-dir C:/repos/creador/.git checkout x', OTHER], ['git --work-tree=C:/repos/creador switch x', OTHER],
    ['bash -c "git checkout tarea/x"', MAIN], ['sh -c "git switch x"', MAIN], ['pwsh -Command "git switch -c x"', MAIN],
    ['powershell -c "git restore ."', MAIN], ['cmd /c "git checkout x"', MAIN], ['cmd /c git switch x', MAIN], ['wsl git checkout x', MAIN],
    ['xargs git checkout', MAIN], ['echo tarea/x | xargs git switch', MAIN], ['eval "git checkout x"', MAIN], ['iex "git switch x"', MAIN],
    ['Invoke-Expression "git checkout x"', MAIN], ['Start-Process git -ArgumentList "checkout x"', MAIN], ['timeout 5 git checkout x', MAIN],
    ['sudo git checkout x', MAIN], ['nohup git switch x', MAIN], ['npx git checkout x', MAIN], ['python -c "import os; os.system(\'git checkout x\')"', MAIN],
    ['node -e "require(\'child_process\').execSync(\'git switch x\')"', MAIN],
    ['bash -c "cd /c/repos/creador && git checkout tarea/x"', OTHER], ['pwsh -c "cd C:\\repos\\creador; git switch x"', OTHER],
    ['$g checkout x', MAIN], ['$git switch x', MAIN], ['%g% checkout x', MAIN],
    ['git -C //?/C:/repos/creador checkout x', OTHER], // the `?` of a device path reads as a glob
    ['git --weird checkout x', MAIN], ['git --exec-path=x checkout y', MAIN],
  ] as const) expect([c, cwd, findGitMain(c, cwd)?.kind]).toEqual([c, cwd, 'unclear'])
  // Nested text that names no git change, or runs elsewhere, passes.
  passes(['bash -c "git status"', 'pwsh -c "git log -3"', 'cmd /c "git fetch"', 'node -e "console.log(1)"', 'xargs echo', 'bash script.sh'], MAIN)
  passes(['bash -c "git checkout x"', 'pwsh -c "git switch -c y"', 'xargs git checkout'], OTHER)
})

// Catches: `gh pr checkout` switches the branch in the folder it runs in, like `git checkout` (audit CRE-GRD-MAIN-1).
test('rule 5: gh pr checkout stops in the main folder and passes elsewhere', () => {
  const forms = [
    'gh pr checkout 55', 'gh pr checkout 55 --force', 'gh pr checkout https://github.com/mrKanoh/the-creator/pull/55',
    'gh pr checkout tarea/x', 'gh pr checkout -b mi-rama 55', 'gh pr checkout --detach 55', 'gh pr co 55', 'gh pr checkout',
    'gh -R mrKanoh/the-creator pr checkout 55', 'gh pr -R mrKanoh/the-creator checkout 55', 'gh.exe pr checkout 55', 'GH_REPO=a/b gh pr checkout 55',
    'git status && gh pr checkout 55', 'gh pr checkout 55 2>&1 | cat',
  ]
  for (const c of forms) expect([c, findGitMain(c, MAIN)?.kind]).toEqual([c, 'branch'])
  for (const c of forms) {
    stops([`cd ${MAIN} && ${c}`], OTHER)
    passes([c], OTHER)
    passes([c], WORKTREE)
    passes([`cd ${WORKTREE} && ${c}`], MAIN)
  }
  expect(findGitMain('gh pr checkout 55', MAIN)?.why).toBe('gh pr checkout 55')
  expect(findGitMain('bash -c "gh pr checkout 55"', MAIN)?.kind).toBe('unclear')
  passes(['bash -c "gh pr checkout 55"'], OTHER)
  // The other gh pr commands do not touch the checkout.
  passes(['gh pr view 55', 'gh pr create --draft', 'gh pr list', 'gh pr status', 'gh pr diff 55', 'gh pr ready 55', 'gh pr merge 55', 'gh repo view'], MAIN)
})

// Catches: lines that are known to slip through, kept so the limits in the README stay true.
test('rule 5: the documented limits', () => {
  // Other commands that change the checkout are not this rule's business.
  passes(['git reset --hard origin/main', 'git stash pop', 'git merge tarea/x', 'git pull origin tarea/x', 'git rebase main', 'git cherry-pick abc1234',
    'git branch -f main abc1234', 'git update-ref refs/heads/main abc1234', 'git clean -fd', 'git apply x.patch', 'git am x.patch'], MAIN)
  // A git alias or a script is invisible.
  passes(['git co tarea/x', './cambiar.sh', 'npm run checkout', 'make switch'], MAIN)
})

test('rule 5: the messages say what to do: work in a worktree', () => {
  for (const msg of [MSG_GITMAIN('git checkout tarea/x'), MSG_GITMAIN_UNCLEAR('git -C $p checkout x')]) {
    expect(msg).toContain('worktree')
    expect(msg).toContain('git worktree add')
    expect(msg).toContain('git switch main')
    expect(msg).toContain('carpeta principal de Creador')
    expect(msg).toContain('C:/repos/creador/.claude/worktrees/<nombre>')
    expect(msg).not.toContain('\\')
  }
  expect(MSG_GITMAIN('git checkout tarea/x')).toContain('git checkout tarea/x')
  expect(MSG_GITMAIN_UNCLEAR('git -C $p checkout x')).toContain('no lo entiendo con certeza')
})
