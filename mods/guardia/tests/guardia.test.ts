import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import {
  currentWork, findLinkCreate, findMerge, findPrCreate, findShellWrite, isOpen, isProtected, joinPath, linkVerdict,
  publishesOnMerge, repoOf, roleOf,
} from '../hooks/rules.ts'

// ---- Pure rules ----

test('protected paths: Creador main skills/ by any spelling, and the home links', () => {
  for (const p of [
    'C:\\repos\\creador\\skills\\trabajador\\SKILL.md',
    'c:/repos/creador/SKILLS/orquestador/SKILL.md',
    '/c/repos/creador/skills/nueva/SKILL.md',
    'C:\\repos\\creador\\tools\\..\\skills\\x.md',
    'C:\\Users\\usuario\\.claude\\skills\\trabajador\\SKILL.md',
    'C:\\Users\\usuario\\.claude\\skills\\consulta\\SKILL.md',
    '~/.claude/skills/orquestador/SKILL.md',
    '~/.claude/skills/consulta/SKILL.md',
    '\\\\?\\C:\\repos\\creador\\skills\\orquestador',
  ]) expect(isProtected(p)).toBe(true)
  for (const p of [
    'C:\\repos\\creador\\.claude\\worktrees\\cre-mod-1\\skills\\trabajador\\SKILL.md',
    'C:\\repos\\creador\\PROGRESS.md',
    'C:\\repos\\creador\\skillsx\\a.md',
    'C:\\repos\\otro\\skills\\a.md',
    'C:\\Users\\usuario\\.claude\\skills\\otra\\SKILL.md',
  ]) expect(isProtected(p)).toBe(false)
})

// Catches (R1, CRE-GRD-MAIN-1): mods/ of the main folder is read live by the installed mod, like skills/.
test('protected paths: Creador main mods/ by the same spellings; worktrees and look-alikes pass', () => {
  for (const p of [
    'C:\\repos\\creador\\mods\\guardia\\hooks\\rules.ts',
    'c:/repos/creador/MODS/tablero/README.md',
    '/c/repos/creador/mods/nuevo/x.ts',
    'C:\\repos\\creador\\tools\\..\\mods\\x.md',
    '\\\\?\\C:\\repos\\creador\\mods\\guardia',
    'C:\\repos\\creador\\mods',
    'C:\\repos\\creador\\.claude\\worktrees\\..\\..\\mods\\x.md',
  ]) expect([p, isProtected(p)]).toEqual([p, true])
  for (const p of [
    'C:\\repos\\creador\\.claude\\worktrees\\cre-grd-main-1\\mods\\guardia\\hooks\\rules.ts',
    'C:\\repos\\creador\\modsx\\a.md',
    'C:\\repos\\creador\\xmods\\a.md',
    'C:\\repos\\otro\\mods\\a.md',
    'C:\\repos\\creador\\tools\\mods.md',
  ]) expect([p, isProtected(p)]).toEqual([p, false])
})

test('shell writes to main mods/, in the same forms as skills/; reads, git and worktrees pass', () => {
  const main = 'C:\\repos\\creador'
  const inMods = 'C:\\repos\\creador\\mods\\guardia'
  const elsewhere = 'C:\\repos\\otro'
  for (const c of [
    "sed -i 's/a/b/' C:/repos/creador/mods/guardia/hooks/rules.ts",
    'echo x > /c/repos/creador/mods/guardia/README.md',
    'echo x>>C:\\repos\\creador\\mods\\a.md',
    'Set-Content -Path C:\\repos\\creador\\mods\\guardia\\hooks\\rules.ts -Value x',
    'Remove-Item C:\\repos\\creador\\mods\\tablero -Recurse',
    'cp /tmp/a C:/repos/creador/mods/guardia/a.ts',
    "perl -pi -e 's/a/b/' C:/repos/creador/mods/guardia/hooks/rules.ts",
    '[System.IO.File]::WriteAllText("C:\\repos\\creador\\mods\\a.md", "x")',
    'robocopy C:\\src C:\\repos\\creador\\mods\\guardia',
    'cmd /c del C:\\repos\\creador\\mods\\guardia\\README.md',
    'cmd /c mklink /J C:\\repos\\creador\\mods\\x C:\\src',
    'cmd /c mklink /J C:\\repos\\creador\\mo^ds\\x C:\\src',
    'cmd /c "cd /d C:\\repos\\creador\\mods && mklink /J x C:\\src"',
  ]) expect([c, findShellWrite(c, elsewhere) !== undefined]).toEqual([c, true])
  expect(findShellWrite('rm mods/guardia/README.md', main)).toBeDefined()
  expect(findShellWrite('cd C:/repos/creador && rm mods/a.md', elsewhere)).toBeDefined()
  expect(findShellWrite("cd C:/repos/creador/mods/guardia && sed -i 's/a/b/' README.md", elsewhere)).toBe('C:/repos/creador/mods/guardia')
  expect(findShellWrite('Set-Location C:\\repos\\creador\\mods; Set-Content guardia\\README.md x', elsewhere)).toBeDefined()
  expect(findShellWrite('Set-Content README.md x', inMods)).toBe(inMods)
  expect(findShellWrite('echo x > README.md', inMods)).toBeDefined()
  for (const c of [
    'cat C:/repos/creador/mods/guardia/README.md',
    'Get-Content C:\\repos\\creador\\mods\\guardia\\README.md',
    'git -C C:/repos/creador pull --ff-only',
    "sed -i 's/a/b/' C:/repos/creador/.claude/worktrees/x/mods/guardia/README.md",
    'echo "no edites C:/repos/creador/mods" > /tmp/nota.txt',
    'cmd /c mklink /J C:\\tmp\\a C:\\tmp\\b',
  ]) expect([c, findShellWrite(c, elsewhere)]).toEqual([c, undefined])
  expect(findShellWrite('cat README.md', inMods)).toBeUndefined()
  expect(findShellWrite('rm mods/a.md', elsewhere)).toBeUndefined()
})

test('gh pr create is found only as a command', () => {
  expect(findPrCreate('gh pr create --fill')).toEqual({})
  expect(findPrCreate('gh pr new')).toEqual({})
  expect(findPrCreate('gh -R mrKanoh/the-creator pr create --fill')).toEqual({})
  expect(findPrCreate('git push -u origin tarea/x && gh pr create --title "a; b"')).toEqual({})
  expect(findPrCreate('cd D:/repo && gh.exe pr create')).toEqual({ cd: 'D:/repo' })
  expect(findPrCreate('& gh pr create')).toEqual({})
  expect(findPrCreate('GH_DEBUG=1 gh pr create')).toEqual({})
  expect(findPrCreate('echo "gh pr create"')).toBeUndefined()
  expect(findPrCreate('git commit -m "antes de gh pr create"')).toBeUndefined()
  expect(findPrCreate('gh pr view 3')).toBeUndefined()
  expect(findPrCreate('gh pr list')).toBeUndefined()
  expect(findPrCreate('gh issue create')).toBeUndefined()
})

test('a cd target becomes a folder git can run in', () => {
  expect(joinPath('D:/t', '/c/Users/usuario/repo')).toBe('c:/Users/usuario/repo')
  expect(joinPath('D:/t', 'C:\\r')).toBe('C:\\r')
  expect(joinPath('D:/t/', 'sub/dir')).toBe('D:/t/sub/dir')
  expect(joinPath('D:/t', '/tmp/x')).toBe('/tmp/x')
})

test('«Trabajo actual» open or closed, in the formats in use', () => {
  expect(isOpen(currentWork('## Trabajo actual: ninguno\n## Terminados\n- x'))).toBe(false)
  expect(isOpen(currentWork('## Trabajo actual: ninguno.\r\n'))).toBe(false)
  expect(isOpen(currentWork('# P\n## Trabajo actual: LC-DOMINIO-1 dominio  (rama tarea/dominio-worker)\n'))).toBe(true)
  expect(isOpen(currentWork('## Trabajo actual\n\nCRE-MOD-1 etapa 2\n## Terminados'))).toBe(true)
  expect(isOpen(currentWork('## Trabajo actual\n\n## Terminados\n- CRE-MOD-1'))).toBe(false)
  expect(currentWork('# proyecto-a\n## Checkpoint 0A\n### Estado')).toBeUndefined()
  expect(isOpen(currentWork('### Trabajo actual: X\n'))).toBe(false)
})

test('«ninguno» in its looser spellings; a fenced heading never counts', () => {
  expect(isOpen(currentWork('## Trabajo actual\n\n- Ninguno\n## Terminados'))).toBe(false)
  expect(isOpen(currentWork('## Trabajo actual: ninguno (todo fusionado)\n'))).toBe(false)
  expect(isOpen(currentWork('## Trabajo actual — ninguno\n'))).toBe(false)
  expect(isOpen(currentWork('## Trabajo actual - ninguno\n'))).toBe(false)
  expect(isOpen(currentWork('## Trabajo actual — X-1 algo\n'))).toBe(true)
  expect(isOpen(currentWork('## Trabajo actual: ningunos cambios pendientes de X-1\n'))).toBe(true)
  const fenced = '## Trabajo actual: ninguno\n### Orden\n```\n## Trabajo actual: X-1\n```\n## Terminados\n'
  expect(isOpen(currentWork(fenced))).toBe(false)
  expect(currentWork('# P\n```\n## Trabajo actual: X-1\n```\n')).toBeUndefined()
})

test('shell writes once the folder or a cd is under skills/ (M1), and the extra writers', () => {
  const inSkill = 'C:\\repos\\creador\\skills\\trabajador'
  const elsewhere = 'C:\\repos\\otro'
  expect(findShellWrite("cd C:/repos/creador/skills/trabajador && sed -i 's/a/b/' SKILL.md", elsewhere)).toBe('C:/repos/creador/skills/trabajador')
  expect(findShellWrite('Set-Content SKILL.md x', inSkill)).toBe(inSkill)
  expect(findShellWrite('cp a.md C:/repos/creador/skills/b.md', inSkill)).toBe('C:/repos/creador/skills/b.md')
  expect(findShellWrite('Set-Location -LiteralPath C:\\repos\\creador\\skills; Set-Content trabajador\\SKILL.md x', elsewhere)).toBeDefined()
  expect(findShellWrite('Set-Content SKILL.md x', inSkill)).toBeDefined()
  expect(findShellWrite('echo x > SKILL.md', inSkill)).toBeDefined()
  expect(findShellWrite('time rm SKILL.md', inSkill)).toBeDefined()
  expect(findShellWrite("perl -pi -e 's/a/b/' SKILL.md", inSkill)).toBeDefined()
  expect(findShellWrite('robocopy C:\\src C:\\repos\\creador\\skills\\trabajador', elsewhere)).toBeDefined()
  expect(findShellWrite('xcopy C:\\src\\a.md C:\\repos\\creador\\skills\\', elsewhere)).toBeDefined()
  expect(findShellWrite('cat SKILL.md', inSkill)).toBeUndefined()
  expect(findShellWrite('git checkout -- SKILL.md', inSkill)).toBeUndefined()
  expect(findShellWrite("perl -I lib -e 'print 1' SKILL.md", inSkill)).toBeUndefined()
  expect(findShellWrite("cd C:/repos/otro && sed -i 's/a/b/' SKILL.md", inSkill)).toBeUndefined()
  expect(findShellWrite('rm SKILL.md', elsewhere)).toBeUndefined()
})

test('shell writes to protected paths; reads and git pass', () => {
  const main = 'C:\\repos\\creador'
  const elsewhere = 'C:\\repos\\otro'
  for (const c of [
    "sed -i 's/a/b/' C:/repos/creador/skills/trabajador/SKILL.md",
    'echo x > /c/repos/creador/skills/trabajador/SKILL.md',
    'echo x>>C:\\repos\\creador\\skills\\a.md',
    'Set-Content -Path C:\\repos\\creador\\skills\\trabajador\\SKILL.md -Value x',
    'Remove-Item C:\\Users\\usuario\\.claude\\skills\\orquestador\\SKILL.md',
    'rm ~/.claude/skills/consulta/SKILL.md',
    'cp /tmp/a ~/.claude/skills/trabajador/SKILL.md',
    '[System.IO.File]::WriteAllText("C:\\repos\\creador\\skills\\a.md", "x")',
  ]) expect(findShellWrite(c, elsewhere)).toBeDefined()
  expect(findShellWrite('rm skills/trabajador/SKILL.md', main)).toBeDefined()
  expect(findShellWrite('cd C:/repos/creador && rm skills/a.md', elsewhere)).toBeDefined()
  for (const c of [
    'cat C:/repos/creador/skills/trabajador/SKILL.md',
    'Get-Content C:\\repos\\creador\\skills\\trabajador\\SKILL.md',
    'grep -n regla C:/repos/creador/skills/*/SKILL.md',
    'git -C C:/repos/creador pull --ff-only',
    'git -C C:\\repos\\creador checkout -- skills/trabajador/SKILL.md',
    "sed -i 's/a/b/' C:/repos/creador/.claude/worktrees/x/skills/a.md",
    'echo "no edites C:/repos/creador/skills" > /tmp/nota.txt',
  ]) expect(findShellWrite(c, elsewhere)).toBeUndefined()
  expect(findShellWrite('rm skills/a.md', elsewhere)).toBeUndefined()
})

test('mklink writes, also through cmd /c', () => {
  const elsewhere = 'C:\\repos\\otro'
  for (const c of [
    'cmd /c mklink /J C:\\repos\\creador\\skills\\x C:\\src',
    'cmd /c mklink /J C:\\Users\\usuario\\.claude\\skills\\otra C:\\repos\\creador\\skills\\otra\\..\\x',
    'cmd.exe /C mklink C:\\repos\\creador\\skills\\a.md C:\\src\\a.md',
    'cmd /c "mklink /D C:\\repos\\creador\\skills\\x C:\\src"',
    'cmd /c del C:\\repos\\creador\\skills\\trabajador\\SKILL.md',
    'cmd //c mklink /J C:\\Users\\usuario\\.claude\\skills\\x C:\\repos\\creador\\skills\\x',
    'mklink /J C:\\repos\\creador\\skills\\x C:\\src',
    // any cmd segment naming a protected path counts, whatever its flags
    'cmd /s /c "mklink /J C:\\repos\\creador\\skills\\x C:\\src"',
    'cmd /d /c mklink /J C:\\repos\\creador\\skills\\x C:\\src',
    'cmd /r mklink /J C:\\repos\\creador\\skills\\x C:\\src',
    'cmd /c cmd /c mklink /J C:\\repos\\creador\\skills\\x C:\\src',
    'cmd /c "echo hi && mklink /J C:\\repos\\creador\\skills\\x C:\\src"',
    'cmd /c "echo hi & del C:\\repos\\creador\\skills\\trabajador\\SKILL.md"',
    'cmd /c "cd C:\\repos\\creador\\skills && mklink /J x C:\\src"',
    // a read through cmd stops too (false positive accepted: fails closed)
    'cmd /c type C:\\repos\\creador\\skills\\trabajador\\SKILL.md',
    // cmd's own cd, ^ escapes and % expansions (2c)
    'cmd /c "cd /d C:\\repos\\creador && mklink /J skills\\x C:\\src"',
    'cmd /c "pushd C:\\repos\\creador && mklink /J skills\\x C:\\src"',
    'cmd /c mklink /J C:\\repos\\creador\\sk^ills\\x C:\\src',
    'cmd /c mklink /J C:\\repos\\creador\\s%CD:~0,0%kills\\x C:\\src',
    'cmd /c "set P=C:\\repos\\creador&& mklink /J %P%\\skills\\x C:\\src"',
  ]) expect(findShellWrite(c, elsewhere)).toBeDefined()
  expect(findShellWrite('cmd /c mklink /J C:\\tmp\\a C:\\tmp\\b', elsewhere)).toBeUndefined()
  expect(findShellWrite('cmd /c dir C:\\tmp', elsewhere)).toBeUndefined()
  expect(findShellWrite('cmd /c echo %PATH%', elsewhere)).toBeUndefined()
})

test('a no-break space (U+00A0) splits words, as PowerShell reads it', () => {
  expect(findShellWrite('Remove-Item\u00a0C:\\repos\\creador\\skills\\x\\SKILL.md', 'C:\\repos\\otro')).toBeDefined()
  // Read as the exact link, it goes to tool.check and asks instead of running unasked.
  expect(findLinkCreate('New-Item\u00a0-ItemType Junction -Path ~/.claude/skills/x -Target C:\\repos\\creador\\skills\\x')?.name).toBe('x')
})

test('a skill link into ~/.claude/skills is recognized only in its two exact forms', () => {
  const ok = [
    ['New-Item -ItemType Junction -Path C:\\Users\\usuario\\.claude\\skills\\consulta -Target C:\\repos\\creador\\skills\\consulta', 'consulta'],
    ['new-item -path ~/.claude/skills/prueba-grd-2 -value c:/repos/creador/skills/prueba-grd-2 -itemtype SymbolicLink', 'prueba-grd-2'],
    ['New-Item -Target C:\\repos\\creador\\skills\\x1 -ItemType Junction -Path $env:USERPROFILE\\.claude\\skills\\x1', 'x1'],
    ['New-Item -ItemType Junction -Path $HOME\\.claude\\skills\\x -Target C:\\repos\\creador\\skills\\x', 'x'],
    ['cmd /c mklink /J C:\\Users\\usuario\\.claude\\skills\\consulta C:\\repos\\creador\\skills\\consulta', 'consulta'],
    ['cmd.exe /C mklink /d %USERPROFILE%\\.claude\\skills\\x C:\\repos\\creador\\skills\\x', 'x'],
  ] as const
  for (const [c, name] of ok) expect(findLinkCreate(c)?.name).toBe(name)

  for (const c of [
    // the names differ, or the target is not exactly Creador's skills/<x>
    'New-Item -ItemType Junction -Path ~/.claude/skills/x -Target C:\\repos\\creador\\skills\\y',
    'New-Item -ItemType Junction -Path ~/.claude/skills/x -Target C:\\repos\\creador\\.claude\\worktrees\\w\\skills\\x',
    'New-Item -ItemType Junction -Path ~/.claude/skills/x -Target C:\\repos\\creador\\skills\\x\\sub',
    'New-Item -ItemType Junction -Path ~/.claude/skills/x -Target C:\\repos\\creador\\skills\\x\\',
    'New-Item -ItemType Junction -Path ~/.claude/skills/x -Target C:\\repos\\creador\\tools\\..\\skills\\x',
    'New-Item -ItemType Junction -Path ~/.claude/skills/x -Target C:\\repos\\creador\\x',
    'New-Item -ItemType Junction -Path ~/.claude/skills/x -Target C:\\src\\x',
    // the link is not ~/.claude/skills/<x>
    'New-Item -ItemType Junction -Path ~/.claude/skills/x/y -Target C:\\repos\\creador\\skills\\y',
    'New-Item -ItemType Junction -Path C:\\tmp\\.claude\\skills\\x -Target C:\\repos\\creador\\skills\\x',
    'New-Item -ItemType Junction -Path C:\\Users\\usuario\\..\\..\\.claude\\skills\\x -Target C:\\repos\\creador\\skills\\x',
    'New-Item -ItemType Junction -Path ~/.claude/skills/X -Target C:\\repos\\creador\\skills\\X',
    'New-Item -ItemType Junction -Path ~/.claude/skills/x_y -Target C:\\repos\\creador\\skills\\x_y',
    'New-Item -ItemType Junction -Path %USERPROFILE%\\.claude\\skills\\x -Target C:\\repos\\creador\\skills\\x',
    // chained, quoted, expanded, other flags or item types
    'New-Item -ItemType Junction -Path ~/.claude/skills/x -Target C:\\repos\\creador\\skills\\x ; Remove-Item C:\\repos\\creador\\skills\\x',
    'New-Item -ItemType Junction -Path ~/.claude/skills/x -Target C:\\repos\\creador\\skills\\x && rm -rf C:/repos/creador/skills',
    'New-Item -ItemType Junction -Path ~/.claude/skills/x -Target C:\\repos\\creador\\skills\\x | Out-Null',
    'New-Item -ItemType Junction -Path "~/.claude/skills/x" -Target "C:\\repos\\creador\\skills\\x"',
    'New-Item -ItemType Junction -Path $(pwd)\\.claude\\skills\\x -Target C:\\repos\\creador\\skills\\x',
    'New-Item -ItemType File -Path ~/.claude/skills/x -Target C:\\repos\\creador\\skills\\x',
    'New-Item -ItemType Junction -Path ~/.claude/skills/x -Target C:\\repos\\creador\\skills\\x -Force',
    'New-Item -ItemType Junction -Path ~/.claude/skills/x -Path ~/.claude/skills/x -Target C:\\repos\\creador\\skills\\x',
    'New-Item -Path ~/.claude/skills/x -Target C:\\repos\\creador\\skills\\x',
    'ni -ItemType Junction -Path ~/.claude/skills/x -Target C:\\repos\\creador\\skills\\x',
    // mklink without /J or /D, or not through cmd /c exactly
    'cmd /c mklink C:\\Users\\usuario\\.claude\\skills\\x C:\\repos\\creador\\skills\\x',
    'cmd /c mklink /H C:\\Users\\usuario\\.claude\\skills\\x C:\\repos\\creador\\skills\\x',
    'cmd /k mklink /J C:\\Users\\usuario\\.claude\\skills\\x C:\\repos\\creador\\skills\\x',
    'cmd //c mklink /J C:\\Users\\usuario\\.claude\\skills\\x C:\\repos\\creador\\skills\\x',
    'mklink /J C:\\Users\\usuario\\.claude\\skills\\x C:\\repos\\creador\\skills\\x',
    'C:\\tmp\\cmd.exe /c mklink /J C:\\Users\\usuario\\.claude\\skills\\x C:\\repos\\creador\\skills\\x',
    'cmd /c mklink /J ~/.claude/skills/x C:\\repos\\creador\\skills\\x',
    'cmd /c mklink /J C:\\Users\\usuario\\.claude\\skills\\x C:\\repos\\creador\\skills\\x & del C:\\x',
    'cmd /c mklink /J C:\\Users\\usuario\\.claude\\skills\\x C:\\repos\\creador\\skills\\x ^& del C:\\x',
  ]) expect(findLinkCreate(c)).toBeUndefined()
})

// ---- Through the engine: hooks beneath stand for git, the file system and the tool ----

// `remote`: the files of each origin/<branch> (origin/HEAD is main);
// `originUrl`: origin's URL; `pr`: what `gh pr view --json url,baseRefName` answers.
type Repo = {
  root: string; branch: string; files: Record<string, string>; remote?: Record<string, Record<string, string>>
  originUrl?: string; pr?: { url?: string; baseRefName?: string }
}

function fakeGit(repos: Repo[], argv: readonly string[], cwd: string) {
  const ok = (stdout: string) => ({ exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false })
  const fail = { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false }
  const here = cwd.toLowerCase()
  const repo = repos.find(r => here === r.root.toLowerCase() || here.startsWith(`${r.root.toLowerCase()}/`))
  if (repo === undefined) return fail
  if (argv[0] === 'gh') return repo.pr === undefined ? fail : ok(`${JSON.stringify(repo.pr)}\n`)
  const tree = (ref: string) => ref === 'HEAD' ? repo.files : ref.startsWith('origin/') ? repo.remote?.[ref.slice(7)] : undefined
  const args = argv.slice(1).join(' ')
  if (args === 'rev-parse --show-toplevel') return ok(`${repo.root}\n`)
  if (args === 'rev-parse --abbrev-ref HEAD') return ok(`${repo.branch}\n`)
  if (args === 'rev-parse --abbrev-ref origin/HEAD') return repo.remote?.main === undefined ? fail : ok('origin/main\n')
  if (args === 'remote get-url origin') return repo.originUrl === undefined ? fail : ok(`${repo.originUrl}\n`)
  if (argv[1] === 'ls-tree' && argv[2] === '--name-only') {
    const files = tree(argv[3] ?? '')
    if (files === undefined) return fail
    const dir = argv[4]
    const names = Object.keys(files)
    const listed = dir === undefined
      ? [...new Set(names.map(n => n.split('/')[0]))]
      : names.filter(n => n.startsWith(dir))
    return ok(listed.join('\n') + '\n')
  }
  const shown = args.match(/^show ([^:]+):(.+)$/)
  if (shown !== null) {
    const text = tree(shown[1] ?? '')?.[shown[2] ?? '']
    return text === undefined ? fail : ok(text)
  }
  return fail
}

const OPEN = '# P\n## Trabajo actual: X-1 algo  (rama tarea/x-1)\n## Terminados\n'
const CLOSED = '# P\n## Trabajo actual: ninguno\n## Terminados\n- X-1 hecho\n'

const refusal = (r: { deny?: string; isError?: true; text?: string }) =>
  r.deny ?? (r.isError === true ? r.text : undefined)

function setup(on: On, repos: Repo[], cwd: string) {
  let ran = 0
  on('session.cwd', () => ({ value: cwd }))
  on('process.run', (_, e) => ({ value: fakeGit(repos, e.argv, e.init?.cwd ?? cwd) }))
  on('fs.stat', (_, e) => {
    const p = e.path.replace(/\\/g, '/').toLowerCase()
    // The junction ~/.claude/skills/trabajador leads to Creador's main skills/.
    const real = p.replace(/^c:\/users\/usuario\/\.claude\/skills\/trabajador/, 'c:/repos/creador/skills/trabajador')
    if (p.includes('nuevo')) return { deny: 'ENOENT' }
    return { value: { kind: 'file' as const, size: 1, mtimeMs: 0, isLink: real !== p, realPath: real } }
  })
  on('tool.call', () => {
    ran++
    return { result: {} }
  })
  return () => ran
}

test('rule 1: gh pr create stops while HEAD has work open, and passes when closed', async ($, on) => {
  const repos: Repo[] = [
    { root: 'D:/t/abierto', branch: 'tarea/x-1', files: { 'PROGRESS.md': OPEN } },
    { root: 'D:/t/lc', branch: 'tarea/otro-nombre', files: { 'PROGRESS.md': OPEN.replace('X-1', 'LC-1') } },
    { root: 'D:/t/paralelo', branch: 'tarea/x-2', files: { 'PROGRESS.md': CLOSED, 'progress/X-2.md': OPEN } },
    { root: 'D:/t/paralelo-cerrado', branch: 'tarea/x-3', files: { 'PROGRESS.md': OPEN, 'progress/x-3.md': CLOSED } },
    { root: 'D:/t/paralelo-otro-id', branch: 'tarea/otro-nombre', files: { 'PROGRESS.md': CLOSED, 'progress/X-9.md': OPEN } },
    { root: 'D:/t/paralelo-todo-cerrado', branch: 'tarea/x-6', files: { 'PROGRESS.md': CLOSED, 'progress/x-6.md': CLOSED, 'progress/x-7.md': CLOSED } },
    { root: 'D:/t/cerrado', branch: 'tarea/x-1', files: { 'PROGRESS.md': CLOSED } },
    { root: 'D:/t/sin-progress', branch: 'tarea/x-1', files: { 'README.md': '# r' } },
    { root: 'D:/t/hal', branch: 'tarea/wa-real-1', files: { 'PROGRESS.md': '# hal\n## Checkpoint 0A\n' } },
  ]
  const ran = setup(on, repos, 'D:/t/abierto')

  const stopped = await $.tool.call({ tool: 'Bash', command: 'gh pr create --fill' })
  expect(refusal(stopped)).toContain('PROGRESS.md')
  expect(refusal(stopped)).toContain('X-1')

  for (const dir of ['D:/t/lc', 'D:/t/paralelo']) {
    const r = await $.tool.call({ tool: 'PowerShell', command: `cd ${dir}; gh pr create --fill` })
    expect(refusal(r)).toContain('Trabajo actual')
  }
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'cd D:/t/paralelo && gh pr create' }))).toContain('progress/X-2.md')
  // M2: progress/<id>.md is named by id, not branch; any open one stops.
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'cd D:/t/paralelo-otro-id && gh pr create' }))).toContain('progress/X-9.md')
  // PROGRESS.md open stops even when the branch's own progress file is closed.
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'cd D:/t/paralelo-cerrado && gh pr create' }))).toContain('PROGRESS.md')
  expect(ran()).toBe(0)

  for (const dir of ['D:/t/paralelo-todo-cerrado', 'D:/t/cerrado', 'D:/t/sin-progress', 'D:/t/hal', 'D:/t/no-es-repo']) {
    const r = await $.tool.call({ tool: 'Bash', command: `cd ${dir} && gh pr create --fill` })
    expect(refusal(r)).toBeUndefined()
  }
  for (const command of ['echo "gh pr create"', 'gh pr view 3', 'gh pr list']) {
    expect(refusal(await $.tool.call({ tool: 'Bash', command }))).toBeUndefined()
  }
  expect(ran()).toBe(8)
})

test('a failing check stops only the commands the rules are about', async ($, on) => {
  let ran = 0
  on('session.cwd', () => ({ value: 'D:/t/x' }))
  on('process.run', () => {
    throw new Error('git missing')
  })
  on('tool.call', () => {
    ran++
    return { result: {} }
  })
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'gh pr create --fill' }))).toContain('no pude comprobar')
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'ls -la' }))).toBeUndefined()
  expect(ran).toBe(1)
})

test('rule 2: edits under Creador main skills/ stop; worktrees and other files pass', async ($, on) => {
  const ran = setup(on, [], 'C:/repos/otro')

  for (const call of [
    { tool: 'Edit', file_path: 'C:\\repos\\creador\\skills\\trabajador\\SKILL.md', old_string: 'a', new_string: 'b' },
    { tool: 'Write', file_path: 'c:/repos/creador/skills/nuevo/SKILL.md', content: 'x' },
    { tool: 'Edit', file_path: 'C:\\Users\\usuario\\.claude\\skills\\trabajador\\SKILL.md', old_string: 'a', new_string: 'b' },
    { tool: 'NotebookEdit', notebook_path: 'C:/repos/creador/skills/n.ipynb', new_source: 'x' },
    { tool: 'Bash', command: "sed -i 's/a/b/' C:/repos/creador/skills/trabajador/SKILL.md" },
    { tool: 'PowerShell', command: 'Set-Content C:\\repos\\creador\\skills\\trabajador\\SKILL.md x' },
  ] as const) {
    expect(refusal(await $.tool.call(call))).toContain('worktree')
  }
  expect(ran()).toBe(0)

  for (const call of [
    { tool: 'Edit', file_path: 'C:\\repos\\creador\\.claude\\worktrees\\x\\skills\\trabajador\\SKILL.md', old_string: 'a', new_string: 'b' },
    { tool: 'Write', file_path: 'C:\\repos\\creador\\PROGRESS.md', content: 'x' },
    { tool: 'Write', file_path: 'C:\\repos\\otro\\nuevo.md', content: 'x' },
    { tool: 'Bash', command: 'cat C:/repos/creador/skills/trabajador/SKILL.md' },
    { tool: 'Bash', command: 'git -C C:/repos/creador pull --ff-only' },
  ] as const) {
    expect(refusal(await $.tool.call(call))).toBeUndefined()
  }
  expect(ran()).toBe(5)
})

// Catches (R1, CRE-GRD-MAIN-1): the edit tools and the shell reach mods/ of the main folder too.
test('rule 2: edits under Creador main mods/ stop; worktrees pass', async ($, on) => {
  const ran = setup(on, [], 'C:/repos/otro')
  for (const call of [
    { tool: 'Edit', file_path: 'C:\\repos\\creador\\mods\\guardia\\hooks\\rules.ts', old_string: 'a', new_string: 'b' },
    { tool: 'Write', file_path: 'c:/repos/creador/MODS/guardia/nuevo.ts', content: 'x' },
    { tool: 'Write', file_path: '/c/repos/creador/mods/guardia/nuevo.ts', content: 'x' },
    { tool: 'Edit', file_path: 'C:/repos/creador/tools/../mods/guardia/README.md', old_string: 'a', new_string: 'b' },
    { tool: 'NotebookEdit', notebook_path: 'C:/repos/creador/mods/n.ipynb', new_source: 'x' },
    { tool: 'Bash', command: "sed -i 's/a/b/' C:/repos/creador/mods/guardia/README.md" },
    { tool: 'PowerShell', command: 'Set-Content C:\\repos\\creador\\mods\\guardia\\README.md x' },
    { tool: 'Bash', command: 'cd C:/repos/creador && git status && rm -rf mods/tablero' },
  ] as const) {
    expect([JSON.stringify(call), refusal(await $.tool.call(call))?.includes('worktree')]).toEqual([JSON.stringify(call), true])
  }
  expect(ran()).toBe(0)
  for (const call of [
    { tool: 'Edit', file_path: 'C:\\repos\\creador\\.claude\\worktrees\\x\\mods\\guardia\\hooks\\rules.ts', old_string: 'a', new_string: 'b' },
    { tool: 'Bash', command: "sed -i 's/a/b/' C:/repos/creador/.claude/worktrees/x/mods/guardia/README.md" },
    { tool: 'Bash', command: 'cat C:/repos/creador/mods/guardia/README.md' },
    { tool: 'Write', file_path: 'C:\\repos\\otro\\mods\\a.md', content: 'x' },
  ] as const) {
    expect(refusal(await $.tool.call(call))).toBeUndefined()
  }
  expect(ran()).toBe(4)
})

// Catches (R2, CRE-GRD-MAIN-1): through the engine, the main folder stops a branch change; the rest of git is free.
test('rule 5: a checkout or switch in the main folder stops; main, pull, worktrees and other folders pass', async ($, on) => {
  let cwd = 'C:\\repos\\creador'
  let ran = 0
  on('session.cwd', () => ({ value: cwd }))
  on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('tool.call', () => {
    ran++
    return { result: {} }
  })
  const call = (tool: 'Bash' | 'PowerShell', command: string) => $.tool.call({ tool, command })

  for (const [tool, command] of [
    ['Bash', 'git checkout tarea/cre-grd-main-1'], ['PowerShell', 'git switch -c tarea/x'], ['Bash', 'git checkout -- skills/x.md'],
    ['PowerShell', 'git restore .'], ['Bash', 'git -C $p checkout x'], ['Bash', 'bash -c "git switch x"'],
  ] as const) {
    const r = refusal(await call(tool, command))
    expect([command, r?.includes('worktree')]).toEqual([command, true])
  }
  expect(ran).toBe(0)
  for (const [tool, command] of [
    ['Bash', 'git switch main'], ['PowerShell', 'git checkout main'], ['Bash', 'git pull --ff-only'], ['Bash', 'git pull'],
    ['Bash', 'git fetch'], ['Bash', 'git status --short --branch'], ['Bash', 'git log --oneline -3'], ['Bash', 'git diff --check'],
    ['Bash', 'git worktree add .claude/worktrees/x -b tarea/x origin/main'], ['Bash', 'git worktree list'],
  ] as const) {
    expect([command, refusal(await call(tool, command))]).toEqual([command, undefined])
  }
  expect(ran).toBe(10)

  cwd = 'C:\\repos\\otro'
  expect(refusal(await call('Bash', 'git checkout tarea/x'))).toBeUndefined()
  expect(refusal(await call('PowerShell', 'git switch -c y'))).toBeUndefined()
  expect(refusal(await call('Bash', 'git -C C:/repos/creador switch tarea/x'))?.includes('worktree')).toBe(true)
  expect(refusal(await call('PowerShell', 'cd C:\\repos\\creador; git checkout tarea/x'))?.includes('worktree')).toBe(true)
  expect(refusal(await call('Bash', 'git -C C:/repos/creador switch main'))).toBeUndefined()
  cwd = 'C:\\repos\\creador\\.claude\\worktrees\\cre-grd-main-1'
  expect(refusal(await call('Bash', 'git checkout tarea/x'))).toBeUndefined()
  expect(refusal(await call('Bash', 'git switch -c y'))).toBeUndefined()
  expect(ran).toBe(15)
})

// Rule 6 (CRE-GRD-WT-1): every worktree remove stops in every folder, with its own message.
test('rule 6: git worktree remove stops in any folder and shell, with or without force; texts and other subcommands run', async ($, on) => {
  let cwd = 'C:\\repos\\landing-cliente\\landing'
  let ran = 0
  on('session.cwd', () => ({ value: cwd }))
  on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('tool.call', () => {
    ran++
    return { result: {} }
  })
  const call = (tool: 'Bash' | 'PowerShell', command: string) => $.tool.call({ tool, command })
  for (const folder of ['C:\\repos\\landing-cliente\\landing', 'C:\\repos\\creador', 'C:\\repos\\creador\\.claude\\worktrees\\x']) {
    cwd = folder
    for (const [tool, command] of [
      ['Bash', 'git worktree remove .claude/worktrees/x'], ['PowerShell', 'git worktree remove .claude\\worktrees\\x'],
      ['Bash', 'git worktree remove --force .claude/worktrees/x'], ['PowerShell', 'git worktree remove -f .claude\\worktrees\\x'],
      ['Bash', 'git -C C:/repos/otro worktree remove .claude/worktrees/x'], ['Bash', 'git worktree \\\nremove x'],
    ] as const) {
      const r = refusal(await call(tool, command))
      expect([folder, command, r?.includes('quitarlo es del responsable, no tuyo'), r?.includes('rmdir')]).toEqual([folder, command, true, false])
    }
    for (const [tool, command] of [
      ['PowerShell', 'try { git worktree remove x } catch { }'], ['PowerShell', '$r = git worktree remove x'], ['Bash', 'bash -c "git worktree remove x"'],
    ] as const) {
      expect([folder, command, refusal(await call(tool, command))?.includes('no lo entiendo con certeza')]).toEqual([folder, command, true])
    }
    for (const [tool, command] of [
      ['Bash', 'git worktree list'], ['PowerShell', 'git worktree prune'], ['Bash', 'git commit -m "frena git worktree remove"'],
      ['Bash', 'gh pr edit 64 --body "git worktree remove frena"'],
    ] as const) {
      expect([folder, command, refusal(await call(tool, command))]).toEqual([folder, command, undefined])
    }
  }
  expect(ran).toBe(12)
})

// B1: the catch of register.ts applies rule 6 when the session folder cannot be read. Without
// that block, rule 5's fail-closed reading would stop it with its own message, which also says
// «archivar la sesión» (M2, round 2): so the check asks for rule 6's own words.
test('rule 6: when the session folder cannot be read, the catch still stops a remove with its message', async ($, on) => {
  let ran = 0
  on('session.cwd', () => {
    throw new Error('no cwd')
  })
  on('tool.call', () => {
    ran++
    return { result: {} }
  })
  for (const command of ['git worktree remove x', 'git worktree remove --force x', '$r = git worktree remove x']) {
    const text = refusal(await $.tool.call({ tool: 'Bash', command })) ?? ''
    expect([command, text.includes('no quites un worktree') || text.includes('podría quitar un worktree')]).toEqual([command, true])
  }
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'ls -la' }))).toBeUndefined()
  expect(ran).toBe(1)
})

test('rule 5: when the folder cannot be read, a git change stops and everything else runs', async ($, on) => {
  let ran = 0
  on('session.cwd', () => {
    throw new Error('no cwd')
  })
  on('tool.call', () => {
    ran++
    return { result: {} }
  })
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'git checkout tarea/x' }))).toContain('no lo entiendo con certeza')
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'git status' }))).toBeUndefined()
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'ls -la' }))).toBeUndefined()
  expect(ran).toBe(2)
})

test('rule 2 (M1): the session folder under skills/ makes a bare file name protected', async ($, on) => {
  const ran = setup(on, [], 'C:\\repos\\creador\\skills\\trabajador')
  for (const call of [
    { tool: 'PowerShell', command: 'Set-Content SKILL.md x' },
    { tool: 'Bash', command: "sed -i 's/a/b/' SKILL.md" },
    { tool: 'Edit', file_path: 'SKILL.md', old_string: 'a', new_string: 'b' },
  ] as const) {
    expect(refusal(await $.tool.call(call))).toContain('worktree')
  }
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'cat SKILL.md' }))).toBeUndefined()
  expect(ran()).toBe(1)
})

// ---- The skill link: asked of a person, refused when nobody can be asked ----

const LINK = 'New-Item -ItemType Junction -Path C:\\Users\\usuario\\.claude\\skills\\prueba-grd-2 -Target C:\\repos\\creador\\skills\\prueba-grd-2'
const MKLINK = 'cmd /c mklink /J C:\\Users\\usuario\\.claude\\skills\\prueba-grd-2 C:\\repos\\creador\\skills\\prueba-grd-2'

// The test harness cannot set `approver` (the engine pins it), so the
// person's case is checked on the pure verdict the hook returns.
test('the link verdict: ask only when a person approves', () => {
  expect(linkVerdict(LINK, 'person')?.decision).toBe('ask')
  expect(linkVerdict(LINK, 'person')?.reason).toContain('solo si el responsable pidió')
  expect(linkVerdict(LINK, 'person')?.reason).toContain('C:\\Users\\usuario\\.claude\\skills\\prueba-grd-2 → C:\\repos\\creador\\skills\\prueba-grd-2')
  expect(linkVerdict(MKLINK, 'person')?.decision).toBe('ask')
  expect(linkVerdict(LINK, 'host')?.decision).toBe('deny')
  expect(linkVerdict(LINK, undefined)?.decision).toBe('deny')
  expect(linkVerdict(LINK, undefined)?.reason).toContain('nadie puede aprobar')
  expect(linkVerdict(`${LINK} ; Remove-Item C:\\repos\\creador\\skills\\x`, 'person')).toBeUndefined()
  expect(linkVerdict('cat C:/repos/creador/skills/trabajador/SKILL.md', 'person')).toBeUndefined()
})

test('tool.check: the exact link in PowerShell is refused with no approver; other commands keep the verdict beneath', async ($, on) => {
  on('tool.check', () => ({ decision: 'allow' as const }))
  for (const command of [LINK, MKLINK]) {
    const r = await $.tool.check({ tool: 'PowerShell', input: { command } })
    expect(r.decision).toBe('deny')
    expect(r.reason).toContain('nadie puede aprobar')
  }
  // Bash never gets the exception: rule 2 stops the link at tool.call.
  expect((await $.tool.check({ tool: 'Bash', input: { command: MKLINK } })).decision).toBe('allow')
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'ls -la' } })).decision).toBe('allow')
  expect((await $.tool.check({ tool: 'PowerShell', input: { command: `${LINK} ; Remove-Item C:\\x` } })).decision).toBe('allow')
})

test('tool.check: a refusal beneath stands over the link ask', async ($, on) => {
  on('tool.check', () => ({ decision: 'deny' as const, reason: 'regla de settings' }))
  const r = await $.tool.check({ tool: 'PowerShell', input: { command: LINK } })
  expect(r.decision).toBe('deny')
  expect(r.reason).toBe('regla de settings')
})

// The harness's tool stand-in answers beneath guardia's tool.call hook, before
// the engine's permission check, so tool.check is not reached here: the test
// shows the exact link passes rule 2; tool.check is covered above and against
// the real engine (README).
test('tool.call: the exact link passes rule 2 in PowerShell only; inexact links and chains stop', async ($, on) => {
  const ran = setup(on, [], 'C:/repos/otro')
  // The exact form with %USERPROFILE% goes to the exception before cmd's % rule.
  const PERCENT = 'cmd /c mklink /J %USERPROFILE%\\.claude\\skills\\x C:\\repos\\creador\\skills\\x'
  for (const command of [LINK, MKLINK, PERCENT]) {
    expect(refusal(await $.tool.call({ tool: 'PowerShell', command }))).toBeUndefined()
    expect(refusal(await $.tool.call({ tool: 'Bash', command }))).toContain('worktree')
  }
  expect(ran()).toBe(3)
  for (const command of [
    'cmd /c mklink /J C:\\Users\\usuario\\.claude\\skills\\x C:\\repos\\creador\\skills\\y',
    'cmd /c mklink C:\\Users\\usuario\\.claude\\skills\\x C:\\repos\\creador\\skills\\x',
    `${LINK} ; Remove-Item C:\\repos\\creador\\skills\\x`,
    'New-Item -ItemType File -Path C:\\repos\\creador\\skills\\x\\a.md',
  ]) {
    expect(refusal(await $.tool.call({ tool: 'PowerShell', command }))).toContain('worktree')
  }
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'cmd //c mklink /J C:\\Users\\usuario\\.claude\\skills\\x C:\\repos\\creador\\skills\\x' }))).toContain('worktree')
  expect(ran()).toBe(3)
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'cat C:/repos/creador/skills/trabajador/SKILL.md' }))).toBeUndefined()
  expect(ran()).toBe(4)
})

// ---- Rule 3: merging a PR ----

test('rule 3: only gh pr merge <number> --merge is clear; an absolute cd before it is kept', () => {
  expect(findMerge('gh pr merge 12 --merge')).toEqual({ isClear: true, pr: '12' })
  expect(findMerge('gh.exe pr merge 12 --merge\n')).toEqual({ isClear: true, pr: '12' })
  expect(findMerge('cd D:/repo && gh pr merge 12 --merge')).toEqual({ isClear: true, pr: '12', cd: 'D:/repo' })
  expect(findMerge('cd D:\\t\\repo && gh pr merge 7 --merge')).toEqual({ isClear: true, pr: '7', cd: 'D:\\t\\repo' })
  expect(findMerge('cd /d/repo && gh pr merge 7 --merge')).toEqual({ isClear: true, pr: '7', cd: '/d/repo' })
})

test('rule 3: what is no merge passes untouched', () => {
  for (const c of [
    'gh pr view 12 --json mergeable,mergeStateStatus',
    'gh pr checks 12',
    'gh pr create --title "x" --body "el orquestador fusiona con gh pr merge y gh api"',
    'gh pr update-branch 12',
    'echo "gh pr merge 12"',
    'git commit -m "gh pr merge 12"',
    'git merge-base --is-ancestor origin/main HEAD',
    'git log --oneline -n 3',
    'npm run build',
    'bash -c "npm test"',
    'gh api repos/a/b/pulls/12',
    'gh --version',
    'gh --version 2>&1 | head -5',
    'type -a gh 2>&1; echo "---"; gh --version 2>&1 | head -5; echo "---"; git remote -v 2>&1',
    'gh pr view 12 2>&1',
    'gh auth status >out.txt',
    '$body = "x"; gh pr create --body $body',
  ]) expect(findMerge(c)).toBeUndefined()
})

// Catches (CRE-GRD-FP-1, R2): a read-only `gh pr` plus a language interpreter in another segment was
// «no claro» only because both words were in one command.
test('rule 3: a read-only gh pr with a language interpreter in another segment is no merge', () => {
  for (const c of [
    'gh pr checks 12 | python -c "import sys;print(len(sys.stdin.read().splitlines()))"',
    'gh pr checks 12 --repo mrKanoh/the-creator | python3 -c "import sys;print(sys.stdin.read())"',
    'gh pr checks 12; python -c "print(1)"',
    'gh pr checks 12 | python -c "import sys,json;print(json.load(sys.stdin))"',
    'gh pr view 12 --json files | python -c "import sys,json;print(len(json.load(sys.stdin)[\'files\']))"',
    'gh pr list --state open | py -c "import sys;print(sys.stdin.read())"',
    'python -c "print(1)" && gh pr checks 12',
    'gh pr checks 12 2>&1 | python -c "print(1)"',
  ]) expect([c, findMerge(c)]).toEqual([c, undefined])
})

// Catches (CRE-GRD-FP-1, R2): the relaxation above must not open a way to merge.
test('rule 3: a read-only gh pr beside an interpreter still stops when merge or a wrapper is involved', () => {
  for (const c of [
    'gh pr checks 12 | python -c "print(\'merge\')"',
    'gh pr checks 12 && python -c "import os;os.system(\'gh pr merge 12\')"',
    'gh pr checks 12 && gh pr merge 12 --merge && python -c "print(1)"',
    'gh pr checks 12; python -c "import os;os.system(\'gh pr checks 12\')"',
    'gh pr checks 12; bash -c "gh pr checks 12"',
    'gh pr checks 12 | bash',
    'gh pr checks 12 | sh -c "cat"',
    'gh pr checks 12 | xargs echo',
    'gh pr checks 12; pwsh -enc ZwBoACAAcAByAA==',
    'gh pr checks 12; powershell -EncodedCommand ZwBoACAAcAByAA==',
    'gh pr checks 12; pwsh -Command "echo 1"',
    'gh pr checks 12; iex "echo 1"',
    'gh pr checks 12; sudo echo 1',
    'gh pr create --title x; python -c "print(1)"',
    // ronda 1 (CRE-GRD-FP-1): an interpreter that takes its program from the pipe, or runs what it reads
    'gh pr view 12 | python',
    'gh pr view 12 | python -',
    'gh pr view 12 | node',
    'gh pr view 12 --json body -q .body | python -c "exec(input())"',
    'gh pr view 12 | perl -e "system(<STDIN>)"',
    'gh pr view 12 | ruby',
    // ronda 2: node, perl and ruby never count, even with inline code (names are built and reached by index)
    'gh pr checks 12 && node -e "console.log(1)"',
    'gh pr diff 12 | perl -ne "print if /x/"',
    'gh pr status | ruby -e "puts 1"',
    `gh pr view 12 | perl -e 'print readpipe(<>)'`,
    `gh pr view 12 | perl -ne 'readpipe'`,
    `gh pr view 12 && node -e "module['req'+'uire']('child_pro'+'cess')['ex'+'ecSync']('g'+'h pr mer'+'ge 12 --mer'+'ge')"`,
    'gh pr view 12 | NODE_OPTIONS=--require=./x.js node -e 1',
    `gh pr view 12 | PERL5OPT=-d PERL5DB='BEGIN{readpipe(1)}' perl -e 1`,
    `gh pr view 12 | ruby -e '("sy"+"stem").to_sym.to_proc.call(self,"x")'`,
    // ronda 2: an environment assignment (or env, command, time) before python loads other code
    'gh pr view 12 && PYTHONPATH=. python -c "import json"',
    'gh pr view 12 | PYTHONPATH=. python -c "import json"',
    'gh pr view 12 | PYTHONSTARTUP=./x.py python -c "print(1)"',
    'gh pr view 12 | env PYTHONPATH=. python -c "print(1)"',
    'gh pr view 12 | command python -c "print(1)"',
    'gh pr view 12 | time python -c "print(1)"',
    'gh pr view 12 | python3 script.py',
    'gh pr view 12 | python -m http.server',
    'gh pr view 12 | python -c "import sys;exec(sys.stdin.read())"',
    'gh pr view 12 | python -c "import sys,os;os.system(sys.stdin.read())"',
    'gh pr view 12 | python -c "import subprocess;subprocess.run(input())"',
    'gh pr view 12 | node -e "eval(require(\'fs\').readFileSync(0,\'utf8\'))"',
    'gh pr view 12 | node -e "require(\'child_process\').execSync(\'echo\')"',
    'gh pr view 12 | ruby -e "eval(gets)"',
    'gh pr view 12 | perl -pe "s/x/system($_)/e"',
    'gh pr view 12 | perl -ne "eval"',
    'gh pr view 12 | python -c "print(1)" extra.py',
    'gh pr checks 12; gh api repos/a/b | python -c "print(1)"',
    'gh pr edit 12 --title x | python -c "print(1)"',
    'gh pr ready 12 | python -c "print(1)"',
    'gh pr update-branch 12 | python -c "print(1)"',
    'git -c alias.x="!gh pr checks" x | python -c "print(1)"',
  ]) expect([c, findMerge(c)]).toEqual([c, expect.objectContaining({ isClear: false })])
  expect(findMerge('gh pr checks 12 | python -c "print(1)" && gh pr merge 12 --merge')).toEqual(expect.objectContaining({ isClear: false }))
})

test('rule 3 fails closed by category: interpreters, escapes, expansions, quotes, blanks, aliases, repo', () => {
  for (const c of [
    // nested interpreters and wrappers
    'bash -c "gh pr merge 12"',
    'cmd /c gh pr merge 12',
    'cmd /s /c "gh pr merge 12"',
    'pwsh -Command "gh pr merge 12"',
    'powershell -enc ZwBoACAAcAByAA==',
    'echo "gh pr merge 12" | bash',
    'echo 12 | xargs gh pr merge',
    'Invoke-Expression "gh pr merge 12"',
    'iex \'gh pr merge 12\'',
    'Start-Process gh -ArgumentList "pr merge 12"',
    'sudo gh pr merge 12',
    'nohup gh pr merge 12',
    'python -c "import os; os.system(\'gh pr merge 12\')"',
    // escapes and quotes
    'g\\h pr merge 12',
    'gh pr m\\erge 12',
    'gh pr m^erge 12',
    'gh pr m`erge 12',
    '"gh" pr merge 12',
    'gh pr "merge" 12',
    'gh \'pr\' merge 12',
    '"C:\\Program Files\\GitHub CLI\\gh.exe" pr merge 12',
    // expansions
    'gh pr $verb 12',
    'gh pr $(echo merge) 12',
    'gh pr %v% 12',
    '$g pr merge 12',
    '%g% pr merge 12',
    'gh $sub merge 12',
    // Unicode blanks and invisible characters
    'gh\u00a0pr\u00a0merge 12',
    'gh pr\u2003merge 12',
    'gh pr me\u200brge 12',
    'gh pr merge\t12',
    // repo elsewhere, wrappers, aliases, api, git aliases
    'gh -R a/b pr merge 12',
    'gh --repo=a/b pr merge 12',
    'gh pr merge 12 --repo a/b',
    'gh pr merge 12 -R a/b',
    'GH_REPO=a/b gh pr merge 12',
    'env gh pr merge 12',
    'command gh pr merge 12',
    'gh mm 12',
    'gh api -X PUT repos/a/b/pulls/12/merge',
    'gh api graphql -f query="mutation { mergePullRequest(input: {}) { clientMutationId } }"',
    'git -c alias.m="!gh pr merge 12" m',
    // two merges
    'gh pr merge 12 --merge; gh pr merge 13 --merge',
  ]) expect(findMerge(c)).toEqual(expect.objectContaining({ isClear: false }))
})

test('rule 3 (A2, B1): another repo, another method or anything more than the one clear form fails closed', () => {
  for (const c of [
    // another repo: URL, flags, GH_REPO/GH_HOST assigned in any shell's way
    'gh pr merge https://github.com/mrKanoh/portafolio-web/pull/5 --merge',
    'gh pr merge github.com/a/b/pull/5 --merge',
    'gh pr merge 5 --merge --repo a/b',
    'gh pr merge 5 --merge -R a/b',
    'gh pr merge 5 --merge -Ra/b',
    'export GH_REPO=x/y; gh pr merge 5 --merge',
    'export GH_REPO=x/y && gh pr merge 5 --merge',
    'GH_REPO=x/y gh pr merge 5 --merge',
    'GH_HOST=ghe.example.com gh pr merge 5 --merge',
    'set GH_REPO=x/y && gh pr merge 5 --merge',
    '$env:GH_REPO="x/y"; gh pr merge 5 --merge',
    '$env:GH_HOST = "h"\ngh pr merge 5 --merge',
    'declare -x GH_REPO=x/y; gh pr merge 5 --merge',
    // another method or extra flags
    'gh pr merge 5 --squash',
    'gh pr merge 5 --rebase',
    'gh pr merge 5 --merge --admin',
    'gh pr merge 5 --merge --auto',
    'gh pr merge 5 --merge --delete-branch',
    'gh pr merge 5',
    'gh pr merge --merge 5',
    'gh pr merge 05 --merge',
    'gh pr merge 5 -m',
    // a cd the check cannot follow: relative (CDPATH), `;`, `&`, `||`, an expansion in it
    'cd repo && gh pr merge 5 --merge',
    'cd ~/repo && gh pr merge 5 --merge',
    'cd D:/a; gh pr merge 5 --merge',
    'cd D:/a & gh pr merge 5 --merge',
    'cd D:/a || gh pr merge 5 --merge',
    'cd "$(gh pr merge https://github.com/a/b/pull/1 --merge)" && gh pr merge 5 --merge',
    'cd D:/a && cd D:/b && gh pr merge 5 --merge',
    'Set-Location D:/a && gh pr merge 5 --merge',
    // final probe: quotes, ^, `, %/$, wildcards, Unicode blanks
    'gh pr merge "5" --merge',
    "gh pr merge '5' --merge",
    'gh pr merge 5 "--merge"',
    'gh pr merge 5 --mer^ge',
    'gh pr merge 5 --mer`ge',
    'gh pr merge 5 --merge `n',
    'gh pr merge %n% --merge',
    'gh pr merge $n --merge',
    'gh pr merge $(echo 5) --merge',
    'gh pr merge 5* --merge',
    'gh pr merge 5? --merge',
    'gh pr merge [5] --merge',
    'gh pr merge 5\u00a0--merge',
    'gh pr merge 5\u2003--merge',
    'gh pr merge 5 --merge\u3000',
    'gh pr merge 5  --merge',
    'gh pr merge \uff15 --merge',
    '& gh pr merge 5 --merge',
  ]) expect(findMerge(c)).toEqual(expect.objectContaining({ isClear: false }))
})

// Catches (CRE-GRD-FP-3, R1): the commands reported as read-only false positives (proyecto-e, Creador's
// orchestrator) stopped for a `node`/`pwsh` beside `gh`, by design (CRE-GRD-FP-1, round 2), and the refusal
// did not say so. Their short forms, with `--json` and a quoted jq filter, already passed and still do.
test('rule 3 (FP-3): read-only gh pr with --json and a quoted jq filter passes; the reported commands stop naming the interpreter', () => {
  for (const c of [
    `cd /c/repos/creador && gh pr checks 79 --watch && gh pr view 79 --json headRefOid,isDraft,body --jq '.headRefOid,.isDraft,(.body|.[0:60])'`,
    `gh pr checks 4 && gh pr view 4 --json isDraft,headRefOid,body -q '.isDraft, .headRefOid, (.body|split("\\n")[0])'`,
    `gh pr view 4 --json isDraft,body -q '.isDraft, (.body|split("\\n")[0:3]|join("\\n"))'`,
    `gh pr view 4 -q '.title'`,
    'gh pr checks 4 2>&1 | head; gh pr view 4 --json isDraft --jq .isDraft',
  ]) expect([c, findMerge(c)]).toEqual([c, undefined])
  const real = [
    ['node', 'git fetch -q origin && git diff --check c258f8f..HEAD && node --test herramientas/tests/*.test.mjs 2>&1 | grep -E "ℹ (tests|pass|fail)" && gh pr checks 4 && gh pr view 4 --json isDraft,headRefOid,body -q \'.isDraft, .headRefOid, (.body|split("\\n")[0])\''],
    ['pwsh', 'cd /c/repos/creador/.claude/worktrees/x && git status --short --branch && CI=true pwsh -NoProfile -File tools/check-caps.ps1 2>&1 | tail -5; gh pr checks 77 2>&1 | head; gh pr view 77 --json isDraft,body -q \'.isDraft, (.body|split("\\n")[0:3]|join("\\n"))\''],
    ['node', 'cd /c/repos/creador && node tools/copia-publica/armar.mjs --ensayo 2>&1 | tail -1; gh pr view 79 --json headRefOid,isDraft,body --jq \'.headRefOid,.isDraft,(.body|.[0:60])\''],
  ]
  for (const [name, c] of real) {
    const found = findMerge(c ?? '')
    expect([c, found?.isClear]).toEqual([c, false])
    expect([c, found?.why]).toEqual([c, expect.stringContaining(`intérprete \`${name}\` en un comando que nombra \`gh\``)])
  }
})

// Catches (CRE-GRD-FP-3, R3): every unclear form says why, and the forms the order lists keep stopping. The
// substitution, backtick and escaped-quote forms passed before this change: segments() keeps them inside
// quotes, and Bash still runs them.
test('rule 3 (FP-3): substitutions, backticks, escaped quotes and quote tricks that may merge stop, with a reason', () => {
  for (const c of [
    // the order's list
    `gh pr view 4 --json body -q '.body' | sh`,
    'gh pr view 4 -q "$(gh pr merge 4 --admin)"',
    'gh pr checks 4 && gh pr merge 4 --admin',
    `gh pr view 4 --json x --jq '.x' && gh api -X PUT repos/o/r/pulls/4/merge`,
    `gh pr view 4 --jq '.x' > x.sh && sh x.sh`,
    // quotes that hide a merge
    `gh pr view 4 --jq '.x' && gh pr 'me'rge 4 --merge`,
    `gh pr view 4 --jq '.x' && gh pr "mer""ge" 4 --merge`,
    `gh pr view 4 -q '.x' && g'h' pr merge 4 --merge`,
    `gh pr view 4 -q '.x' && gh pr me''rge 4 --merge`,
    `gh pr view 4 -q '.x|"merge"' && gh pr me"$x"rge 4`,
    // substitutions and backticks inside quotes (passed before FP-3)
    'gh pr view 4 -q \'.x\' "$(gh pr merge 4 --merge)"',
    'gh pr view 4 -q ".x`gh pr merge 4`"',
    `gh pr view 4 -q "$(g'h' pr me''rge 4)"`,
    'gh pr view 4 -q "$(gh api -X PUT repos/o/r/pulls/4/merge)"',
    'gh pr view 4 -q "$(gh pr me$x 4)"',
    'echo "$(gh pr merge 4)"',
    'x="$(gh pr merge 4)"',
    'echo "${x:-$(gh pr merge 4)}"',
    'echo "a" "b $(gh pr merge 4)"',
    'echo `gh pr merge 4`',
    'echo "`gh pr merge 4`"',
    'echo "$(echo ")" ; gh pr merge 4)"',
    'echo "$(echo \\" ; gh pr merge 4)"',
    // escaped quotes that move where Bash's quotes end (passed before FP-3)
    'echo \\" ; gh pr merge 4 \\"',
    "echo \\' ; gh pr merge 4 \\'",
    'gh pr view 4 -q \\" ; gh pr me$x 4 \\"',
    // an expansion inside the command's name (passed before FP-3)
    'g$(echo h) pr merge 4',
    'g`echo h` pr merge 4',
    'gh$x pr merge 4',
  ]) {
    const found = findMerge(c)
    expect([c, found?.isClear]).toEqual([c, false])
    expect([c, typeof found?.why === 'string' && found.why !== '']).toEqual([c, true])
  }
  expect(findMerge('gh pr view 4 -q "$(gh pr merge 4 --admin)"')?.why).toContain('sustitución')
  expect(findMerge('echo \\" ; gh pr merge 4 \\"')?.why).toContain('comilla escapada')
  expect(findMerge('gh pr checks 4 && gh pr merge 4 --admin')?.why).toContain('fuera de la forma clara')
  // A PR body with escaped quotes and no merge, and a substitution that reads, still pass. A commit message by
  // here-document that names `gh pr merge` stops since round 1 (accepted false positive, in the README): its
  // lines are read as commands and no closed reading tells data from a command there; `git commit -F` passes.
  expect(findMerge("git commit -m \"$(cat <<'EOF'\nregla 3: el orquestador usa gh pr merge\nEOF\n)\"")?.isClear).toBe(false)
  expect(findMerge('gh pr create --title x --body "usa \\"gh pr view\\""')).toBeUndefined()
  expect(findMerge('gh pr view 4 -q "$(echo .x)"')).toBeUndefined()
})

// Catches (CRE-GRD-FP-3, ronda 1, A1 to A6): rule 3 judged only a segment whose first word was gh, so
// control words, groups, continuations, braces, typographic quotes and wrappers carried a merge past it
// (they passed on main too). The audit's cases, by family.
test('rule 3 (FP-3 r1): control words, groups, continuations, braces, quotes, wrappers and gh aliases stop', () => {
  const families: Record<string, string[]> = {
    A1: [
      '{ gh pr merge 4 --merge; }',
      'gh pr checks 4 --watch && { gh pr merge 4 --merge; }',
      'if gh pr checks 4; then gh pr merge 4 --merge; fi',
      'if gh pr checks 4; then gh pr merge 4 --admin; fi',
      'for i in 1; do gh pr merge 4; done',
      'while true; do gh pr merge 4; done',
      '! gh pr merge 4',
      'f(){ gh pr merge 4; }; f',
      'try { gh pr merge 4 --merge } catch {}',
      '& { gh pr merge 4 --merge }',
    ],
    A2: [
      'gh pr \\\nmerge 4 --merge',
      'gh pr mer\\\nge 4',
      'gh pr `\nmerge 4',
      'gh pr {merge,4}',
      '{gh,pr,merge,4}',
      'gh {pr,} merge 4',
    ],
    A3: [
      'gh api -X PUT repos/o/r/pulls/4/mer"g"e',
      "gh api -X PUT repos/o/r/pulls/4/'m'erge",
      'gh api -X PUT repos/o/r/pulls/4/mer\\ge',
      'p=merge; gh api -X PUT repos/o/r/pulls/4/$p',
      'gh api -X PUT repos/o/r/pulls/4/{mer,}ge',
      'gh api graphql -F query=@q.graphql',
    ],
    A4: [
      'gh pr “merge” 4',
      'gh pr ‘merge’ 4',
      'echo "” ; gh pr merge 4 --merge ; echo “"',
    ],
    A5: [
      'env -i gh pr merge 4 --admin',
      'command -p gh pr merge 4',
      'builtin command gh pr merge 4',
      'find . -maxdepth 0 -exec gh pr merge 4 \\;',
      'busybox sh -c "gh pr merge 4"',
      'coproc gh pr merge 4',
      'trap "gh pr merge 4" EXIT',
      '& (gcm gh) pr merge 4',
      'trap "gh pr $v 4" EXIT',
      'env -i gh pr $v 4',
    ],
    A6: [
      "gh alias set co 'pr merge' --clobber",
      "gh alias set co 'pr mer''ge'",
      'gh alias import f.yml',
    ],
  }
  for (const [family, cases] of Object.entries(families)) {
    for (const c of cases) expect([family, c, findMerge(c)?.isClear]).toEqual([family, c, false])
  }
})

// Catches (CRE-GRD-FP-3, ronda 1, M1): substitutions one after another counted as nested and stopped common
// reads; the code that judges substitutions had no test in either direction.
test('rule 3 (FP-3 r1): substitutions one after another and many backtick spans that read still pass', () => {
  for (const c of [
    'a=$(git rev-parse HEAD); b=$(git rev-parse origin/main); c=$(date); d=$(pwd); gh pr view 4',
    'a=$(git rev-parse HEAD); b=$(git rev-parse origin/main); c=$(date); d=$(pwd); e=$(whoami); gh pr checks 4',
    `gh pr create --title x --body "${Array.from({ length: 12 }, (_, i) => `\`a${i}\``).join(' ')}"`,
    `git commit -m "${Array.from({ length: 25 }, (_, i) => `\`f${i}\``).join(', ')} y gh pr view"`,
    'git commit -m "usa `gh pr view` y `gh pr checks`"',
    'gh pr view 4 --json title -q "$(echo .title)"',
    'gh alias list',
    'gh alias delete co',
    '{ gh pr view 4; }',
    'if gh pr checks 4; then gh pr view 4; fi',
    'gh api repos/o/r/pulls/4',
    'gh api "repos/o/r/pulls?state=open"',
    'gh pr create --title x --body "cita “textual” del cliente"',
    'echo "gh pr merge 12" | grep merge',
    'git merge-base --is-ancestor origin/main HEAD && gh pr view 4',
  ]) expect([c, findMerge(c)]).toEqual([c, undefined])
  for (const c of [
    'a=$(git rev-parse HEAD); b=$(gh pr merge 4 --admin); gh pr view 4',
    'a=$(date); b=$(date); c=$(date); d=$(echo "$(gh pr merge 4)")',
    `gh pr create --title x --body "${Array.from({ length: 25 }, (_, i) => `\`a${i}\``).join(' ')} $(gh pr merge 4)"`,
  ]) expect([c, findMerge(c)?.isClear]).toEqual([c, false])
})

// Catches (CRE-GRD-FP-3, ronda 2, X2): a gh read inside `$(…)` or after a PowerShell assignment counted as
// «gh beside an expansion» in a piece that is no gh command, and stopped common reads.
test('rule 3 (FP-3 r2): gh reads in a test, a substitution or a PowerShell assignment pass; with a merge they stop', () => {
  for (const c of [
    '$s = gh pr view 4 --json state -q .state',
    '$n = gh pr view --json number -q .number; gh pr checks $n',
    'if [ "$(gh pr view 4 --json isDraft -q .isDraft)" = "false" ]; then echo listo; fi',
    'test "$(gh pr view 4 --json state -q .state)" = OPEN && echo abierto',
    '[ "$(gh pr view 4 --json state -q .state)" = MERGED ] && echo ya',
    'state="$(gh pr view 4 --json state -q .state)"; echo $state',
    '$s=gh pr view 4 --json state -q .state',
  ]) expect([c, findMerge(c)]).toEqual([c, undefined])
  for (const c of [
    '$s = gh pr merge 4 --admin',
    '$s=gh pr merge 4 --admin',
    'if [ "$(gh pr merge 4 --admin)" ]; then echo x; fi',
    'test "$(gh pr me$x 4)" && echo x',
    'trap "gh pr $v 4" EXIT',
  ]) expect([c, findMerge(c)?.isClear]).toEqual([c, false])
})

// Catches (CRE-GRD-FP-3, ronda 2, X3, L5 and L1): a backtick in the verb was flattened away before the
// expansion check, `gh pr` cut by `(` had no verb to judge, and a name built by a backtick inside `$(…)`
// passed once the text did not say merge.
test('rule 3 (FP-3 r2): a backtick or a parenthesis as the gh pr verb stops', () => {
  for (const c of [
    'gh pr `echo merge` 4',
    'gh pr `echo merge` 4 --merge',
    'gh pr mer`echo ge` 4',
    'gh pr `cat verbo.txt` 4',
    'gh pr "`echo merge`" 4',
    'gh pr view 4 -q "$(g`echo h` pr mer$x 4)"',
    'gh pr ("mer"+"ge") 4',
    "gh pr (-join('m','e','r','g','e')) 4",
    'gh ("pr") ("mer"+"ge") 4',
  ]) expect([c, findMerge(c)?.isClear]).toEqual([c, false])
  for (const c of ['gh pr view 4', 'gh --version', 'gh pr checks 4 --watch']) expect([c, findMerge(c)]).toEqual([c, undefined])
})

// Catches (CRE-GRD-FP-3, ronda 3, B1 and B2): options were skipped only before the subcommand, so an option
// or a redirection between `gh pr` and the verb hid a merge; a verb starting with `@` (PowerShell's array or
// splat) was no expansion. The same reads with options still pass.
test('rule 3 (FP-3 r3): an option, a redirection or an @ before the gh pr verb stops when it may merge', () => {
  for (const c of [
    'gh pr --repo o/r merge 4 --merge',
    'gh pr -R o/r merge 4',
    'gh pr --repo=o/r merge 4',
    'gh -R o/r pr -R a/b merge 4',
    'gh pr > x merge 4',
    'gh pr 2> /dev/null merge 4',
    'gh pr < /dev/null merge 4',
    'gh pr <<< x merge 4',
    'gh pr --repo o/r me$x 4',
    'gh pr --repo o/r ("mer"+"ge") 4',
    'gh alias --clobber set co "pr mer"ge',
    "gh alias --clobber set co 'pr view'",
    'gh pr @("mer"+"ge") 4',
    '$v=@("merge"); gh pr @v 4',
    'gh pr @v 4',
  ]) expect([c, findMerge(c)?.isClear]).toEqual([c, false])
  for (const c of [
    'gh pr --repo o/r view 4 --json state -q .state',
    'gh pr -R o/r checks 4',
    'gh pr view 4 2> /dev/null',
  ]) expect([c, findMerge(c)]).toEqual([c, undefined])
})

// Catches (CRE-GRD-FP-3, etapa 2): an environment assignment before a command was dropped unread, and gh runs
// its pager, browser or editor from it (`PAGER="gh pr merge 4" gh pr view 4` passed, on main too).
test('rule 3 (FP-3 e2): an environment assignment before a command that names merge stops', () => {
  for (const c of [
    'PAGER="gh pr merge 4" gh pr view 4',
    'GH_PAGER="gh pr merge 4" gh pr view 4',
    'BROWSER="gh pr merge 4" gh pr view 4 --web',
    'GH_BROWSER="gh pr merge 4" gh pr view 4 --web',
    'EDITOR="gh pr merge 4" gh pr edit 4',
    'GH_EDITOR="gh pr merge 4" gh pr edit 4',
    'env PAGER="gh pr mer""ge 4" gh pr view 4',
    'GH_REPO=a/b gh pr merge 12 --merge',
  ]) expect([c, findMerge(c)?.isClear]).toEqual([c, false])
  for (const c of ['FOO=bar gh pr view 4', 'GH_PAGER=cat gh pr view 4']) expect([c, findMerge(c)]).toEqual([c, undefined])
})

// Catches (CRE-GRD-FP-3, etapa 3, M1 and M2): an assignment that said merge stopped any command, and the text
// after a quoted `$(` ran to the end of the command and shifted the quotes of a later gh.
test('rule 3 (FP-3 e3): assignments and quoted substitutions in common commands pass', () => {
  const commitAndPr = "git commit -m \"$(cat <<'EOF'\netapa 3: arreglo\n\nCo-Authored-By: x\nEOF\n)\" && git push -u origin tarea/x && gh pr create --title \"x\" --body \"$(cat <<'EOF'\n## Resumen\n- cambio (con paréntesis)\nEOF\n)\""
  for (const c of [
    'base="$(git merge-base HEAD origin/main)"; git diff "$base"',
    'MODE=merge npm run build',
    'branch=fix/merge-queue; git checkout -b $branch',
    'MSG="Merge branch main"; git commit -m "$MSG"',
    'x="merge"',
    'git commit -m "$(cat msg.txt)" && gh pr create --title x --body "$(cat body.md)"',
    'b="$(git branch --show-current)"; gh pr list --head "$b"',
    'h="$(git rev-parse HEAD)"; gh pr view 4 --json headRefOid -q .headRefOid; echo "$h"',
    'echo "rama $(git branch --show-current)"; gh pr view $PR',
    commitAndPr,
  ]) expect([c, findMerge(c)]).toEqual([c, undefined])
  for (const c of [
    'PAGER="gh pr merge 4" gh pr view 4',
    'GH_PAGER="gh pr merge 4" gh pr view 4',
    'X="gh pr merge 4"; $X',
    'echo "$(echo ")" ; gh pr merge 4)"',
    "echo \"$(cat <<'EOF'\n)\nEOF\ngh pr merge 4)\"",
    'echo "$(echo x # )\ngh pr merge 4)"',
    'echo "$(case a in a) echo x;; esac; gh pr merge 4)"',
    'echo "${x%)}$(gh pr merge 4)"',
  ]) expect([c, findMerge(c)?.isClear]).toEqual([c, false])
})

// Catches (CRE-GRD-FP-3, etapa 3, H1 to H3 and B1): a comment with an odd quote swallowed the next line, a
// PowerShell block without `;` hid its command, a redirection glued to the verb hid it, and `gh config set`
// can make gh run a merge as its pager, editor or browser. All passed on main too.
test('rule 3 (FP-3 e3): comments with an odd quote, PowerShell blocks, glued redirections and gh config stop', () => {
  for (const c of [
    "git status # don't\ngh pr merge 4 --merge",
    "gh pr checks 4 # it's green\ngh pr merge 4 --merge",
    "echo listo # it's ok\ngh pr merge 12 --squash",
    "cd /d/x # don't\ngh pr merge 12 --squash",
    'if (Test-Path x) { Write-Host listo } else { gh pr merge 4 --squash }',
    'try { Write-Host x } catch { gh pr merge 4 }',
    'if ($a) { echo a } elseif ($b) { gh pr merge 4 }',
    'gh pr merge>/dev/null 4 --squash',
    'gh pr merge</dev/null 4',
    'gh pr merge<<<x 4',
    'gh pr checks 4 && gh pr merge>x 4',
    "gh config set pager 'gh pr merge 4'",
    "gh config set editor 'gh pr merge 4'",
    "gh config set browser 'gh pr merge 4'",
    // second closing pass: glued braces and an option before the config key
    'if (Test-Path x) { Write-Host a }else{ gh pr merge 4 --squash }',
    'try { Write-Host a }catch{ gh pr merge 4 }',
    'try { Write-Host a }finally{ gh pr merge 4 }',
    "gh config set -h github.com pager 'gh pr merge 4'",
  ]) expect([c, findMerge(c)?.isClear]).toEqual([c, false])
  for (const c of [
    "git status # it's fine\ngit log -1",
    'if (Test-Path x) { Write-Host listo } else { gh pr view 4 }',
    'gh pr view 4 2>&1',
    'gh config set pager cat',
    'gh config get pager',
  ]) expect([c, findMerge(c)]).toEqual([c, undefined])
})

// Catches (CRE-GRD-FP-3, ronda 3, D1): a here-document line starting with a lone code span stopped in a text
// that names gh and PR; a span glued to letters (L5) still stops.
test('rule 3 (FP-3 r3): a here-document line that starts with a lone code span passes; a span glued to a name stops', () => {
  const body = "gh pr create --title x --body \"$(cat <<'EOF'\n`rules.ts` cambia la regla 3 de este PR\n`campo-1` se lee con gh pr view 4\nEOF\n)\""
  expect(findMerge(body)).toBeUndefined()
  for (const c of [
    'gh pr view 4 -q "$(g`echo h` pr mer$x 4)"',
    'gh pr view 4 -q "$(`rev<<<hg` pr mer$x 4)"',
  ]) expect([c, findMerge(c)?.isClear]).toEqual([c, false])
})

// Catches (CRE-GRD-FP-3, ronda 2, X1): every backtick was judged over the rest of the command, and each
// piece re-read the whole text, so a PR body full of code spans took seconds.
test('rule 3 (FP-3 r2): a body with 400 backticks is judged fast and still passes', () => {
  // One span per line, each line naming gh: before the fix, about 4.7 s here with 400 backticks; now a few ms.
  const lines = Array.from({ length: 200 }, (_, i) => `- \`campo${i}\` se lee con gh pr view 4`).join('\n')
  const c = `gh pr create --title x --body "$(cat <<'EOF'\n${lines}\nEOF\n)"`
  const start = performance.now()
  const found = findMerge(c)
  const ms = performance.now() - start
  expect(found).toBeUndefined()
  // Wide margin for slower runners (the CI's windows-latest).
  expect(ms).toBeLessThan(1000)
})

test('rule 3: the role from the user messages; any sign of the worker wins', () => {
  const ORQ = 'Lee y aplica las reglas de `C:\\repos\\creador\\skills\\orquestador\\SKILL.md`'
  const TRAB = 'Background: …\n\nTask:\nLee y aplica las reglas de `C:\\repos\\creador\\skills\\trabajador\\SKILL.md`\n\n```\nProyecto: x\n```'
  expect(roleOf([ORQ])).toBe('orquestador')
  expect(roleOf(['hola', 'Base directory for this skill: C:\\x\n\n# Rol: ORQUESTADOR\n\nEres…'])).toBe('orquestador')
  expect(roleOf(['<command-name>/orquestador</command-name>'])).toBe('orquestador')
  expect(roleOf([TRAB])).toBe('trabajador')
  expect(roleOf([TRAB, ORQ])).toBe('trabajador')
  expect(roleOf(['# Rol: TRABAJADOR', '<command-name>/orquestador</command-name>'])).toBe('trabajador')
  expect(roleOf(['revisa skills/orquestador/SKILL.md y skills/trabajador/SKILL.md'])).toBeUndefined()
  expect(roleOf(['<cross-session-message from-name="Creador · orquestador">Aprobado. Sigue</cross-session-message>'])).toBeUndefined()
  expect(roleOf([])).toBeUndefined()
})

// The real skill files are read in tests/rol-skills-reales.mjs (node): this
// harness reads no files. Here, the shape that broke it (A1).
const ORQ_SKILL = '---\nname: orquestador\n---\n\n# Rol: ORQUESTADOR\n\nEres el director…\n\n2. **Cómo lanzar:** … Primer mensaje: ' +
  '«Lee y aplica las reglas de `C:\\repos\\creador\\skills\\trabajador\\SKILL.md`», seguido de la orden completa.\n'

test('rule 3 (A1): the orchestrator skill quoting the worker launch line is still the orchestrator', () => {
  const TAG = '<command-message>orquestador</command-message>\n<command-name>/orquestador</command-name>'
  expect(roleOf([`${TAG}\n${ORQ_SKILL}`])).toBe('orquestador')
  expect(roleOf([TAG, `Base directory for this skill: C:\\Users\\usuario\\.claude\\skills\\orquestador\n\n${ORQ_SKILL.replace(/^---[\s\S]*?---\n/, '')}`])).toBe('orquestador')
  // The real worker: the launch line first, then an order that names the orchestrator.
  const WORKER_FIRST = 'Task:\nLee y aplica las reglas de `C:\\repos\\creador\\skills\\trabajador\\SKILL.md`\n\n```\n' +
    'Fusionar: lo hace el orquestador (Lee y aplica las reglas de `C:\\repos\\creador\\skills\\orquestador\\SKILL.md`)\n```'
  expect(roleOf([WORKER_FIRST])).toBe('trabajador')
  expect(roleOf([WORKER_FIRST, `${TAG}\n${ORQ_SKILL}`])).toBe('trabajador')
  // A heading deeper in a message is no skill text: the launch line beside it still counts.
  expect(roleOf(['Lee y aplica las reglas de `D:\\x\\skills\\trabajador\\SKILL.md`\n\n# Rol: ORQUESTADOR'])).toBe('trabajador')
  // A text that opens with the orchestrator heading but launches the worker at a line start: the worker wins.
  expect(roleOf(['# Rol: ORQUESTADOR\n\nx\n\nLee y aplica las reglas de `D:\\x\\skills\\trabajador\\SKILL.md`'])).toBe('trabajador')
  expect(roleOf(['# Rol: ORQUESTADOR\n  Lee y aplica las reglas de `D:\\x\\skills\\trabajador\\SKILL.md`'])).toBe('trabajador')
})

// CRE-GRD-ROL-1: the shapes of a real transcript. A pasted block (its closing tag carries the id too)
// that opens with the orchestrator's launch line and quotes the worker's mid-line; then `/orquestador`.
const W_LAUNCH = 'Lee y aplica las reglas de `C:\\repos\\creador\\.claude\\worktrees\\x\\skills\\trabajador\\SKILL.md`'
const O_LAUNCH = 'Lee y aplica las reglas de `C:\\repos\\creador\\.claude\\worktrees\\x\\skills\\orquestador\\SKILL.md`'
const paste = (body: string) => `\n\n<pasted_content id="89e2">\n${body}\n</pasted_content id="89e2">\n`
const PILOT = paste(`${O_LAUNCH}.\r\n\r\nEsto es un piloto.\n\n2. Al lanzar al trabajador, su primera línea es «${W_LAUNCH}», y nada más.`)
const INVOKE = '<command-message>orquestador</command-message>\n<command-name>/orquestador</command-name>\n<command-args>reintenta la fusión del PR 6</command-args>'
const ORQ_SKILL_TEXT = `Base directory for this skill: C:\\Users\\usuario\\.claude\\skills\\orquestador\n\n${ORQ_SKILL.replace(/^---[\s\S]*?---\n/, '')}`
// The first message of a session another one started, as the engine hands it.
const REAL_WORKER = '<system-reminder>\nYou are operating in a git worktree.\nWorktree path: C:\\repos\\creador\\.claude\\worktrees\\x\n' +
  'Worktree name: x\n</system-reminder>\n\n' +
  `Background (from the session that started this one):\nCreador es el repo del método.\n\nTask:\n${W_LAUNCH}\n\nProyecto: x\nId: X-1`

test('rule 3 (CRE-GRD-ROL-1): a pasted block quoting the worker launch, then a real /orquestador, is the orchestrator', () => {
  expect(roleOf([PILOT, INVOKE, ORQ_SKILL_TEXT])).toBe('orquestador')
  expect(roleOf(['hola', PILOT, 'fusiona el PR 6', INVOKE])).toBe('orquestador')
  // Without the later invocation the weak sign still wins.
  expect(roleOf([PILOT])).toBe('trabajador')
  expect(roleOf([PILOT, 'fusiona el PR 6'])).toBe('trabajador')
  // Mid-line outside a paste is weak too; the invocation may come without <command-message>.
  expect(roleOf([`Su primera línea es «${W_LAUNCH}».`, '<command-name>/orquestador</command-name>'])).toBe('orquestador')
  // Inside a paste even a launch line that starts a line, or one in a ``` block, is weak.
  for (const body of [W_LAUNCH, `Bloque de piloto:\n\`\`\`\n${W_LAUNCH}\n\`\`\``, `<command-name>/trabajador</command-name>`, '# Rol: TRABAJADOR']) {
    expect(roleOf([paste(body), INVOKE])).toBe('orquestador')
    expect(roleOf([paste(body)])).toBe('trabajador')
    expect(roleOf([O_LAUNCH, paste(body)])).toBe('trabajador')
  }
})

test('rule 3 (CRE-GRD-ROL-1): only a real /orquestador after a weak sign clears it; firm signs stay', () => {
  // The invocation clears only what came before, never the weak signs of its own message.
  expect(roleOf([INVOKE, PILOT])).toBe('trabajador')
  expect(roleOf([PILOT, INVOKE, PILOT])).toBe('trabajador')
  expect(roleOf([PILOT, INVOKE.replace('reintenta', `reintenta; su primera línea es «${W_LAUNCH}»`)])).toBe('trabajador')
  expect(roleOf([`<command-message>orquestador</command-message>\n<command-name>/orquestador</command-name>\n<command-args>según «${W_LAUNCH}»</command-args>`]))
    .toBe('trabajador')
  // A tag that does not open the message is no invocation: quoted, pasted or from another session.
  for (const quoted of [
    'x <command-name>/orquestador</command-name>',
    paste('<command-message>orquestador</command-message>\n<command-name>/orquestador</command-name>'),
    '<cross-session-message from-name="Creador · orquestador"><command-name>/orquestador</command-name></cross-session-message>',
    `<system-reminder>x</system-reminder>\n${INVOKE}`,
  ]) expect(roleOf([PILOT, quoted])).toBe('trabajador')
  // A pasted tag left open, closed twice or nested fails closed: its signs are firm.
  for (const broken of [
    `<pasted_content id="1">\n${W_LAUNCH}\n`,
    `${W_LAUNCH}\n</pasted_content>`,
    `<pasted_content id="1">\n<pasted_content id="2">\n${W_LAUNCH}\n</pasted_content>\n</pasted_content>`,
    `<pasted_content id="1">\nx\n</pasted_content>\n</pasted_content>\n${W_LAUNCH}`,
    `<pasted_content id="1">\nsu línea es «${W_LAUNCH}»\n`,
  ]) expect(roleOf([broken, INVOKE])).toBe('trabajador')
  // Firm signs of the worker: no later invocation undoes them.
  for (const firm of [`${W_LAUNCH}\n\nProyecto: x`, '  ' + W_LAUNCH, '<command-name>/trabajador</command-name>', '# Rol: TRABAJADOR', 'hola\n# Rol: TRABAJADOR']) {
    expect(roleOf([firm, INVOKE, ORQ_SKILL_TEXT])).toBe('trabajador')
  }
})

// Round 1: a child's report reaches the orchestrator inside <system-reminder>, and another session's
// message inside <cross-session-message>, both with their line breaks: a forwarded order quotes the
// worker launch at a line start.
const CHILD_REPORT = '<system-reminder>\nThe session "Creador · trabajador · X-1" you started (local_1) finished a turn. ' +
  `It reported (quoted child output):\n### Orden completa\n${W_LAUNCH}\n\nProyecto: x\n</system-reminder>`
const FORWARDED = `Another Claude session sent a message:\n<cross-session-message from="local_1" from-name="Creador · trabajador">\n` +
  `Mi orden:\n${W_LAUNCH}\n\nProyecto: x\n</cross-session-message>`

test('rule 3 (CRE-GRD-ROL-1, round 1): a worker sign inside a reminder or another session\'s message is weak', () => {
  for (const quoting of [CHILD_REPORT, FORWARDED, `${CHILD_REPORT}\n\n<system-reminder>\notro aviso\n</system-reminder>`]) {
    expect(roleOf([O_LAUNCH, quoting, INVOKE])).toBe('orquestador')
    expect(roleOf([O_LAUNCH, quoting])).toBe('trabajador')
  }
  // Inside a block, other tags are text: a report may quote `<pasted_content>` or `<system-reminder>`.
  const quotingTags = CHILD_REPORT.replace('### Orden', 'detrás de un `<system-reminder>` y un `<pasted_content>`\n### Orden')
  expect(roleOf([O_LAUNCH, quotingTags, INVOKE])).toBe('orquestador')
  expect(roleOf([O_LAUNCH, FORWARDED.replace('Mi orden:', 'cita `<pasted_content id="1">` y `</pasted_content>`:'), INVOKE])).toBe('orquestador')
  // An invocation inside those blocks is no real one.
  for (const inside of [
    '<system-reminder>\n<command-message>orquestador</command-message>\n<command-name>/orquestador</command-name>\n</system-reminder>',
    `<cross-session-message from="local_1">\n${INVOKE}\n</cross-session-message>`,
  ]) expect(roleOf([O_LAUNCH, CHILD_REPORT, inside])).toBe('trabajador')
  // A block left open or closed twice fails closed: its signs are firm.
  for (const broken of [
    CHILD_REPORT.replace('</system-reminder>', ''),
    FORWARDED.replace('</cross-session-message>', ''),
    `<system-reminder>\nx\n</system-reminder>\n</cross-session-message>\n${W_LAUNCH}`,
  ]) expect(roleOf([O_LAUNCH, broken, INVOKE])).toBe('trabajador')
  // Round 2: a closing tag with no block is text, not a failure (only an open block fails closed).
  expect(roleOf([O_LAUNCH, `${CHILD_REPORT}\n</system-reminder>`, INVOKE])).toBe('orquestador')
})

// Round 2 (M1): only the engine's form opens a block. An order that names the tags around the
// worker launch line (before it in the Background, after it in the order) leaves the launch firm.
test('rule 3 (CRE-GRD-ROL-1, round 2): tags named in a real launch open no block; the launch stays firm', () => {
  for (const [open, close] of [
    ['`<pasted_content>`', '`</pasted_content>`'],
    ['<pasted_content id="1">', '</pasted_content id="1">'],
    ['`<system-reminder>`', '`</system-reminder>`'],
    ['<cross-session-message from="x">', '</cross-session-message>'],
  ]) {
    const launch = REAL_WORKER.replace('Creador es el repo del método.', `Habla de las etiquetas entre ${open} y lo demás.`) +
      `\n\nContexto: cierra con ${close} al final.`
    expect(roleOf([launch])).toBe('trabajador')
    expect(roleOf([launch, INVOKE, ORQ_SKILL_TEXT])).toBe('trabajador')
  }
  // A pasted block without the engine's id, or with another id on the closing, is no block either.
  for (const text of [`<pasted_content>\n${W_LAUNCH}\n</pasted_content>`, `<pasted_content id="1">\n${W_LAUNCH}\n</pasted_content id="2">`]) {
    expect(roleOf([O_LAUNCH, text, INVOKE])).toBe('trabajador')
  }
})

// Round 3 (M1'): a Background that shows a block's opening at a line start (an example in a ``` block)
// and an order that names its closing after the launch line. In a session launch the line right
// after «Task:» is firm whatever surrounds it; an opening must not cross lines, and `<\x>` closes nothing.
const launchAround = (open: string, close: string) =>
  '<system-reminder>\nYou are operating in a git worktree.\nWorktree path: C:\\repos\\creador\\.claude\\worktrees\\x\nWorktree name: x\n</system-reminder>\n\n' +
  `Background (from the session that started this one):\nEjemplo de aviso:\n\`\`\`\n${open}\nThe session finished a turn.\n\`\`\`\n\n` +
  `Task:\n${W_LAUNCH}\n\nProyecto: x. El aviso termina en ${close} y sigue.`

test('rule 3 (CRE-GRD-ROL-1, round 3): the launch line right after Task: is firm whatever surrounds it', () => {
  const cases: Array<[string, string]> = [
    ...['system-reminder', 'cross-session-message', 'agent-message', 'task-notification', 'side-sessions-event']
      .map((k): [string, string] => [`<${k}>`, `</${k}>`]),
    ['<pasted_content id="7">', '</pasted_content id="7">'],
    ['<system-reminder>', '<\\system-reminder>'],
    ['<system-reminder from="x\ny">', '</system-reminder>'],
  ]
  for (const [open, close] of cases) {
    const launch = launchAround(open, close)
    expect(roleOf([launch])).toBe('trabajador')
    expect(roleOf([launch, INVOKE, ORQ_SKILL_TEXT])).toBe('trabajador')
  }
  // The same line elsewhere stays as before: not after «Task:», or no session launch (text before Background).
  const inBlock = '<system-reminder>\nx\n</system-reminder>\n\nBackground (from the session that started this one):\n' +
    `<system-reminder>\nTask:\n${W_LAUNCH}\n</system-reminder>`
  expect(roleOf([O_LAUNCH, `Nota.\n${inBlock}`, INVOKE])).toBe('orquestador')
  expect(roleOf([O_LAUNCH, inBlock.replace('Task:\n', 'Tarea:\n'), INVOKE])).toBe('orquestador')
  expect(roleOf([O_LAUNCH, inBlock, INVOKE])).toBe('trabajador')
})

// Round 3 (B-b): a `/trabajador` tag pasted in the invocation's own arguments stays weak there;
// it would be cleared if the clearing moved after the loop over command-name tags.
test('rule 3 (CRE-GRD-ROL-1, round 3): a /trabajador tag in the invocation\'s own arguments stays', () => {
  const withTag = '<command-message>orquestador</command-message>\n<command-name>/orquestador</command-name>\n' +
    `<command-args>mira${paste('<command-name>/trabajador</command-name>')}</command-args>`
  expect(roleOf([O_LAUNCH, withTag])).toBe('trabajador')
  expect(roleOf([O_LAUNCH, withTag, INVOKE])).toBe('orquestador')
})

// Round 2 (M2): subagent reports, task notifications, side-session events and compaction summaries
// quote too. The shapes are those of the local transcripts.
test('rule 3 (CRE-GRD-ROL-1, round 2): reports, notifications, events and compaction summaries are weak', () => {
  const quoting = [
    `Another Claude session sent a message:\n<agent-message from="a42695e0e7158d8f8">\n[Subagent hand-back] The text below is the final report.\n${W_LAUNCH}\n</agent-message>`,
    `<task-notification>\n<task-id>a85f7a050badb6e10</task-id>\n<result>\n${W_LAUNCH}\n</result>\n</task-notification>`,
    `<side-sessions-event>Their notes are above.\n${W_LAUNCH}</side-sessions-event>`,
    'This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.\n\n' +
      `Primary Request:\n${W_LAUNCH}\n<system-reminder>\nsin cierre`,
    '<artifact-content-authored-by-others/>\nThe summarized conversation included Artifact content written by people other than you.\n' +
      `This session is being continued from a previous conversation that ran out of context.\n\n${W_LAUNCH}`,
  ]
  for (const q of quoting) {
    expect(roleOf([O_LAUNCH, q, INVOKE])).toBe('orquestador')
    expect(roleOf([O_LAUNCH, q])).toBe('trabajador')
  }
  // The summary's sentence anywhere else is no summary.
  expect(roleOf([`Nota:\nThis session is being continued from a previous conversation.\n${W_LAUNCH}`, INVOKE])).toBe('trabajador')
  expect(roleOf([REAL_WORKER, quoting[3] ?? '', INVOKE])).toBe('trabajador')
})

// Round 2 (B4): the invocation clears only the weak signs before it. A weak sign in its own message
// (a block pasted in its arguments) stays; it would not if the clearing moved after reading the message.
test('rule 3 (CRE-GRD-ROL-1, round 2): a weak sign in the invocation\'s own message stays', () => {
  const withPaste = `<command-message>orquestador</command-message>\n<command-name>/orquestador</command-name>\n<command-args>mira esto${paste(W_LAUNCH)}</command-args>`
  expect(roleOf([O_LAUNCH, withPaste])).toBe('trabajador')
  expect(roleOf([O_LAUNCH, withPaste, INVOKE])).toBe('orquestador')
})

test('rule 3 (CRE-GRD-ROL-1): the real worker launch stays the worker whatever comes later', () => {
  expect(roleOf([REAL_WORKER])).toBe('trabajador')
  for (const later of [
    'el orquestador relanza con <command-name>/orquestador</command-name>',
    `Al cerrar:\n${O_LAUNCH}`,
    `<cross-session-message from-name="Creador · orquestador">${O_LAUNCH}\nSigue con la etapa 2.</cross-session-message>`,
    paste(`${O_LAUNCH}\nx`),
    CHILD_REPORT,
    FORWARDED,
    INVOKE,
  ]) {
    expect(roleOf([REAL_WORKER, later])).toBe('trabajador')
    expect(roleOf([REAL_WORKER, later, INVOKE, ORQ_SKILL_TEXT])).toBe('trabajador')
  }
})

test('rule 3 (B2): the production line of AGENTS.md counts only in its exact form', () => {
  expect(publishesOnMerge('# A\n- Fusionar publica en producción: no\n')).toEqual({ value: 'no', line: '- Fusionar publica en producción: no' })
  expect(publishesOnMerge('- Fusionar publica en producción: no. Nada se despliega.')?.value).toBe('no')
  expect(publishesOnMerge('- Fusionar publica en producción: sí. Nada se despliega')?.value).toBe('sí')
  expect(publishesOnMerge('- Fusionar publica en produccio\u0301n: no')?.value).toBe('no')
  for (const other of [
    '- **Fusionar publica en producción:** no',
    'Fusionar publica en producción: no',
    '  - Fusionar publica en producción: no',
    '- fusionar publica en producción: no',
    '- Fusionar publica en produccion: no',
    '- Fusionar publica en producción: No',
    '- Fusionar publica en producción:no',
    '- Fusionar publica en producción: nop',
    '```\n- Fusionar publica en producción: no\n```',
    '# A\n- Qué publica: nada\n',
  ]) expect(publishesOnMerge(other)).toBeUndefined()
  // Two lines that disagree: «sí» wins.
  expect(publishesOnMerge('- Fusionar publica en producción: no\n- Fusionar publica en producción: sí')?.value).toBe('sí')
})

const user = (text: string) => ({ role: 'user' as const, text, toolUses: [] })
const ORCHESTRATOR = [user('Lee y aplica las reglas de `C:\\repos\\creador\\skills\\orquestador\\SKILL.md`')]
const WORKER = [user('Lee y aplica las reglas de `C:\\repos\\creador\\skills\\trabajador\\SKILL.md`')]

const NO = '# A\n- Fusionar publica en producción: no\n'
const YES = '# A\n- Fusionar publica en producción: sí\n'

// A repo whose origin is github.com/a/<name> and whose PR 12 is there.
const own = (name: string, base?: string) => ({
  originUrl: `https://github.com/a/${name}.git`,
  pr: { url: `https://github.com/a/${name}/pull/12`, ...(base === undefined ? {} : { baseRefName: base }) },
})

const MERGE_REPOS: Repo[] = [
  { root: 'D:/t/libre', branch: 'tarea/x', files: { 'AGENTS.md': NO, 'PROGRESS.md': CLOSED }, remote: { main: { 'AGENTS.md': NO } }, ...own('libre', 'main') },
  { root: 'D:/t/prod', branch: 'tarea/x', files: { 'AGENTS.md': YES }, remote: { main: { 'AGENTS.md': YES } }, ...own('prod', 'main') },
  // M2: the PR's own branch says «no»; the base on origin says «sí».
  { root: 'D:/t/rama-cambia', branch: 'tarea/x', files: { 'AGENTS.md': NO }, remote: { main: { 'AGENTS.md': YES } }, ...own('rama-cambia', 'main') },
  // The base gh names wins over origin/HEAD; with none, origin/HEAD.
  { root: 'D:/t/base-dev', branch: 'tarea/x', files: {}, remote: { main: { 'AGENTS.md': YES }, develop: { 'AGENTS.md': NO } }, ...own('base-dev', 'develop') },
  { root: 'D:/t/sin-base', branch: 'tarea/x', files: {}, remote: { main: { 'AGENTS.md': NO } }, ...own('sin-base') },
  { root: 'D:/t/base-rara', branch: 'tarea/x', files: {}, remote: { main: { 'AGENTS.md': YES } }, ...own('base-rara', '--upload-pack=x') },
  // A base gh names but that is no plain branch name stops, never falls back to origin/HEAD.
  { root: 'D:/t/base-acento', branch: 'tarea/x', files: {}, remote: { main: { 'AGENTS.md': NO }, 'tarea/añadir': { 'AGENTS.md': YES } }, ...own('base-acento', 'tarea/añadir') },
  { root: 'D:/t/negrita', branch: 'tarea/x', files: {}, remote: { main: { 'AGENTS.md': '- **Fusionar publica en producción:** no\n' } }, ...own('negrita', 'main') },
  { root: 'D:/t/sin-linea', branch: 'tarea/x', files: {}, remote: { main: { 'AGENTS.md': '# A\n- Qué publica: el sitio\n' } }, ...own('sin-linea', 'main') },
  { root: 'D:/t/sin-agents', branch: 'tarea/x', files: {}, remote: { main: { 'README.md': '# r' } }, ...own('sin-agents', 'main') },
  // The PR is not of origin's repo (gh repo set-default upstream), or that cannot be read.
  { root: 'D:/t/upstream', branch: 'tarea/x', files: {}, remote: { main: { 'AGENTS.md': NO } }, originUrl: 'git@github.com:a/fork.git', pr: { url: 'https://github.com/b/upstream/pull/12', baseRefName: 'main' } },
  { root: 'D:/t/sin-remoto', branch: 'tarea/x', files: { 'AGENTS.md': NO }, pr: { url: 'https://github.com/a/sin-remoto/pull/12', baseRefName: 'main' } },
  { root: 'D:/t/sin-gh', branch: 'tarea/x', files: {}, remote: { main: { 'AGENTS.md': NO } }, originUrl: 'https://github.com/a/sin-gh' },
  { root: 'D:/t/gh-sin-url', branch: 'tarea/x', files: {}, remote: { main: { 'AGENTS.md': NO } }, originUrl: 'https://github.com/a/x', pr: { baseRefName: 'main' } },
]

test('rule 3: only the orchestrator merges, and only where the remote base says merging does not publish', async ($, on) => {
  let messages = ORCHESTRATOR
  on('session.messages', () => ({ value: messages }))
  mock.env(on, {})
  const ran = setup(on, MERGE_REPOS, 'D:/t/libre')
  const merge = (command = 'gh pr merge 12 --merge') => $.tool.call({ tool: 'Bash', command })

  expect(refusal(await merge())).toBeUndefined()
  expect(refusal(await $.tool.call({ tool: 'PowerShell', command: 'gh pr merge 12 --merge' }))).toBeUndefined()
  expect(refusal(await merge('cd D:/t/base-dev && gh pr merge 12 --merge'))).toBeUndefined()
  expect(refusal(await merge('cd D:/t/sin-base && gh pr merge 12 --merge'))).toBeUndefined()
  expect(ran()).toBe(4)
  for (const dir of ['D:/t/prod', 'D:/t/rama-cambia', 'D:/t/base-rara', 'D:/t/base-acento', 'D:/t/negrita', 'D:/t/sin-linea', 'D:/t/sin-agents', 'D:/t/no-es-repo']) {
    expect(refusal(await merge(`cd ${dir} && gh pr merge 12 --merge`))).toContain('producción')
  }
  expect(refusal(await merge('cd D:/t/no-es-repo && gh pr merge 12 --merge'))).toContain('rama base remota')
  expect(refusal(await merge('cd D:/t/base-acento && gh pr merge 12 --merge'))).toContain('rama base remota')
  expect(refusal(await merge('cd D:/t/rama-cambia && gh pr merge 12 --merge'))).toContain('- Fusionar publica en producción: sí')
  for (const dir of ['D:/t/upstream', 'D:/t/sin-remoto', 'D:/t/sin-gh', 'D:/t/gh-sin-url']) {
    expect(refusal(await merge(`cd ${dir} && gh pr merge 12 --merge`))).toContain('repo de `origin`')
  }
  expect(refusal(await merge('cd D:/t/upstream && gh pr merge 12 --merge'))).toContain('github.com/b/upstream')
  expect(refusal(await merge('bash -c "gh pr merge 12"'))).toContain('no lo entiendo')
  expect(refusal(await merge('gh pr merge https://github.com/mrKanoh/portafolio-web/pull/5 --merge'))).toContain('no lo entiendo')
  expect(refusal(await merge('export GH_REPO=x/y; gh pr merge 5 --merge'))).toContain('no lo entiendo')
  // CRE-GRD-FP-3: the refusal says what made it unclear and how a read-only look passes.
  const why = refusal(await merge('node --test t/*.test.mjs && gh pr view 12 --json isDraft -q .isDraft')) ?? ''
  expect(why).toContain('intérprete `node` en un comando que nombra `gh`')
  expect(why).toContain('llamada aparte')
  expect(refusal(await merge('gh pr view 12 -q "$(gh pr merge 12 --admin)"'))).toContain('sustitución')
  expect(ran()).toBe(4)

  messages = [user('<command-message>orquestador</command-message>\n<command-name>/orquestador</command-name>'), user(ORQ_SKILL)]
  expect(refusal(await merge())).toBeUndefined()
  expect(ran()).toBe(5)

  messages = WORKER
  expect(refusal(await merge())).toContain('solo el orquestador')
  messages = [...ORCHESTRATOR, ...WORKER]
  expect(refusal(await merge())).toContain('solo el orquestador')
  messages = [user('fusiona el PR 12')]
  expect(refusal(await merge())).toContain('solo el orquestador')
  expect(refusal(await merge('gh pr view 12'))).toBeUndefined()
  expect(ran()).toBe(6)
})

// CRE-GRD-ROL-1 through the engine: the pilot's paste stops the merge until a real /orquestador;
// the worker launched by the sessions tool never merges.
test('rule 3 (CRE-GRD-ROL-1): a paste quoting the worker launch stops until /orquestador; a real worker never merges', async ($, on) => {
  let messages = [user(PILOT)]
  on('session.messages', () => ({ value: messages }))
  mock.env(on, {})
  const ran = setup(on, MERGE_REPOS, 'D:/t/libre')
  const merge = () => $.tool.call({ tool: 'Bash', command: 'gh pr merge 12 --merge' })

  expect(refusal(await merge())).toContain('solo el orquestador')
  messages = [user(PILOT), user(INVOKE), user(ORQ_SKILL_TEXT)]
  expect(refusal(await merge())).toBeUndefined()
  expect(ran()).toBe(1)
  messages = [user(REAL_WORKER), user(INVOKE), user(ORQ_SKILL_TEXT)]
  expect(refusal(await merge())).toContain('solo el orquestador')
  messages = [user(REAL_WORKER), user(PILOT), user(INVOKE)]
  expect(refusal(await merge())).toContain('solo el orquestador')
  expect(ran()).toBe(1)
  // Round 1: a child's report that forwards the worker launch, then a real /orquestador.
  messages = [user(O_LAUNCH), user(CHILD_REPORT)]
  expect(refusal(await merge())).toContain('solo el orquestador')
  messages = [user(O_LAUNCH), user(CHILD_REPORT), user(FORWARDED), user(INVOKE)]
  expect(refusal(await merge())).toBeUndefined()
  expect(ran()).toBe(2)
})

// Catches (CRE-GRD-FP-1, R3 and R4): after a compaction the orchestrator's sign is gone, and a merge in a
// project that publishes was refused for the role, hiding the real reason. The production line is
// read first; the role message says how the sign comes back.
test('rule 3 (R3, R4): the production line is checked before the role', async ($, on) => {
  let messages = [user('fusiona el PR 12')]
  on('session.messages', () => ({ value: messages }))
  mock.env(on, {})
  const ran = setup(on, MERGE_REPOS, 'D:/t/libre')
  const merge = (dir: string) => $.tool.call({ tool: 'Bash', command: `cd ${dir} && gh pr merge 12 --merge` })
  // «sí», no line and no AGENTS.md: the production message, with no sign of any role.
  for (const dir of ['D:/t/prod', 'D:/t/sin-linea', 'D:/t/sin-agents']) {
    for (const m of [[user('fusiona el PR 12')], WORKER, ORCHESTRATOR]) {
      messages = m
      const text = refusal(await merge(dir)) ?? ''
      expect([dir, text]).toEqual([dir, expect.stringContaining('fusionar publica en producción')])
      expect(text).not.toContain('solo el orquestador')
    }
  }
  // «no», no sign of the orchestrator (or a worker's): the role message, with the way back.
  for (const m of [[user('fusiona el PR 12')], WORKER, [...ORCHESTRATOR, ...WORKER]]) {
    messages = m
    const text = refusal(await merge('D:/t/base-dev')) ?? ''
    expect(text).toContain('solo el orquestador')
    expect(text).toContain('compactación')
    expect(text).toContain('/orquestador')
    expect(text).toContain('fusiona el responsable')
    expect(text).toContain('nunca fusiones')
  }
  // «no» and the orchestrator: passes. A repo that is not origin's still stops, now with its own message.
  messages = ORCHESTRATOR
  expect(refusal(await merge('D:/t/base-dev'))).toBeUndefined()
  expect(refusal(await merge('D:/t/upstream'))).toContain('repo de `origin`')
  messages = [user('fusiona el PR 12')]
  expect(refusal(await merge('D:/t/upstream'))).toContain('repo de `origin`')
  expect(ran()).toBe(1)
})

test('rule 3: the repo of a PR URL and of a remote URL', () => {
  for (const url of [
    'https://github.com/a/b/pull/12', 'https://github.com/A/B.git', 'https://github.com/a/b/', 'https://user@github.com/a/b.git',
    'git@github.com:a/b.git', 'ssh://git@github.com/a/b', 'ssh://git@github.com:22/a/b.git', 'https://github.com/a/b\n',
  ]) expect(repoOf(url)).toBe('github.com/a/b')
  expect(repoOf('https://github.com/a/b.c/pull/3')).toBe('github.com/a/b.c')
  for (const url of ['', 'D:/repo', '../origen.git', 'https://github.com/a', 'https://github.com/a/b/issues/3', 'file:///D:/x/a/b']) {
    expect(repoOf(url)).toBeUndefined()
  }
})

for (const variables of [{ GH_REPO: 'mrKanoh/portafolio-web' }, { GH_HOST: 'ghe.example.com' }]) {
  test(`rule 3 (A2): ${Object.keys(variables)[0]} in the environment stops the merge`, async ($, on) => {
    on('session.messages', () => ({ value: ORCHESTRATOR }))
    mock.env(on, variables)
    const ran = setup(on, MERGE_REPOS, 'D:/t/libre')
    expect(refusal(await $.tool.call({ tool: 'Bash', command: 'gh pr merge 12 --merge' }))).toContain('GH_REPO')
    expect(refusal(await $.tool.call({ tool: 'Bash', command: 'gh pr view 12' }))).toBeUndefined()
    expect(ran()).toBe(1)
  })
}

test('rule 3: a failing check stops the merge only', async ($, on) => {
  let ran = 0
  on('session.cwd', () => ({ value: 'D:/t/libre' }))
  on('session.messages', () => {
    throw new Error('no messages')
  })
  on('tool.call', () => {
    ran++
    return { result: {} }
  })
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'gh pr merge 12 --merge' }))).toContain('no pude comprobar')
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'gh pr view 12' }))).toBeUndefined()
  expect(ran).toBe(1)
})

// Rule 7 (CRE-PUSH-1): a push passes only in a clear form, in any folder and shell, with its own messages.
test('rule 7: a push outside the clear form stops in any folder and shell; clear forms and texts run', async ($, on) => {
  let cwd = 'C:\\repos\\otro'
  let ran = 0
  on('session.cwd', () => ({ value: cwd }))
  on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('tool.call', () => {
    ran++
    return { result: {} }
  })
  const call = (tool: 'Bash' | 'PowerShell', command: string) => $.tool.call({ tool, command })
  for (const folder of ['C:\\repos\\otro', 'C:\\repos\\creador', 'C:\\repos\\creador\\.claude\\worktrees\\x']) {
    cwd = folder
    for (const [tool, command] of [
      ['Bash', 'git push origin'], ['PowerShell', 'git push -u origin'], ['Bash', 'git push origin tarea/x -uf'],
      ['PowerShell', 'git -C . push -u origin tarea/x'], ['Bash', 'git push origin tarea/x ref*'],
    ] as const) {
      const r = refusal(await call(tool, command))
      expect([folder, command, r?.includes('no está en la forma clara'), r?.includes('lo hace el responsable')]).toEqual([folder, command, true, true])
    }
    for (const [tool, command] of [['Bash', 'bash -c "git push origin main"'], ['PowerShell', '$g push origin main']] as const) {
      expect([folder, command, refusal(await call(tool, command))?.includes('no lo entiendo con certeza')]).toEqual([folder, command, true])
    }
    for (const [tool, command] of [
      ['Bash', 'git push -u origin tarea/cre-push-1'], ['PowerShell', 'git push origin --delete tarea/cre-push-1 2>&1'],
      ['Bash', 'git branch -d tarea/cre-push-1'], ['Bash', 'git -C . commit -m "nota sobre push"'],
    ] as const) {
      expect([folder, command, refusal(await call(tool, command))]).toEqual([folder, command, undefined])
    }
  }
  expect(ran).toBe(12)
})

// The catch of register.ts applies rule 7 when the session folder cannot be read: rule 7 runs
// after `$.session.cwd()`, so here only the catch can stop it (M2 of the stage 2 audit).
test('rule 7: when the session folder cannot be read, the catch still stops a push outside the clear form', async ($, on) => {
  let ran = 0
  on('session.cwd', () => {
    throw new Error('no cwd')
  })
  on('tool.call', () => {
    ran++
    return { result: {} }
  })
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'git push origin' }))).toContain('no está en la forma clara')
  expect(refusal(await $.tool.call({ tool: 'PowerShell', command: 'git push origin tarea/x -uf' }))).toContain('no está en la forma clara')
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'bash -c "git push origin main"' }))).toContain('no lo entiendo con certeza')
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'git push -u origin tarea/x' }))).toBeUndefined()
  // B5 of round 2: the catch keeps the main handler's order, rule 6 before rule 7.
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'git worktree remove x; git push origin main' }))).toContain('no quites un worktree')
  expect(ran).toBe(1)
})
