// Rule 5: in Creador's main folder git does not change the checkout. Pure logic, no `$`.
//
// The installed mods read the main folder in place, so a branch checked out there runs
// live in every session (CRE-GRD-KILL-1). The form is closed, like rule 4's: in that
// folder `git checkout`, `git switch`, `git restore`, `git worktree` and `gh pr checkout` pass only in a
// clear form, and whatever else touches them that this parse does not follow stops
// (fails closed). Outside the main folder git is not looked at. Nothing here runs.

import { CD, cdTarget, commandName, commandWords, isAbsolutePath, joinPath, NESTED, normalize, segments } from './rules.ts'

const HOW = 'Trabaja en un worktree: `git worktree add C:/repos/creador/.claude/worktrees/<nombre> -b tarea/<nombre> origin/main`. ' +
  'En la carpeta principal solo pasan `git switch main`, `git checkout main`, `git pull [--ff-only]`, `git fetch`, `git status`, `git log`, `git diff` y `git worktree list|add|prune`; `gh pr checkout` tampoco pasa ahí, y quitar un worktree es del responsable (al archivar la sesión, queda en la reserva de la app).'

export const MSG_GITMAIN = (what: string) =>
  `guardia: no cambies la rama ni los archivos en la carpeta principal de Creador (${what}): los mods instalados la leen en el lugar, y el código sin fusionar correría ya en todas las sesiones. ${HOW}`

export const MSG_GITMAIN_UNCLEAR = (what: string) =>
  `guardia: este comando podría cambiar la rama o los archivos de la carpeta principal de Creador (${what}) y no lo entiendo con certeza (variable, comodín, intérprete anidado, \`--git-dir\`, opción desconocida o una forma que no es la clara), así que lo frené. ` +
  `Escribe la ruta literal y la forma exacta. ${HOW}`

export type GitMain = { kind: 'branch' | 'unclear'; why: string }

const MAIN = 'c:/repos/creador'

// The main folder or anything under it, except the worktrees that live in `.claude/worktrees/`.
const isMain = (dir: string) => {
  const p = normalize(dir)
  return (p === MAIN || p.startsWith(`${MAIN}/`)) && !p.startsWith(`${MAIN}/.claude/worktrees/`)
}

// Where `target` leads from `dir`: the home folder (never Creador's), a path, or null when
// it cannot be placed (an expansion, a glob, `-`, or a relative path from an unknown folder).
type Dir = string | null
function resolve(dir: Dir, target: string | undefined): Dir {
  if (target === undefined) return '~'
  if (/^(~|\$home|\$env:userprofile|%userprofile%)([\\/]|$)/i.test(target)) return '~'
  if (target === '-' || /[$%`*?{}()]/.test(target)) return null
  const native = target.replace(/^\/([a-zA-Z])(\/|$)/, '$1:/')
  if (isAbsolutePath(native)) return native
  return dir === null ? null : joinPath(dir, target)
}

// A text that names git and one of the guarded subcommands, for the fail-closed reading.
export const namesGitChange = (text: string) =>
  (/(^|[^a-z0-9_])git([^a-z0-9_]|$)/i.test(text) && /(^|[^a-z0-9_-])(checkout|switch|restore|worktree)([^a-z0-9_-]|$)/i.test(text)) ||
  /(^|[^a-z0-9_])gh(\.exe)?\s+(.*\s)?pr\s+(.*\s)?(checkout|co)(\s|$|['"])/i.test(text)

const GUARDED = new Set(['checkout', 'switch', 'restore', 'worktree'])
const CONTROL = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', '{', '}'])
const PLAIN_OPTIONS = new Set([
  '--no-pager', '-P', '-p', '--paginate', '--no-optional-locks', '--no-replace-objects', '--literal-pathspecs',
  '--glob-pathspecs', '--noglob-pathspecs', '--icase-pathspecs', '--no-advice',
])
const ADD_FLAGS = new Set([
  '-f', '--force', '--detach', '-q', '--quiet', '--lock', '--no-checkout', '--checkout', '--track', '--no-track',
  '--guess-remote', '--no-guess-remote',
])

const excerpt = (words: string[]) => {
  const t = words.join(' ').replace(/\s+/g, ' ').trim()
  return t.length > 60 ? `${t.slice(0, 57)}...` : t
}

// `git worktree <sub> …` in the main folder: list, prune, remove and add (its path outside
// the main checkout, or under `.claude/worktrees/`) pass.
function worktreeOk(args: string[], eff: string): GitMain | undefined {
  const bad = (kind: GitMain['kind']): GitMain => ({ kind, why: excerpt(['git', 'worktree', ...args]) })
  const sub = args[0]
  const rest = args.slice(1)
  if (sub === 'list' || sub === 'prune') return rest.every(a => a.startsWith('-')) ? undefined : bad('unclear')
  if (sub === 'remove') {
    const paths = rest.filter(a => !a.startsWith('-'))
    return paths.length === 1 && !/[$%`*?{}()]/.test(paths[0] ?? '') && rest.every(a => !a.startsWith('-') || ADD_FLAGS.has(a))
      ? undefined : bad('unclear')
  }
  if (sub !== 'add') return bad('unclear')
  const positional: string[] = []
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] ?? ''
    if (a === '-b' || a === '-B') {
      i++
      continue
    }
    if (a.startsWith('-')) {
      if (!ADD_FLAGS.has(a)) return bad('unclear')
      continue
    }
    positional.push(a)
  }
  if (positional.length < 1 || positional.length > 2) return bad('unclear')
  const where = resolve(eff, positional[0])
  if (where === null) return bad('unclear')
  const p = normalize(where)
  return !isMain(where) || p.startsWith(`${MAIN}/.claude/worktrees/`) ? undefined : bad('branch')
}

// What a command does to the main folder's checkout, or undefined when it does nothing there
// (or is not git). `cwd` is the session's folder; `cd` and `-C` in the command move it.
export function findGitMain(command: string, cwd: string): GitMain | undefined {
  let dir: Dir = cwd
  for (const s of segments(command)) {
    let words = s.words
    while (words.length > 0 && CONTROL.has((words[0] ?? '').toLowerCase())) words = words.slice(1)
    words = commandWords(words)
    const first = words[0] ?? ''
    const name = commandName(first)
    if (CD.has(name)) {
      dir = resolve(dir, cdTarget(words))
      continue
    }
    const flat = s.raw.toLowerCase().replace(/\\/g, '/')
    // An interpreter or wrapper that runs git text, or a variable as the command: the text may
    // change the checkout. It counts where the folder is the main one or the text names it.
    const wraps = NESTED.has(name) && namesGitChange(flat)
    const viaVariable = /^[$%]/.test(first) && !first.includes('=') && words.slice(1).some(w => GUARDED.has(w))
    if (wraps || viaVariable) {
      if (dir === null || isMain(dir) || flat.includes('repos/creador')) {
        return { kind: 'unclear', why: viaVariable ? `variable como comando: ${excerpt(words)}` : `intérprete anidado: ${excerpt(words)}` }
      }
      continue
    }
    if (name === 'gh') {
      // `gh pr checkout` (or `co`) switches the branch in the folder it runs in, like `git checkout`.
      const ghWords: string[] = []
      const tail = words.slice(1).filter(w => !/^(\d*|&)[<>]/.test(w) && w !== '}')
      for (let j = 0; j < tail.length; j++) {
        const w = tail[j] ?? ''
        if (w === '-R' || w === '--repo') j++
        else if (!w.startsWith('-')) ghWords.push(w.toLowerCase())
      }
      if (ghWords[0] === 'pr' && (ghWords[1] === 'checkout' || ghWords[1] === 'co')) {
        const what = excerpt(['gh', ...tail])
        if (dir === null) return { kind: 'unclear', why: `${what}: no pude ubicar la carpeta (variable o comodín)` }
        if (isMain(dir)) return { kind: 'branch', why: what }
      }
      continue
    }
    if (name !== 'git') continue

    // Global options, then the subcommand and its arguments (redirections and `}` are no arguments).
    const rest = words.slice(1).filter(w => !/^(\d*|&)[<>]/.test(w) && w !== '}')
    let eff: Dir = dir
    let redirected = false
    let isUnknown = false
    let i = 0
    while (i < rest.length && (rest[i] ?? '').startsWith('-')) {
      const w = rest[i] ?? ''
      if (w === '-C') {
        eff = resolve(eff, rest[i + 1])
        i += 2
      } else if (w === '-c' || w === '--namespace' || w === '--super-prefix' || w === '--config-env') i += 2
      else if (/^--(git-dir|work-tree)(=|$)/.test(w)) {
        redirected = true
        i += w.includes('=') ? 1 : 2
      } else if (/^--(namespace|super-prefix|config-env)=/.test(w) || PLAIN_OPTIONS.has(w)) i++
      else {
        isUnknown = true
        i++
      }
    }
    const sub = rest[i] ?? ''
    const args = rest.slice(i + 1)
    if (!GUARDED.has(sub)) {
      // An option this parse does not know may have taken the subcommand's place.
      if (isUnknown && rest.some(w => GUARDED.has(w)) && (eff === null || isMain(eff))) {
        return { kind: 'unclear', why: excerpt(['git', ...rest]) }
      }
      continue
    }
    if (!redirected && eff !== null && !isMain(eff)) continue
    const what = excerpt(['git', ...rest.slice(i)])
    if (redirected) return { kind: 'unclear', why: `${what} con --git-dir o --work-tree` }
    if (eff === null) return { kind: 'unclear', why: `${what}: no pude ubicar la carpeta (variable o comodín)` }
    if (isUnknown) return { kind: 'unclear', why: `${what} con una opción de git que no conozco` }
    if (sub === 'worktree') {
      const bad = worktreeOk(args, eff)
      if (bad !== undefined) return bad.kind === 'unclear' ? { kind: 'unclear', why: bad.why } : { kind: 'branch', why: bad.why }
      continue
    }
    if ((sub === 'checkout' || sub === 'switch') && args.length === 1 && args[0] === 'main') continue
    return { kind: 'branch', why: what }
  }
  return undefined
}
