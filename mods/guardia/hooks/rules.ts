// Pure logic of the three rules, with no `$`: register.ts feeds it what the
// engine answers, and the tests call it directly.

import { inlineCodeIsData } from './kill.ts'

// Creador's main folder: its skills/ is linked into ~/.claude/skills and rules
// every project at once. Worktrees live under .claude/worktrees/ and stay out.
export const CREADOR_SKILLS = 'c:/repos/creador/skills'

// Its mods/ is protected the same way: the installed mods read it in place, so
// what is edited there runs live in every session (CRE-GRD-MAIN-1).
export const CREADOR_MODS = 'c:/repos/creador/mods'

// The links to it by name, for when a path cannot be resolved.
const HOME_LINK = /^(~|\$home|\$env:userprofile|%userprofile%|[a-z]:\/users\/[^/]+)\/\.claude\/skills\/(orquestador|trabajador|consulta)(\/|$)/

export const MSG_PR = (where: string, heading: string) =>
  `guardia: no abras el PR todavía. ${where} en HEAD aún tiene trabajo en «Trabajo actual» (${heading}). ` +
  'Mueve la tarea a «Terminados», deja «## Trabajo actual: ninguno», haz el commit, ' +
  `compruébalo con \`git show HEAD:${where}\` y vuelve a intentarlo.`

export const MSG_SHELL_FAILED =
  'guardia: no pude comprobar este comando (abre un PR o nombra `skills/` o `mods/`), así que lo frené. ' +
  'Si abre un PR, revisa `git show HEAD:PROGRESS.md` (o `progress/<id>.md`); si escribe en `skills/` o `mods/`, hazlo en un worktree de Creador.'

export const MSG_SKILLS = (path: string) =>
  `guardia: no edites \`skills/\` ni \`mods/\` en la carpeta principal de Creador (${path}): \`skills/\` está enlazada y los mods instalados leen \`mods/\` en el lugar, así que rigen ya en todos los proyectos. ` +
  'Haz el cambio en un worktree (`C:\\repos\\creador\\.claude\\worktrees\\<nombre>\\skills\\...` o `...\\mods\\...`); se vuelve oficial al fusionar.'

export const MSG_LINK_ASK = (link: string, target: string) =>
  `guardia: este comando crea el enlace ${link} → ${target}, que pone una skill de la carpeta principal de Creador en ~/.claude/skills (rige ya en todos los proyectos). ` +
  'Apruébalo solo si el responsable pidió crear ese enlace; si no, recházalo.'

export const MSG_LINK_NOBODY = (link: string, target: string) =>
  `guardia: no creé el enlace ${link} → ${target}: crearlo necesita que el responsable lo apruebe con un clic, y en esta sesión nadie puede aprobar. ` +
  'Pídele que lo apruebe en una sesión interactiva o que lo cree él.'

export const MSG_LINK_FAILED =
  'guardia: no pude comprobar si este comando crea un enlace a `skills/` de la carpeta principal de Creador, así que lo frené.'

export const MSG_SKILLS_FAILED =
  'guardia: no pude comprobar si esta edición toca `skills/` o `mods/` de la carpeta principal de Creador, así que la frené. ' +
  'Si es un worktree o un archivo de otro lugar, revisa la ruta y vuelve a intentarlo.'

// Lowercase, forward slashes, Git Bash drives (/d/x -> d:/x), `.` and `..` folded.
export function normalize(path: string): string {
  const p = path.trim().replace(/\\/g, '/').toLowerCase()
    .replace(/^\/\/\?\//, '')
    .replace(/^\/([a-z])(\/|$)/, '$1:/')
  const lead = /^[a-z]:\//.test(p) ? p.slice(0, 3) : p.startsWith('/') ? '/' : ''
  const parts: string[] = []
  for (const part of p.slice(lead.length).split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (parts.length > 0 && parts[parts.length - 1] !== '..') parts.pop()
      else if (lead === '') parts.push(part)
      continue
    }
    parts.push(part)
  }
  return lead + parts.join('/')
}

export function isAbsolutePath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || /^[\\/]/.test(path) || /^~[\\/]/.test(path) || /^(\$home|\$env:userprofile|%userprofile%)[\\/]/i.test(path)
}

// Joins a path to a folder, turning a Git Bash drive (/c/x) into c:/x so git
// can run there; other MSYS paths (/tmp) stay as they are.
export function joinPath(dir: string, path: string): string {
  const native = path.replace(/^\/([a-zA-Z])(\/|$)/, '$1:/')
  return isAbsolutePath(native) ? native : `${dir.replace(/[\\/]+$/, '')}/${native}`
}

export function isProtected(path: string): boolean {
  const p = normalize(path)
  return p === CREADOR_SKILLS || p.startsWith(`${CREADOR_SKILLS}/`) ||
    p === CREADOR_MODS || p.startsWith(`${CREADOR_MODS}/`) || HOME_LINK.test(p)
}

// ---- Shell parsing (best effort: one level, no expansion) ----

type Segment = { words: string[]; raw: string }

// Splits on unquoted ; && || | & newline ( ), keeping each piece's words with
// quotes removed. A quoted text never splits and never starts a command.
export function segments(command: string): Segment[] {
  const out: Segment[] = []
  let words: string[] = []
  let word = ''
  let hasWord = false
  let raw = ''
  let quote: '"' | "'" | null = null
  const endWord = () => {
    if (hasWord) words.push(word)
    word = ''
    hasWord = false
  }
  const endSegment = () => {
    endWord()
    if (words.length > 0) out.push({ words, raw: raw.trim() })
    words = []
    raw = ''
  }
  for (let i = 0; i < command.length; i++) {
    const c = command[i] ?? ''
    if (quote) {
      if (c === quote) quote = null
      else word += c
      raw += c
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      hasWord = true
      raw += c
      continue
    }
    if (c === ';' || c === '|' || c === '&' || c === '\n' || c === '\r' || c === '(' || c === ')') {
      // `2>&1` and `>&` are redirections, not separators.
      if (c === '&' && command[i - 1] === '>') {
        word += c
        raw += c
        continue
      }
      endSegment()
      continue
    }
    // Any Unicode blank splits words: PowerShell takes U+00A0 as a space.
    if (/\s/.test(c)) {
      endWord()
      raw += c
      continue
    }
    word += c
    hasWord = true
    raw += c
  }
  endSegment()
  return out
}

export const commandName = (word: string) =>
  word.replace(/\\/g, '/').split('/').pop()?.toLowerCase().replace(/\.exe$/, '') ?? ''

// Drops `VAR=x` assignments and `env`/`command`/`time` wrappers before the command word.
export function commandWords(words: string[]): string[] {
  let i = 0
  while (i < words.length) {
    const w = words[i] ?? ''
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w) || w === 'env' || w === 'command' || w === 'time') i++
    else break
  }
  return words.slice(i)
}

export const CD = new Set(['cd', 'set-location', 'sl', 'chdir', 'pushd', 'push-location'])

// The folder a `cd` segment moves to, or undefined when it is no `cd`.
export function cdTarget(words: string[]): string | undefined {
  if (!CD.has(commandName(words[0] ?? ''))) return undefined
  const flag = (words[1] ?? '').toLowerCase()
  return flag === '-path' || flag === '-literalpath' ? words[2] : words[1]
}
const GH_FLAGS_WITH_VALUE = new Set(['-r', '--repo', '--hostname'])

function isGhPrCreate(words: string[]): boolean {
  if (commandName(words[0] ?? '') !== 'gh') return false
  let i = 1
  while (i < words.length && (words[i] ?? '').startsWith('-')) {
    const flag = (words[i] ?? '').toLowerCase()
    i += GH_FLAGS_WITH_VALUE.has(flag) ? 2 : 1
  }
  const sub = (words[i] ?? '').toLowerCase()
  const verb = (words[i + 1] ?? '').toLowerCase()
  return sub === 'pr' && (verb === 'create' || verb === 'new')
}

// The first `gh pr create` in the command, with the folder a `cd` before it
// moved to (relative to the session's folder), if any.
export function findPrCreate(command: string): { cd?: string } | undefined {
  let cd: string | undefined
  for (const s of segments(command)) {
    const words = commandWords(s.words)
    const target = cdTarget(words)
    if (target !== undefined) {
      cd = cd === undefined ? target : joinPath(cd, target)
      continue
    }
    if (isGhPrCreate(words)) return cd === undefined ? {} : { cd }
  }
  return undefined
}

// ---- Rule 3: merging a PR ----

export const MSG_MERGE_UNCLEAR = (why: string) =>
  `guardia: este comando podría fusionar un PR (${why}) y no lo entiendo con certeza (intérprete anidado, variable, escape, sustitución, alias, \`gh api\`, otro repo u otra forma que \`--merge\`), así que lo frené. ` +
  'Si solo lees el PR (`gh pr checks|view|list|diff|status`, con `--json` y `-q`/`--jq` si quieres), córrelo en una llamada aparte: sin intérpretes ni envolturas (`node`, `pwsh`, `bash`, `sudo`, `xargs`; `python` solo con `-c` de datos), sin `$(…)`, acento grave ni comillas escapadas en el mismo comando. ' +
  'Si solo mencionas la fusión en un texto, ponlo en un archivo: `gh pr create|comment --body-file <archivo>` o `git commit -F <archivo>`. ' +
  'Si eres el orquestador y el proyecto no publica en producción, escribe literal `gh pr merge <número> --merge`, solo (a lo más tras `cd <ruta absoluta> &&`), sin URL, `--repo` ni `GH_REPO`/`GH_HOST`.'

export const MSG_MERGE_ENV =
  'guardia: no fusiones con `GH_REPO` o `GH_HOST` definidas en el entorno: `gh` fusionaría en otro repo que el de la carpeta. ' +
  'Avisa al responsable con el enlace del PR.'

export const MSG_MERGE_REPO = (pr: string | undefined, origin: string | undefined) =>
  'guardia: no fusiones: no pude confirmar que el PR es del repo de `origin` ' +
  `(PR: ${pr ?? 'sin leer'}; origin: ${origin ?? 'sin leer'}). Con varios remotos, \`gh\` puede apuntar a otro (\`gh repo set-default\`). ` +
  'Avisa al responsable con el enlace del PR.'

export const MSG_MERGE_ROLE =
  'guardia: solo el orquestador fusiona PR, y esta sesión no lo es (o no lo pude confirmar en su historial). ' +
  'Si eres el trabajador, informa al orquestador que el PR está listo; nunca fusiones. ' +
  'Si eres el orquestador: tras una compactación la seña del orquestador puede haberse perdido del historial; se restablece invocando de nuevo `/orquestador` y reintentando. ' +
  'En un proyecto que publica en producción no fusiona el orquestador: fusiona el responsable.'

export const MSG_MERGE_PROD = (line: string | undefined, ref = 'la rama base remota') =>
  'guardia: no fusiones: en este proyecto fusionar publica en producción ' +
  `(${line ?? `no pude leer en el AGENTS.md de ${ref} la línea «- Fusionar publica en producción: no», así que cuenta como «sí»`}). ` +
  'Avisa al responsable con el enlace del PR y espera a que fusione él.'

export const MSG_MERGE_FAILED =
  'guardia: no pude comprobar si esta sesión puede fusionar este PR (rol o línea de producción en AGENTS.md), así que lo frené. ' +
  'Avisa al responsable con el enlace del PR.'

const GH_BUILTINS = new Set([
  'agent-task', 'alias', 'api', 'attestation', 'auth', 'browse', 'cache', 'co', 'codespace', 'completion', 'config',
  'copilot', 'extension', 'gist', 'gpg-key', 'help', 'issue', 'label', 'org', 'pr', 'preview', 'project', 'release',
  'repo', 'ruleset', 'run', 'search', 'secret', 'ssh-key', 'status', 'variable', 'version', 'workflow',
])

// Commands that run other text: interpreters, eval and wrappers.
export const NESTED = new Set([
  'bash', 'sh', 'zsh', 'dash', 'cmd', 'pwsh', 'powershell', 'wsl', 'iex', 'invoke-expression', 'invoke-command',
  'icm', 'start-process', 'start', 'saps', 'xargs', 'eval', 'source', '.', 'exec', 'nohup', 'sudo', 'nice',
  'timeout', 'stdbuf', 'call', 'winpty', 'npx', 'runas', 'doas', 'watch', 'python', 'python3', 'py', 'node',
  'perl', 'ruby',
])

// `gh pr` subcommands that only read.
const READONLY_PR = new Set(['checks', 'view', 'list', 'diff', 'status'])

// Invisible format characters: signs a command is not what it looks like.
const INVISIBLE = '\\u200b-\\u200d\\u2060\\ufeff\\u00ad'
const INVISIBLE_ALL = new RegExp(`[${INVISIBLE}]`, 'g')

// The typographic quotes ‘ ’ ‚ ‛ “ ” „ (U+2018 to U+201E): PowerShell reads them as quotes (as rule 7 does).
const TYPOGRAPHIC = /[‘-„]/

// Escapes and quotes out, invisible characters out, every Unicode blank a space.
const flatten = (command: string, slash: string) => command.toLowerCase()
  .replace(INVISIBLE_ALL, '')
  .replace(/\\/g, slash)
  .replace(/[`^"'‘-„]/g, '')
  .replace(/\s+/gu, ' ')

const isGhWord = (word: string) => /(^|[/\\])gh(\.exe)?$/i.test(word)

// `gh` as a word anywhere in a flattened text.
const GH_TEXT = /(^|[^a-z0-9])gh(\.exe)?([^a-z0-9]|$)/

// The one clear merge, as the whole command: `gh pr merge <number> --merge`,
// single ASCII spaces, at most after `cd <absolute folder> &&` (`&&`: a `cd`
// that fails stops it; an absolute folder: no CDPATH). Whatever else (a URL,
// `--repo`, `GH_REPO=`, `export`, `--squash`, a second command) is not clear.
const CLEAR_MERGE = /^(?:cd ((?:[a-z]:[\\/]|\/[a-z]\/)[a-z0-9_./\\-]*) && )?gh(?:\.exe)? pr merge ([1-9][0-9]{0,8}) --merge$/i

// `{`/`}`: Bash's brace expansion builds words (`gh pr {merge,4}`, CRE-GRD-FP-3).
const EXPANSION = /[$%(`{}]/

// `why`: what made it unclear, for the refusal (CRE-GRD-FP-3), like rules 4, 6 and 7.
export type Merge = { isClear: boolean; pr?: string; cd?: string; why?: string }

const excerpt = (text: string) => {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > 60 ? `${t.slice(0, 57)}...` : t
}

// `merge` as a word in a flattened text (`merge-base` too: the fail-closed side).
const MERGE_WORD = /(^|[^a-z0-9_])merge([^a-z0-9_]|$)/
const namesMerge = (text: string) => MERGE_WORD.test(flatten(text, '')) || MERGE_WORD.test(flatten(text, '/'))

// Control words and groups before a command: rule 6 strips the same ones (worktree.ts imports
// rules.ts, so the set is repeated here, not imported). `{` alone opens a Bash or PowerShell block;
// `elseif`, `try`, `catch` and `finally` open PowerShell ones (etapa 3, H2).
const CONTROL = new Set(['if', 'then', 'else', 'elif', 'elseif', 'do', 'while', 'until', 'try', 'catch', 'finally', '!', '{', '}'])

// A segment's pieces between `{` and `}` words: PowerShell needs no `;` around a block
// (`if (x) { Write-Host a } else { gh pr merge 4 }`; etapa 3, H2). `cut`: whether a `(` follows the
// piece in the command (only the segment's last piece can be followed by one).
// Braces glued to a PowerShell keyword split off: `}else{`, `}catch{`, `}finally{` (second closing pass, a).
// A brace list (`{gh,pr}`) has no keyword and stays whole.
const unglueBraces = (w: string) => {
  const m = w.match(/^(\}?)(else|elseif|try|catch|finally)(\{?)$/i)
  if (m === null || (m[1] === '' && m[3] === '')) return [w]
  return [m[1] ?? '', m[2] ?? '', m[3] ?? ''].filter(p => p !== '')
}

const blockPieces = (s: { words: string[]; raw: string }, command: string) => {
  const all = s.words.flatMap(unglueBraces)
  if (!all.some(w => w === '{' || w === '}')) return [{ words: s.words, raw: s.raw, cut: cutByParen(command, s.raw) }]
  const out: { words: string[]; raw: string; cut: boolean }[] = []
  let words: string[] = []
  for (const w of [...all, '}']) {
    if (w !== '{' && w !== '}') {
      words.push(w)
      continue
    }
    if (words.length > 0) out.push({ words, raw: words.join(' '), cut: false })
    words = []
  }
  const last = out[out.length - 1]
  if (last !== undefined && s.words[s.words.length - 1] !== '}') last.cut = cutByParen(command, s.raw)
  return out
}

// A redirection glued to a word (`merge>/dev/null`, `merge<<<x`) split off, so the verb reads alone
// (etapa 3, H3). Only after a word with a letter: `2>&1` stays a redirection.
const splitRedirections = (words: string[]) =>
  words.flatMap(w => {
    const m = w.match(/^([^<>\s]*[A-Za-z][^<>\s]*)([<>].*)$/)
    return m === null ? [w] : [m[1] ?? '', m[2] ?? '']
  })

// A comment (`#` after a blank or at a line's start) with an odd quote, and gh or merge named on another
// line: segments() does not know comments, so the quote swallows the next lines
// (`git status # don't⏎gh pr merge 4`; etapa 3, H1). segments() itself is not changed: the other rules use it.
const commentHidesLine = (command: string) => {
  const lines = command.split(/\r?\n/)
  if (lines.length < 2) return false
  const odd = lines.map(line => {
    const m = line.match(/(^|\s)#(.*)$/)
    const rest = m?.[2] ?? ''
    return m !== null && ((rest.match(/'/g) ?? []).length % 2 !== 0 || (rest.match(/"/g) ?? []).length % 2 !== 0)
  })
  const names = (line: string) => namesMerge(line) || GH_TEXT.test(flatten(line, '')) || GH_TEXT.test(flatten(line, '/'))
  return odd.some((isOdd, k) => isOdd && lines.some((line, j) => j !== k && names(line)))
}
const stripControl = (words: string[]) => {
  let w = words
  while (w.length > 0 && CONTROL.has((w[0] ?? '').toLowerCase())) w = w.slice(1)
  return commandWords(w)
}

// Commands whose words are only shown or searched (not `rg --pre`, which runs a program).
const TEXT_COMMANDS = new Set(['echo', 'printf', 'write-host', 'write-output', 'grep', 'egrep', 'fgrep', 'rg', 'select-string', 'sls', 'findstr'])
const isText = (name: string, words: string[]) => TEXT_COMMANDS.has(name) && !(name === 'rg' && words.some(w => /^--pre/.test(w)))

// The language interpreters of NESTED; the rest of it are wrappers (B3 of the audit).
const INTERPRETERS = new Set(['bash', 'sh', 'zsh', 'dash', 'cmd', 'pwsh', 'powershell', 'wsl', 'python', 'python3', 'py', 'node', 'perl', 'ruby'])

// The `)` that closes the `$(` whose text starts at `from`, read the way Bash does inside it: quotes
// (a `)` in them does not close), backslashes, comments, here-document bodies, `${…}`, nested `$(…)`
// and backtick spans. -1 when it cannot be placed (no closing `)`, a `case`, whose patterns end in
// `)`, an unfinished here-document): the caller then reads up to the end, the fail-closed side
// (etapa 3, M2: up to the end, the quotes after the `)` shifted and stopped a later gh).
const closeOf = (text: string, from: number): number => {
  let depth = 1
  let quote: string | null = null
  let pending: string[] = []
  for (let i = from; i < text.length; i++) {
    const c = text[i]
    if (quote === "'") {
      if (c === "'") quote = null
      continue
    }
    if (c === '\\') {
      i++
      continue
    }
    if (c === '$' && text[i + 1] === '(' && quote === '"') {
      const end = closeOf(text, i + 2)
      if (end < 0) return -1
      i = end
      continue
    }
    if (c === '`') {
      const end = text.indexOf('`', i + 1)
      if (end < 0) return -1
      i = end
      continue
    }
    if (quote === '"') {
      if (c === '"') quote = null
      continue
    }
    if (c === "'" || c === '"') quote = c
    else if (c === '$' && text[i + 1] === '{') {
      const end = text.indexOf('}', i + 2)
      if (end < 0) return -1
      i = end
    } else if (c === '#' && (i === from || /\s/.test(text[i - 1] ?? ''))) {
      const nl = text.indexOf('\n', i)
      if (nl < 0) return -1
      i = nl - 1
    } else if (c === '<' && text[i + 1] === '<' && text[i + 2] !== '<') {
      const m = text.slice(i + 2).match(/^(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/)
      if (m === null) return -1
      pending.push(`${m[1]}${m[3]}`)
      i += 1 + m[0].length
    } else if (c === '\n' && pending.length > 0) {
      let at = i + 1
      for (const doc of pending) {
        const word = doc.replace(/^-/, '')
        let found = false
        while (at < text.length) {
          const nl = text.indexOf('\n', at)
          const line = text.slice(at, nl < 0 ? undefined : nl)
          at = nl < 0 ? text.length : nl + 1
          if ((doc.startsWith('-') ? line.replace(/^\t+/, '') : line) === word) {
            found = true
            break
          }
        }
        if (!found) return -1
      }
      pending = []
      i = at - 1
    } else if (c === '(') depth++
    else if (c === ')' && --depth === 0) {
      return /(^|[\s;&|(])case\s/.test(text.slice(from, i)) ? -1 : i
    }
  }
  return -1
}

// A text that runs inside the command and that segments() keeps inside quotes (CRE-GRD-FP-3):
// the text of each `$(…)` up to its closing `)` (closeOf; up to the end when it cannot be placed),
// and the text between each backtick and the next one. Bash and PowerShell both run `"$(…)"`, and
// Bash runs `` `…` `` even in double quotes. A backtick span ends at the next backtick (Bash does not
// honour quotes there), and every backtick opens one, so a single-quoted backtick cannot shift
// which pairs are read (ronda 2, X1: up to the end, each span re-read the rest and took seconds).
// Single quotes are not honoured either: `'$(…)'` runs nothing, but stopping it is the safe side.
// Each marker of the whole command gets its own text, so a nested one is read without recursion.
const substitutions = (command: string) => {
  const out: string[] = []
  for (let i = 0; i < command.length; i++) {
    if (command[i] === '`') {
      const end = command.indexOf('`', i + 1)
      out.push(command.slice(i + 1, end < 0 ? undefined : end))
    } else if (command[i] === '$' && command[i + 1] === '(') {
      const end = closeOf(command, i + 2)
      out.push(command.slice(i + 2, end < 0 ? undefined : end))
    }
  }
  return out
}

// Pieces that run nothing of their own (ronda 2, X2): `[` and `test` only compare (not `[[`, whose
// arithmetic runs `a[$(…)]`), and '' is a piece of assignments only (`state="$(gh pr view …)"`).
// What runs in their `$(…)` or backticks is judged on its own reading.
const RUNS_NOTHING = new Set(['[', 'test', ''])

// A word with its `$(…)`, `${…}`, `$[…]` and backtick spans out, nested ones included. An unclosed one
// takes the rest, so what is left has fewer blanks, never more (the fail-closed side for nameExpands).
const withoutExpansions = (word: string) => {
  let out = ''
  for (let i = 0; i < word.length; i++) {
    const c = word[i]
    if (c === '`') {
      const end = word.indexOf('`', i + 1)
      if (end < 0) break
      i = end
    } else if (c === '$' && /[({[]/.test(word[i + 1] ?? '')) {
      let depth = 0
      let j = i + 1
      for (; j < word.length; j++) {
        if (/[({[]/.test(word[j] ?? '')) depth++
        else if (/[)}\]]/.test(word[j] ?? '') && --depth === 0) break
      }
      i = j
    } else out += c
  }
  return out
}

// Whether a piece is followed by a `(` in the command (segments() cuts there): every place the piece
// appears is checked, so a copy elsewhere cannot hide it.
const cutByParen = (command: string, raw: string) => {
  for (let at = command.indexOf(raw); at >= 0; at = command.indexOf(raw, at + 1)) {
    if (/^\s*\(/.test(command.slice(at + raw.length))) return true
  }
  return false
}

// A word made of complete backtick spans and punctuation only (`` `campo1`, ``, `` `rules.ts` ``):
// inside a substitution's text it is a list or a code span in a message, not a name built from a
// span's output. A span glued to letters (`` g`echo h` ``) or an unclosed one counts, and so does a
// span whose content is no plain word: it runs that content, and `` `rev<<<hg` `` prints gh (ronda 3, D1).
const isSpanList = (word: string) => {
  if ((word.match(/`/g) ?? []).length % 2 !== 0) return false
  if (/[\p{L}\p{N}_$%{}]/u.test(word.replace(/`[^`]*`/g, ''))) return false
  return [...word.matchAll(/`([^`]*)`/g)].every(m => /^[\p{L}\p{N}_./-]+$/u.test(m[1] ?? ''))
}

// Line continuations joined the way the shells do (rule 6's joinContinuations): `\` + newline in
// Bash, `` ` `` + newline in PowerShell.
const joinContinuations = (command: string) => command.replace(/[\\`]\r?\n/g, '')

// Every way a command may merge a PR, judged segment by segment. Clear only
// when the whole command is CLEAR_MERGE, with `pr` its number and `cd` its
// folder. Fails closed: what may merge in a way this parse does not follow (a
// nested interpreter or wrapper in a command that names gh or merge, an
// expansion as the command, an escaped or quoted `gh pr merge`, a gh alias or
// extension, `gh api` with merge, a git alias with `!`, a substitution that may
// merge, an escaped or typographic quote beside gh, a segment that names merge
// and is no gh, git or text command, any merge that is not CLEAR_MERGE) is
// `{ isClear: false, why }`. undefined: no merge. The command is read as written
// and with its line continuations joined; either reading that is unclear wins.
export function findMerge(command: string): Merge | undefined {
  const joined = joinContinuations(command)
  const found = [judgeMerge(command, command, true)]
  if (joined !== command) found.push(judgeMerge(joined, command, true))
  return found.find(f => f !== undefined && !f.isClear) ?? found.find(f => f !== undefined)
}

// `top`: the whole command, for the excerpt; `outer`: whether its substitutions are read (only once).
function judgeMerge(command: string, top: string, outer: boolean): Merge | undefined {
  const all = flatten(command, '')
  const namesGh = GH_TEXT.test(all) || GH_TEXT.test(flatten(command, '/'))
  const hasPr = all.split(/[\s;|&()<>{}[\],=+]+/).includes('pr')
  let merges = 0
  let isUnclear = false
  let why: string | undefined
  const unclear = (reason: string) => {
    isUnclear = true
    why ??= reason
  }
  // An escaped quote (`\"`, `\'`) moves where Bash's quotes end, and a typographic one where
  // PowerShell's end; segments() follows neither: `echo \" ; gh pr merge 4 \"` and
  // `echo "” ; gh pr merge 4 ; echo “"` run the merge (CRE-GRD-FP-3). Only beside gh and either the
  // word merge or an expansion that may build it (`gh pr me$x`): a PR body with `\"` or “…” alone passes.
  if (namesGh && (all.includes('merge') || /[$%`]/.test(command))) {
    if (/\\["']/.test(command)) unclear(`comilla escapada en un comando que nombra \`gh\`: ${excerpt(top)}`)
    else if (TYPOGRAPHIC.test(command)) unclear(`comilla tipográfica en un comando que nombra \`gh\`: ${excerpt(top)}`)
  }
  if (commentHidesLine(command)) unclear(`comentario con una comilla impar que puede tragarse la línea siguiente: ${excerpt(top)}`)
  // Each substitution that names gh or merge is judged as a command of its own.
  if (outer && (namesGh || all.includes('merge'))) {
    for (const text of substitutions(command)) {
      // `pr` too: `g`echo h` pr mer$x` builds gh from a span's output (ronda 2, L5).
      const flat = flatten(text, '')
      const namesPr = flat.split(/[\s;|&()<>{}[\],=+]+/).includes('pr')
      if (!flat.includes('merge') && !namesPr && !GH_TEXT.test(flat) && !GH_TEXT.test(flatten(text, '/'))) continue
      if (judgeMerge(text, top, false) !== undefined) {
        unclear(`sustitución \`$(…)\` o acento grave que podría fusionar: ${excerpt(top)}`)
        break
      }
    }
  }
  // A language interpreter that does not name gh in a command whose only gh words are read-only
  // `gh pr` subcommands is no merge (CRE-GRD-FP-1): decided after the loop, once every gh is seen.
  let deferred = false
  let otherGh = false
  // Once for the whole text, not per piece (ronda 2, X1).
  const textNamesMerge = namesMerge(command)
  for (const segment of segments(command)) for (const s of blockPieces(segment, command)) {
    // Control words and groups out (`{ gh …; }`, `then gh …`, `! gh …`), then assignments and wrappers,
    // then a PowerShell assignment, whose command is judged as any other (`$s = gh pr view …`; ronda 2, X2).
    // An environment assignment before the command (`PAGER=`, `GH_PAGER=`, `BROWSER=`, `EDITOR=`…) may name
    // what gh runs as its pager, browser or editor: one whose value names merge is unclear when it is the
    // prefix of a gh command or its value names gh (etapa 2, class L3; etapa 3, M1: `MODE=merge npm run build`,
    // `x="merge"` and `base="$(git merge-base …)"` pass).
    const prefix = s.words.filter((w, at) => at < s.words.length - stripControl(s.words).length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w))
    const loaded = prefix.find(w => namesMerge(w.slice(w.indexOf('=') + 1)))
    let words = stripControl(s.words)
    const assigned = (words[0] ?? '').match(/^\$[\w:]+=(.+)$/)
    if (/^\$[\w:]+$/.test(words[0] ?? '') && words[1] === '=') words = words.slice(2)
    else if (assigned !== null) words = [assigned[1] ?? '', ...words.slice(1)]
    if (cdTarget(words) !== undefined) continue
    const first = words[0] ?? ''
    // The command's name with a backslash read as a folder and as an escape (`g\h`).
    const names = [commandName(flatten(first, '/')), commandName(flatten(first, ''))]
    const name = names.find(n => n === 'gh' || NESTED.has(n)) ?? names[0] ?? ''
    const namesGhHere = GH_TEXT.test(flatten(s.raw, '')) || GH_TEXT.test(flatten(s.raw, '/'))
    if (loaded !== undefined && (isGhWord(name) || GH_TEXT.test(flatten(loaded, '')) || GH_TEXT.test(flatten(loaded, '/')))) {
      unclear(`asignación de entorno que nombra merge: ${excerpt(loaded)}`)
    }
    if (NESTED.has(name)) {
      const kind = INTERPRETERS.has(name) ? 'intérprete' : 'envoltura'
      const isEncoded = /^(pwsh|powershell)$/.test(name) && words.some(w => /^-(e|ec|enc|encodedcommand)$/i.test(w))
      if (isEncoded) unclear(`comando codificado de \`${name}\`: ${excerpt(s.raw)}`)
      else if (all.includes('merge')) unclear(`${kind} \`${name}\` en un comando que dice «merge»: ${excerpt(s.raw)}`)
      else if (namesGh) {
        // Only a data-only `python -c "<code>"` with nothing before it counts (CRE-GRD-FP-1, R2): not
        // `python`, `python -`, a script, `-m`, node, perl, ruby, nor an assignment or wrapper before it
        // (`words` lost them to commandWords: `PYTHONPATH=. python -c …` would load a planted module).
        if (namesGhHere || words.length !== s.words.length || !inlineCodeIsData(name, words, s.raw)) {
          unclear(`${kind} \`${name}\` en un comando que nombra \`gh\`: ${excerpt(s.raw)}`)
        } else deferred = true
      }
      continue
    }
    if (namesGhHere && !isGhWord(name)) otherGh = true
    if (name === 'git') {
      if (s.raw.includes('!') && (namesGh || all.includes('merge'))) unclear(`alias de git con \`!\`: ${excerpt(s.raw)}`)
      continue
    }
    // Anywhere in the command's name, not only at its start: `g$(echo h) pr merge 4`, `{gh,pr,merge,4}` (CRE-GRD-FP-3).
    // In a substitution's text a word made only of backtick spans and punctuation is a list in a message
    // (`` `a`, `b` ``), unless the text names merge; a span glued to letters still counts (ronda 2, L5).
    // A name with a literal blank (outside `$(…)`, `${…}`, `$[…]` and backtick spans) can never be gh: the
    // quoted rest of a substitution's text (`"; echo $state`) is no built name (ronda 2, X2).
    const nameExpands = (/[$%{]/.test(first) || (first.includes('`') && (outer || textNamesMerge || !isSpanList(first)))) &&
      !/\s/.test(withoutExpansions(first))
    if (nameExpands && !first.includes('=') && words[1] !== '=' && hasPr) {
      unclear(`expansión en el nombre del comando: ${excerpt(s.raw)}`)
      continue
    }
    if (!isGhWord(name)) {
      // A piece that is no gh, git or text command but names merge, or names gh beside an expansion,
      // in a command that names gh: a wrapper or block this parse does not follow may run it
      // (`env -i gh …`, `find -exec gh …`, `trap "gh …" EXIT`, `try { gh … }`, `& (gcm gh) pr merge`,
      // a continuation that splits `gh pr` from `merge`; CRE-GRD-FP-3, A1, A2 and A5). Not a test or a
      // bare assignment around a gh read (`[ "$(gh pr view 4 -q .state)" = OPEN ]`; ronda 2, X2): its
      // substitution is judged on its own, and the piece itself runs nothing.
      // Inside a substitution's text a backtick only bounds the next span, which gets its own reading.
      const passive = RUNS_NOTHING.has(name) && !namesMerge(s.raw)
      const expands = outer ? /[$%`{}]/ : /[$%{}]/
      if (namesGh && !isText(name, words) && !passive && (namesMerge(s.raw) || (namesGhHere && expands.test(s.raw)))) {
        unclear(`«merge» o \`gh\` en un comando que no es \`gh\`: ${excerpt(s.raw)}`)
      }
      continue
    }
    // Redirections (`2>&1`, `>out`, `<in`) are no subcommand. Each word kept also as written, backticks
    // in: flatten drops them, and `` gh pr `echo merge` 4 `` must not read as `gh pr echo` (ronda 2, X3).
    const gw = splitRedirections(words)
    const kept = gw.map((w, at) => ({ raw: w, flat: flatten(w, ''), at })).filter(w => !/^(\d*|&)[<>]/.test(w.flat))
    const flat = kept.map(w => w.flat)
    let i = 1
    while (i < flat.length && (flat[i] ?? '').startsWith('-')) {
      i += GH_FLAGS_WITH_VALUE.has(flat[i] ?? '') ? 2 : 1
    }
    const sub = flat[i] ?? ''
    const verb = flat[i + 1] ?? ''
    const subRaw = kept[i]?.raw ?? ''
    const verbRaw = kept[i + 1]?.raw ?? ''
    if (!(sub === 'pr' && READONLY_PR.has(verb))) otherGh = true
    // An option or a redirection right after `gh pr` moves the verb further on, where this parse does not
    // read it (`gh pr --repo o/r merge 4`, `gh pr > x merge 4`; ronda 3, B1). It is unclear when the text
    // names merge, an expansion or `@` follows, or a `(` cuts the piece; a read with options passes.
    const afterSub = kept[i] === undefined ? '' : flatten(gw[kept[i].at + 1] ?? '', '')
    if (sub === 'pr' && /^(-|<|>|&>|\d+[<>])/.test(afterSub)) {
      const rest = gw.slice((kept[i]?.at ?? 0) + 1)
      if (textNamesMerge || rest.some(w => /[$%`{}@]/.test(w)) || s.cut) {
        unclear(`opción o redirección entre \`gh pr\` y el verbo: ${excerpt(s.raw)}`)
        continue
      }
    }
    // `gh` or `gh pr` cut by a `(` that holds the rest: PowerShell runs `("mer"+"ge")` and passes its
    // value (`gh pr ("mer"+"ge") 4`, `gh ("pr") …`; ronda 2, L1, as rule 7 does with `git ('pu'+'sh')`).
    if ((sub === '' || (sub === 'pr' && verb === '')) && s.cut) {
      unclear(`\`gh\` cortado por un paréntesis: ${excerpt(top)}`)
      continue
    }
    if (sub === '') continue
    // A verb starting with `@` is a PowerShell array or splat (`gh pr @("mer"+"ge") 4`, `gh pr @v`; ronda 3, B2).
    const verbExpands = EXPANSION.test(verb) || EXPANSION.test(verbRaw) || verb.startsWith('@') || verbRaw.startsWith('@')
    if (EXPANSION.test(sub) || EXPANSION.test(subRaw) || (sub === 'pr' && verbExpands) || !GH_BUILTINS.has(sub)) {
      // an alias or extension may stand for `pr merge`
      unclear(`alias, extensión o expansión de \`gh\`: ${excerpt(s.raw)}`)
      continue
    }
    if (sub === 'api') {
      // Read flattened: `mer"g"e`, `'m'erge`, `mer\ge` (CRE-GRD-FP-3, A3). An expansion, a brace list, a
      // file (`@x`, `--input`) may also hold the merge: `p=merge; gh api …/$p`, `-F query=@q.graphql`.
      const args = words.slice(1)
      if (flatten(s.raw, '').includes('merge') || flatten(s.raw, '/').includes('merge')) {
        unclear(`\`gh api\` con merge: ${excerpt(s.raw)}`)
      } else if (args.some(w => /[$%`]|^@|=@|\{[^}]*,[^}]*\}/.test(w) || /^--input(=|$)/.test(w))) {
        unclear(`\`gh api\` con una expansión o un archivo: ${excerpt(s.raw)}`)
      }
    }
    // An alias may stand for `pr merge` later, under a spelling this parse does not follow
    // (`'pr mer''ge'`); `gh alias list` and `delete` cannot add one (CRE-GRD-FP-3, A6).
    // The verb is the first word after `alias` that is no option (`gh alias --clobber set …`; ronda 3, B1).
    const aliasVerb = flat.slice(i + 1).find(w => !w.startsWith('-')) ?? ''
    if (sub === 'alias' && /^(set|import)$/.test(aliasVerb)) unclear(`\`gh alias ${aliasVerb}\`: ${excerpt(s.raw)}`)
    // `gh config set pager|editor|browser <command>` makes gh run that command later, like an alias (etapa 3, B1).
    // Any word after `set` may be the key: an option's value (`-h github.com`) comes before it (second closing pass, d).
    const configArgs = flat.slice(i + 1).filter(w => !w.startsWith('-'))
    const configKey = configArgs.slice(1).find(w => /^(pager|editor|browser)$/.test(w))
    if (sub === 'config' && configArgs[0] === 'set' && configKey !== undefined &&
      (namesMerge(s.raw) || /[$%`]/.test(s.raw))) {
      unclear(`\`gh config set ${configKey}\` con merge o una expansión: ${excerpt(s.raw)}`)
    }
    if (sub === 'pr' && verb === 'merge') merges++
  }
  if (deferred && otherGh) unclear('`python -c` junto a un `gh` que no es una lectura `gh pr checks|view|list|diff|status`')
  if (merges === 0) return isUnclear ? { isClear: false, why: why ?? excerpt(command) } : undefined
  // Only ASCII blanks trimmed: a Unicode one at the end is no clear form.
  const clear = command.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '').match(CLEAR_MERGE)
  if (merges > 1) unclear('más de un `gh pr merge`')
  if (clear === null) unclear(`\`gh pr merge\` fuera de la forma clara: ${excerpt(command)}`)
  if (isUnclear || clear === null) return { isClear: false, why: why ?? excerpt(command) }
  const pr = clear[2] ?? ''
  return clear[1] === undefined ? { isClear: true, pr } : { isClear: true, pr, cd: clear[1] }
}

export type Role = 'orquestador' | 'trabajador' | undefined

// A skill's text as the engine pastes it on a slash invocation: after any
// command tags, the «Base directory for this skill» line and front matter, its
// first line is the heading «# Rol: <ROL>».
const SKILL_TEXT = /^(?:\s*<command-[a-z]+>[^<]*<\/command-[a-z]+>)*\s*(?:base directory for this skill:[^\n]*\n)?\s*(?:---\n[\s\S]*?\n---\n)?\s*#\s*rol:\s*(orquestador|trabajador)\b/i

// A real `/orquestador` invocation: the engine's command tags open the message.
// Quoted inside pasted text or another session's message, they come later.
const ORQ_INVOCATION = /^\s*(?:<command-message>orquestador<\/command-message>\s*)?<command-name>\/orquestador<\/command-name>/i

// The spans of the outermost quoting blocks of a message, only in the form the
// engine writes them (checked against the local transcripts, CRE-GRD-ROL-1,
// ronda 2): the opening starts a line; `<pasted_content id="X">` closes only
// with `</pasted_content id="X">`, the others (`<system-reminder>`,
// `<cross-session-message …>`, `<agent-message …>`, `<task-notification>`,
// `<side-sessions-event>`) with the first closing tag of their kind. Any other
// mention, inside a block or out of one, is text: an order or a report may
// name these tags. undefined when an opening in that form is left unclosed:
// then no span is trusted.
const QUOTE_OPEN = /^<(pasted_content|system-reminder|cross-session-message|agent-message|task-notification|side-sessions-event)\b([^>\n]*)>/gim
function quotedSpans(t: string): Array<[number, number]> | undefined {
  const spans: Array<[number, number]> = []
  let from = 0
  for (const m of t.matchAll(QUOTE_OPEN)) {
    const at = m.index ?? 0
    if (at < from) continue
    const kind = (m[1] ?? '').toLowerCase()
    const id = (m[2] ?? '').match(/^\s+id="([^"<>]+)"\s*$/)
    if (kind === 'pasted_content' && id === null) continue
    const closing = new RegExp(kind === 'pasted_content' ? `</pasted_content id="${(id?.[1] ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">` : `</${kind}\\b[^>]*>`, 'gi')
    closing.lastIndex = at + m[0].length
    const end = closing.exec(t)
    if (end === null) return undefined
    from = end.index + end[0].length
    spans.push([at, from])
  }
  return spans
}

// A compaction summary, as the engine opens it: all of it is quoted.
const COMPACTION = /^\s*(?:<artifact-content-authored-by-others\/>\n[^\n]*\n)?this session is being continued from a previous conversation/i

// A session launched by another, as the engine writes its first message (all
// the local transcripts that launch a worker, CRE-GRD-ROL-1, ronda 3): only
// `<system-reminder>` blocks, then the line «Background (from the session that
// started this one):»; its launch line follows a line «Task:».
function isSessionLaunch(t: string): boolean {
  let rest = t
  for (;;) {
    rest = rest.replace(/^\s+/, '')
    if (!rest.startsWith('<system-reminder>')) break
    const end = rest.indexOf('</system-reminder>')
    if (end < 0) return false
    rest = rest.slice(end + '</system-reminder>'.length)
  }
  return rest.startsWith('Background (from the session that started this one):\n')
}

// The role the session took, from the text of its user messages: a `/<rol>`
// command tag, the skill's own heading «# Rol: <ROL>», or the launch line
// «Lee y aplica las reglas de …\skills\<rol>\SKILL.md». Inside a skill's text
// the launch line counts only where it starts a line: the orchestrator's skill
// quotes the worker's mid-sentence (tests/rol-skills-reales.mjs checks it).
// A sign of the worker wins (CRE-GRD-ROL-1). It is firm when it starts a line
// (or is the `/trabajador` tag or the worker's heading) outside a quoting block:
// a real worker is launched so, and nothing undoes it. It is weak when the
// launch line sits mid-line outside a skill's text, or anything sits inside a
// quoting block in the engine's form (a pasted block quoting a launch, as in a
// project's pilot of CRE-CIERRE-2; a child's or a subagent's report, another
// session's message that forwards an order) or in a compaction summary. In a
// session launch, the worker's line right after «Task:» is firm whatever
// surrounds it: a Background may show a block's opening (ronda 3, M1'). A
// later message that opens with a real
// `/orquestador` invocation clears the weak signs before it, never firm ones
// nor those of its own message. The orchestrator needs a sign of its own.
export function roleOf(texts: string[]): Role {
  const LAUNCH = 'lee y aplica las reglas de\\s*`?[^`\\n]*skills/(orquestador|trabajador)/skill\\.md'
  let orchestrator = false
  let firm = false
  let weak = false
  for (const text of texts) {
    const t = text.replace(/\r/g, '').replace(/\\/g, '/')
    if (ORQ_INVOCATION.test(t)) weak = false
    // A quoting block left open fails closed: every worker sign of the message is firm;
    // a compaction summary is quoted whole.
    const summary = COMPACTION.test(t)
    // Spans read before `\` becomes `/` (same length): `<\system-reminder>` closes nothing.
    const spans = quotedSpans(text.replace(/\r/g, ''))
    const launch = isSessionLaunch(t)
    const quoted = (at: number) => summary || (spans ?? []).some(([a, b]) => at >= a && at < b)
    const lineStart = (at: number) => /^[ \t]*$/.test(t.slice(t.lastIndexOf('\n', at - 1) + 1, at))
    const afterTask = (at: number) => launch && /(?:^|\n)Task:\n$/.test(t.slice(0, at))
    const sign = (role: string | undefined, at: number, firmHere: boolean) => {
      if (role?.toLowerCase() === 'orquestador') orchestrator = true
      else if (role?.toLowerCase() === 'trabajador') {
        if (afterTask(at) || (!summary && (spans === undefined || (firmHere && !quoted(at))))) firm = true
        else weak = true
      }
    }
    for (const m of t.matchAll(/<command-name>\/?(orquestador|trabajador)<\/command-name>/gi)) sign(m[1], m.index ?? 0, true)
    const skill = t.match(SKILL_TEXT)
    if (skill !== null) {
      sign(skill[1], 0, true)
      for (const m of t.matchAll(new RegExp(`^[ \\t]*${LAUNCH}`, 'gim'))) sign(m[1], m.index ?? 0, true)
      continue
    }
    for (const m of t.matchAll(new RegExp(`${LAUNCH}|^#\\s*rol:\\s*(orquestador|trabajador)\\b`, 'gim'))) {
      const at = m.index ?? 0
      sign(m[1] ?? m[2], at, m[2] !== undefined || lineStart(at))
    }
  }
  if (firm || weak) return 'trabajador'
  if (orchestrator) return 'orquestador'
  return undefined
}

// `host/owner/repo` of a PR's URL (…/pull/<n>) or of a remote's URL (https,
// ssh or scp form, `.git` optional), lowercase; undefined for anything else.
export function repoOf(url: string): string | undefined {
  const m = url.trim().toLowerCase().match(
    /^(?:https?:\/\/(?:[^@/]+@)?|ssh:\/\/(?:[^@/]+@)?|git@)([a-z0-9.-]+)(?::\d+)?[/:]([a-z0-9_.-]+)\/([a-z0-9_.-]+?)(?:\.git)?(?:\/pull\/\d+)?\/?$/)
  return m === null ? undefined : `${m[1]}/${m[2]}/${m[3]}`
}

// The line «- Fusionar publica en producción: sí|no» of AGENTS.md, exactly so,
// at the start of a line and outside ``` blocks; no other form counts. 'no'
// only when every such line says «no»; undefined when there is none.
export function publishesOnMerge(agents: string): { value: 'sí' | 'no'; line: string } | undefined {
  let inFence = false
  let found: { value: 'no'; line: string } | undefined
  for (const line of agents.normalize('NFC').replace(/\r/g, '').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    if (inFence) continue
    const m = line.match(/^- Fusionar publica en producción: (sí|no)(?![\p{L}\p{N}])/u)
    if (m === null) continue
    if (m[1] === 'sí') return { value: 'sí', line: m[0] }
    found ??= { value: 'no', line: m[0] }
  }
  return found
}

// ---- PROGRESS.md ----

// The status of `## Trabajo actual`: the heading's text after `:`, `—` or
// `-`, or the first line under it when the heading has none. undefined: no
// section. Lines inside ``` or ~~~ blocks (a pasted order) never count.
export function currentWork(progress: string): string | undefined {
  let inFence = false
  const lines = progress.replace(/\r/g, '').split('\n').map(line => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      return ''
    }
    return inFence ? '' : line
  })
  const start = lines.findIndex(l => /^##\s+trabajo actual\b/i.test(l))
  if (start < 0) return undefined
  const heading = (lines[start] ?? '').replace(/^##\s+trabajo actual\s*[:—–-]?\s*/i, '').trim()
  if (heading !== '') return heading
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break
    if (line.trim() !== '') return line.trim()
  }
  return ''
}

// Open unless empty or «ninguno» (a bullet, emphasis, a final dot or a
// note in parentheses around it allowed).
export function isOpen(status: string | undefined): boolean {
  if (status === undefined) return false
  const s = status.replace(/^[-*+]\s+/, '').replace(/[*_`]/g, '').trim().toLowerCase()
  return s !== '' && !/^ningun[oa]\b\.?\s*(\(.*\))?\.?$/.test(s)
}

// ---- Shell writes to protected paths (best effort) ----

const WRITE_COMMANDS = new Set([
  'tee', 'cp', 'mv', 'rm', 'rmdir', 'touch', 'mkdir', 'ln', 'install', 'truncate', 'dd', 'unlink',
  'set-content', 'add-content', 'out-file', 'clear-content', 'copy-item', 'move-item', 'remove-item',
  'new-item', 'rename-item', 'sc', 'ac', 'del', 'erase', 'rd', 'ren', 'ni', 'ri', 'mi', 'cpi', 'rni', 'copy', 'move',
  'robocopy', 'xcopy', 'mklink',
])

// `cmd` runs whatever its arguments say, under flags this parser does not
// follow (`/s /c`, `/r`, a nested `cmd`, `&&` inside quotes): its words, split
// also on spaces and cmd's separators, stand in for the segment's.
const cmdWords = (words: string[]) =>
  words.slice(1).flatMap(w => w.split(/[\s&|()]+/)).filter(w => w !== '')

const CMD_CD = new Set(['cd', 'chdir', 'pushd'])

// A cmd segment that names a protected folder, for the fail-closed reading.
export const NAMES_PROTECTED = /skills|\bmods\b/i

const WRITE_CALL = /\b(writealltext|writealllines|writeallbytes|appendalltext|appendalllines)\s*\(/i

// The protected path a word of the segment names: as written (absolute or
// through the ~/.claude/skills links), else the folder itself when the
// segment runs under skills/ and any relative word lands there (the caller
// still needs a writing command).
function protectedWord(words: string[], cwd: string): string | undefined {
  let isUnderCwd = false
  for (const w of words) {
    for (const part of w.replace(/^-+[a-z]+[:=]/i, '').split(/>{1,2}/)) {
      if (part === '') continue
      if (isProtected(part)) return part
      if (!isAbsolutePath(part) && isProtected(joinPath(cwd, part))) isUnderCwd = true
    }
  }
  return isUnderCwd ? cwd : undefined
}

// The protected path a shell command writes to, if it names one with a
// writing command or a redirection. git never counts: pulling or merging in
// the main folder is how a skill change becomes official.
export function findShellWrite(command: string, cwd: string): string | undefined {
  let dir = cwd
  // A .NET call's arguments sit in their own segment, after the `(`.
  const isWriteCall = WRITE_CALL.test(command)
  for (const s of segments(command)) {
    const words = commandWords(s.words)
    const name = commandName(words[0] ?? '')
    // Fails closed: a cmd segment naming a protected path counts as a write,
    // `^` escapes dropped; so does one that names skills with a `%` expansion
    // or a `cd` cmd itself would follow.
    if (name === 'cmd') {
      const inner = cmdWords(words).map(w => w.replace(/\^/g, ''))
      const hit = protectedWord(inner, dir)
      if (hit !== undefined) return hit
      if (!NAMES_PROTECTED.test(s.raw) && !NAMES_PROTECTED.test(s.raw.replace(/\^|%[^%]*%/g, ''))) continue
      const expanded = inner.find(w => w.includes('%'))
      if (expanded !== undefined) return expanded
      const cd = inner.findIndex(w => CMD_CD.has(w.toLowerCase()))
      if (cd >= 0) return inner.slice(cd + 1).find(w => !w.startsWith('/')) ?? inner[cd]
      continue
    }
    const cd = cdTarget(words)
    if (cd !== undefined) {
      dir = joinPath(dir, cd)
      continue
    }
    if (name === 'git') continue
    const target = protectedWord(words, dir)
    if (target === undefined) continue
    const isSedInPlace = (name === 'sed' || name === 'perl') &&
      words.some(w => /^-[a-zA-Z]*i/.test(w) || w === '--in-place')
    const redirect = s.raw.match(/>{1,2}\s*["']?([^\s"'|;&]+)/g) ?? []
    const isRedirectHere = redirect.some(r => {
      const to = r.replace(/^>{1,2}\s*["']?/, '')
      return isProtected(to) || (!isAbsolutePath(to) && isProtected(joinPath(dir, to)))
    })
    if (WRITE_COMMANDS.has(name) || isSedInPlace || isRedirectHere || isWriteCall) return target
  }
  return undefined
}

// ---- The one write rule 2 lets the owner approve: linking a skill into ~/.claude/skills ----

export type LinkCreate = { link: string; target: string; name: string }

const SKILL_NAME = /^[a-z0-9-]+$/
const USER_HOME = /^[a-z]:\/users\/[a-z0-9_-][a-z0-9._-]*$/i

// The skill name a link path `<root>/.claude/skills/<x>` names, the root being
// one each shell expands; undefined for anything else.
function linkName(path: string, roots: string[]): string | undefined {
  const m = path.replace(/\\/g, '/').match(/^(.+)\/\.claude\/skills\/([^/]+)$/)
  if (m === null) return undefined
  const root = (m[1] ?? '').toLowerCase()
  const name = m[2] ?? ''
  return (roots.includes(root) || USER_HOME.test(root)) && SKILL_NAME.test(name) ? name : undefined
}

const isSkillTarget = (path: string, name: string) =>
  path.replace(/\\/g, '/').toLowerCase() === `${CREADOR_SKILLS}/${name}` &&
  path.replace(/\\/g, '/').endsWith(`/${name}`)

// A command that only links ~/.claude/skills/<x> to Creador's skills/<x>, in
// one of two exact forms, alone in the command:
//   New-Item -ItemType Junction|SymbolicLink -Path <link> -Target|-Value <target>
//   cmd /c mklink /J|/D <link> <target>
// Fails closed: quotes, expansions, separators or any other word and it is no link.
export function findLinkCreate(command: string): LinkCreate | undefined {
  if (/[;&|\r\n()<>`{}'"^]/.test(command)) return undefined
  const words = command.trim().split(/\s+/)

  if (/^new-item$/i.test(words[0] ?? '') && words.length === 7) {
    const args = new Map<string, string>()
    for (let i = 1; i < 7; i += 2) {
      const flag = (words[i] ?? '').toLowerCase()
      const key = flag === '-value' ? '-target' : flag
      if (!['-itemtype', '-path', '-target'].includes(key) || args.has(key)) return undefined
      args.set(key, words[i + 1] ?? '')
    }
    if (!/^(junction|symboliclink)$/i.test(args.get('-itemtype') ?? '')) return undefined
    const link = args.get('-path') ?? ''
    const target = args.get('-target') ?? ''
    const name = linkName(link, ['~', '$home', '$env:userprofile'])
    return name !== undefined && isSkillTarget(target, name) ? { link, target, name } : undefined
  }

  if (/^cmd(\.exe)?$/i.test(words[0] ?? '') && words.length === 6 && /^\/c$/i.test(words[1] ?? '') &&
    /^mklink$/i.test(words[2] ?? '') && /^\/[jd]$/i.test(words[3] ?? '')) {
    const link = words[4] ?? ''
    const target = words[5] ?? ''
    const name = linkName(link, ['%userprofile%'])
    return name !== undefined && isSkillTarget(target, name) ? { link, target, name } : undefined
  }
  return undefined
}

// tool.check's verdict on a skill link: the owner's click when a person can be
// asked, else a refusal. undefined: the command is no skill link.
export function linkVerdict(command: string, approver: string | undefined) {
  const found = findLinkCreate(command)
  if (found === undefined) return undefined
  return approver === 'person'
    ? { decision: 'ask' as const, reason: MSG_LINK_ASK(found.link, found.target) }
    : { decision: 'deny' as const, reason: MSG_LINK_NOBODY(found.link, found.target) }
}

export * from './kill.ts'
