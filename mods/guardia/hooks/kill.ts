// Rule 4: no closing of processes by name. Pure logic, no `$`.
//
// The form is closed, like rule 3's merge: a command that names a process
// killer passes only when every kill in it is one of the clear PID forms below,
// or the name sits only as text in a short list of text commands. Everything
// else that names a killer is stopped (fails closed). Nothing here runs.

export const MSG_KILL_NAME = (why: string) =>
  `guardia: no cierres procesos por nombre (${why}): en este equipo corren varios chats a la vez y un cierre por nombre mata los servidores, las pruebas y las auditorías de otros chats y proyectos. ` +
  'Cierra solo tu PID propio: el que devolvió el arranque, o el que escucha en tu puerto, p. ej. ' +
  '`Stop-Process -Id (Get-NetTCPConnection -LocalPort <puerto>).OwningProcess`, `taskkill /PID <pid> /F` o, en Bash, `kill <pid>`. La regla está en global/CLAUDE.md.'

export const MSG_KILL_UNCLEAR = (why: string) =>
  `guardia: este comando nombra un cierre de procesos (${why}) y no lo entiendo con certeza (variable como comando, intérprete anidado, comodín, escape, tubería o cualquier forma que no sea por PID), así que lo frené: nunca se cierra un proceso por nombre. ` +
  'Pasa solo la forma clara por PID propio: `taskkill /PID <pid> [/F] [/T]`, `Stop-Process -Id <pid|$var> [-Force]`, ' +
  '`Stop-Process -Id (Get-NetTCPConnection -LocalPort <puerto>).OwningProcess` o, en Bash, `kill [-9] <pid|$var>`, solas en su segmento. ' +
  'Un texto que solo menciona estos comandos (`echo`, `grep`, `git commit -m`, el cuerpo de `gh pr create`) pasa. La regla está en global/CLAUDE.md.'

// Bash ANSI-C quoting (`$'\x74ask'`) and PowerShell `u{74} build text from numbers: no way to read
// the name without running the shell's own decoder, and no sign in the command says it is a close.
// So the command fails closed, whatever else it holds.
export const MSG_KILL_ESCAPE = (why: string) =>
  `guardia: este comando escribe texto con códigos numéricos (${why}) y no puedo saber con certeza qué nombre arma, así que lo frené por si arma un cierre de procesos por nombre. ` +
  'Escribe el texto tal cual, sin `$\'\\x..\'` ni `` `u{..} ``. Un cierre se hace solo por PID propio: `taskkill /PID <pid> [/F] [/T]`, `Stop-Process -Id <pid|$var>` o, en Bash, `kill <pid>`. La regla está en global/CLAUDE.md.'

export type Kill = { kind: 'name' | 'unclear' | 'escape'; why: string }

// What names a killer. Compared against text with quotes, `^`, `` ` `` and `\`
// removed, lowercase, Unicode blanks as one space.
const KILL_NAMES = [
  'taskkill', 'pkill', 'killall', 'tskill', 'pskill', 'stop-process', 'spps', 'wmic',
  'remove-ciminstance', 'remove-wmiobject', '.kill(', '.terminate(',
]
// Names that need their surroundings: `.Kill` as a member, `% Kill` and `-MemberName Kill` (PowerShell),
// wmic's `call terminate` and CIM's Terminate method. `terminate` alone is a common word.
const EXTRA_NAMES = [
  /\.(?:kill|terminate)(?=$|[\s(;|&)}]|\.invoke)/,
  /(?:^|[^a-z0-9_-])(?:%|foreach-object|foreach)(?: +-m[a-z]*)?[ :]+(?:kill|terminate)(?![a-z0-9_.-])/,
  /invoke-wmimethod[^|;&]*?[ :]terminate(?![a-z0-9_-])/,
  /call terminate(?![a-z0-9_-])/,
  /invoke-cimmethod[^|;&]*?-m[a-z]*[ :]+terminate(?![a-z0-9_-])/,
]
// Names a glob or brace word may stand for (as a command, without the text-only names).
const KILL_COMMANDS = [
  'taskkill', 'pkill', 'killall', 'tskill', 'pskill', 'stop-process', 'spps', 'wmic', 'kill', 'remove-ciminstance', 'remove-wmiobject',
]

const INVISIBLE_KILL = /[​-‍⁠﻿­]/g

const flat = (text: string) => text.toLowerCase()
  .replace(INVISIBLE_KILL, '')
  .replace(/[\\"'`^]/g, '')
  .replace(/\s+/gu, ' ')

// A word as a path: backslashes read as folders, quotes and escapes out.
const asPath = (word: string) => word.toLowerCase()
  .replace(INVISIBLE_KILL, '')
  .replace(/\\/g, '/')
  .replace(/["'`^]/g, '')

const lastPart = (word: string) => asPath(word).split('/').pop() ?? ''

// `tskill` and `pskill` also arise when a Windows path loses its backslashes (`...\tmp\skills\...` reads
// `tmpskills`). A hit that only exists after that fusion counts when the name is a whole word, as in
// `ps\kill` or `pskill64`, and not when more letters follow it (`pskills`, `pskillx`).
const FUSIBLE = new Map([['tskill', /tskill(?![a-z])/], ['pskill', /pskill(?![a-z])/]])
const hasName = (text: string) => {
  const f = flat(text)
  const asPath = text.toLowerCase().replace(INVISIBLE_KILL, '').replace(/\\/g, '/').replace(/["'`^]/g, '').replace(/\s+/gu, ' ')
  return KILL_NAMES.some(n => {
    const whole = FUSIBLE.get(n)
    return whole === undefined ? f.includes(n) : asPath.includes(n) || whole.test(f)
  }) || EXTRA_NAMES.some(re => re.test(f))
}

// `kill` as a word of its own, also inside a quoted text (`pwsh -c "kill -n node"`).
const KILL_WORD = /(^|[^a-z0-9_.-])kill($|[^a-z0-9_.-])/

// Wrappers that run what follows: a `kill` after one of them is a command.
const WRAPPERS = new Set(['sudo', 'env', 'time', 'xargs', 'nohup', 'command', 'exec', '-exec', '-execdir', 'nice', 'timeout', 'stdbuf', 'watch', 'doas'])

// Words after which a command starts (Bash control words and `builtin`): `do kill $p`, `! kill $p`.
const CONTROL = new Set(['do', 'then', 'else', 'elif', 'if', 'while', 'until', '!', 'builtin', 'command', 'time'])

// The last part of a path, or the word with its escapes taken out (`k\ill`): `C:\x\kill.exe` is a path, `ki\ll` an escape.
const isKillWord = (word: string) => /^kill(\.exe)?$/.test(lastPart(word)) ||
  /^kill(\.exe)?$/.test(word.toLowerCase().replace(INVISIBLE_KILL, '').replace(/["'`^\\]/g, ''))

// The inside of a glob's `[…]` as the inside of a regex class: `\`, `]` and `^` taken
// literally, as before. A range out of order (`w-c`, as in `[$(git branch --show-current)]`)
// does not compile in a regex, and a class that did not compile counted as a killer
// (CRE-GRD-ROL-1, R4); it is read both ways (`c-w`), so it matches at least what either
// order would. Any other `-` is literal.
function globClass(inner: string): string {
  const esc = (c: string) => c.replace(/[\\\]^-]/g, '\\$&')
  let out = ''
  for (let j = 0; j < inner.length; j++) {
    const a = inner[j] ?? ''
    const b = inner[j + 2]
    if (inner[j + 1] === '-' && b !== undefined) {
      out += a <= b ? `${esc(a)}-${esc(b)}` : `${esc(b)}-${esc(a)}`
      j += 2
    } else out += esc(a)
  }
  return out
}

// A glob or brace word (`taskk*`, `[t]askkill`, `pk{i,}ll`) that can stand for a
// killer's name. At least four fixed characters, so `*`, `st*` or `*.md` do not count.
function globHit(word: string): boolean {
  const last = asPath(word).split('/').pop() ?? ''
  if (!/[*?[{]/.test(last)) return false
  if (last.replace(/[*?[\]{},]/g, '').length < 4) return false
  let body = ''
  for (let i = 0; i < last.length; i++) {
    const c = last[i] ?? ''
    if (c === '*') body += '.*'
    else if (c === '?') body += '.'
    else if (c === '[') {
      const end = last.indexOf(']', i + 1)
      if (end < 0) body += '\\['
      else {
        body += `[${globClass(last.slice(i + 1, end))}]`
        i = end
      }
    } else if (c === '{') {
      const end = last.indexOf('}', i + 1)
      if (end < 0) body += '\\{'
      else {
        const inner = last.slice(i + 1, end)
        body += inner.includes('..') ? '.*' : `(?:${inner.split(',').map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`
        i = end
      }
    } else body += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  let re: RegExp
  try {
    re = new RegExp(`^${body}$`)
  } catch {
    return true
  }
  return KILL_COMMANDS.some(n => re.test(n) || re.test(`${n}.exe`))
}

// ---- The clear forms: exact text, ASCII blanks, no quotes, no escapes ----

const NUM = '[0-9]{1,10}'
const VAR = '\\$(?:[a-z][a-z0-9_]*|_[a-z0-9_]+)'
const VAL = `(?:${NUM}|${VAR}(?:\\.(?:id|owningprocess|pid))?)`
const REDIR = '(?: +(?:2>&1|[12]?>/dev/null|[12]?>nul|[12]?>\\$null))*'
const PORT = '\\(get-nettcpconnection +-localport +[0-9]{1,5}\\)\\.owningprocess'

const FORMS = {
  taskkill: `taskkill(?:\\.exe)?(?: +//?[ft])*(?: +//?pid +${VAL})(?: +//?[ft])*`,
  stop: `stop-process(?: +-force)? +-id +(?:${VAL}|${PORT})(?: +-force)?`,
  // The one pipeline whose PIDs come from a port: `$_` counts only here.
  pipe: 'get-nettcpconnection +-localport +[0-9]{1,5} *\\| *(?:%|foreach-object) *\\{ *stop-process +-id +\\$_\\.(?:owningprocess|id)(?: +-force)? *\\}',
  // `kill` is the same command as Stop-Process in PowerShell, so only Bash has this one.
  bash: `kill(?: +(?:-(?:9|term|kill|hup|int|[0-9]{1,2})|-s +[a-z0-9]{2,9}))? +(?:${NUM}|\\$[a-z_][a-z0-9_]*)(?: +(?:${NUM}|\\$[a-z_][a-z0-9_]*))*`,
}

// Where a form may start and end: the command's start or a separator, and its end or a separator.
const clearRegex = (shell: 'Bash' | 'PowerShell') => new RegExp(
  `(^[ \\t]*|[;|&\\n({][ \\t]*)(?:${[FORMS.taskkill, FORMS.stop, FORMS.pipe, ...(shell === 'Bash' ? [FORMS.bash] : [])].join('|')})${REDIR}(?=[ \\t]*(?:$|[;|&\\r\\n)}]))`,
  'gi',
)

const CLEAR_MARK = '\u0003'

// ---- Splitting ----

type Seg = { words: string[]; raw: string; end: string; subst: boolean }

type Split = { segs: Seg[]; broken: boolean; escapedQuote: boolean }

// Splits on unquoted ; | || & && newline ( ) and stand-alone { }, quotes out of the words.
// `broken`: a quote never closes. `escapedQuote`: a `\"` or `` `" `` somewhere, which the
// two shells read differently, so no text counts as text.
function split(command: string): Split {
  const segs: Seg[] = []
  let words: string[] = []
  let word = ''
  let hasWord = false
  let raw = ''
  let subst = false
  let quote: '"' | "'" | null = null
  let escapedQuote = false
  const braces: ('b' | 'w')[] = []
  const endWord = () => {
    if (hasWord) words.push(word)
    word = ''
    hasWord = false
  }
  const endSegment = (end: string) => {
    endWord()
    if (words.length > 0) segs.push({ words, raw: raw.trim(), end, subst })
    else if (segs.length > 0 && end !== '') segs[segs.length - 1] = { ...segs[segs.length - 1]!, end: segs[segs.length - 1]!.end + end }
    words = []
    raw = ''
    subst = false
  }
  for (let i = 0; i < command.length; i++) {
    const c = command[i] ?? ''
    const next = command[i + 1] ?? ''
    if ((c === '\\' || c === '`') && (next === '"' || next === "'")) {
      escapedQuote = true
      word += c + next
      raw += c + next
      hasWord = true
      i++
      continue
    }
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
    const prev = command[i - 1] ?? ''
    if (c === '{') {
      // A block opens at a word start (unless it is a brace expansion `{a,b}`) or glued to
      // `%`, `foreach`, `foreach-object`; any other `{` (`${p}`, `@{…}`, `pk{i,}ll`) is part of its word.
      const close = command.indexOf('}', i + 1)
      const inner = close < 0 ? '' : command.slice(i + 1, close)
      const opens = word === '' && !hasWord
        ? /\s/.test(next) || next === '' || !/,|\.\./.test(inner)
        : /^(?:%|foreach|foreach-object)$/i.test(word)
      braces.push(opens ? 'b' : 'w')
      if (opens) {
        endSegment(c)
      } else {
        word += c
        raw += c
        hasWord = true
      }
      continue
    }
    if (c === '}') {
      const top = braces[braces.length - 1]
      if (top === 'b') {
        braces.pop()
        endSegment(c)
        continue
      }
      const spaced = (/[\s;|&(){}]/.test(prev) || i === 0) && (/[\s;|&(){}]/.test(next) || next === '')
      if (top === 'w' || !spaced) {
        if (top === 'w') braces.pop()
        word += c
        raw += c
        hasWord = true
        continue
      }
      endSegment(c)
      continue
    }
    // `&>` and `&>>` redirect both streams: the `&` is not a separator.
    if (c === '&' && next === '>' && prev !== '&') {
      word += c
      raw += c
      hasWord = true
      continue
    }
    if (c === ';' || c === '|' || c === '&' || c === '\n' || c === '\r' || c === '(' || c === ')') {
      // `2>&1`, `>&` and `<&` are redirections.
      if (c === '&' && (prev === '>' || prev === '<')) {
        word += c
        raw += c
        hasWord = true
        continue
      }
      if (c === '(' && /[$@<>]/.test(prev)) subst = true
      let sep = c
      if ((c === '|' || c === '&') && next === c) {
        sep = c + c
        i++
      }
      endSegment(sep)
      continue
    }
    if (/\s/.test(c)) {
      endWord()
      raw += c
      continue
    }
    word += c
    hasWord = true
    raw += c
  }
  const broken = quote !== null
  endSegment('')
  return { segs, broken, escapedQuote }
}

// ---- Quoted here-documents ----

// A quoted here-document is data for the command that reads it: its body is taken
// out of the text (so its quotes and parentheses do not confuse the split) and
// put back wherever the command is not one that only prints text.
function takeBodies(command: string): { text: string; bodies: string[] } {
  const bodies: string[] = []
  const keep = (body: string) => `@@B${bodies.push(body) - 1}@@`
  // A `<<'X'` counts only outside quotes (the first form may sit in double quotes: `"$(cat <<'X'`).
  const text = command
    // `(?:…)??` is lazy: an empty body (the delimiter line right after) wins over a later delimiter line.
    .replace(/\$\(\s*cat\s+<<-?\s*(['"])(\w+)\1[ \t]*\r?\n(?:([\s\S]*?)\r?\n)??[ \t]*\2[ \t]*\r?\n?\s*\)/g,
      (m: string, _q: string, _d: string, body: string | undefined, offset: number, whole: string) =>
        quoteAt(whole, offset) === "'" ? m : keep(body ?? ''))
    .replace(/<<-?\s*(['"])(\w+)\1([^\r\n]*)\r?\n(?:([\s\S]*?)\r?\n)??[ \t]*\2[ \t]*(?=\r?\n|$)/g,
      (m: string, _q: string, _d: string, rest: string, body: string | undefined, offset: number, whole: string) =>
        quoteAt(whole, offset) !== null ? m : `<<${keep(body ?? '')}${rest}`)
  return { text, bodies }
}

// The quote open at `index` when the text is read left to right like `split` does.
function quoteAt(text: string, index: number): '"' | "'" | null {
  let quote: '"' | "'" | null = null
  for (let i = 0; i < index; i++) {
    const c = text[i] ?? ''
    if (quote === "'") {
      if (c === "'") quote = null
    } else if (c === '\\') i++
    else if (quote === '"') {
      if (c === '"') quote = null
    } else if (c === '"' || c === "'") quote = c
  }
  return quote
}

// A redirection outside quotes that writes somewhere: `>`, `>>`, `1>`. `2>&1`, `>&2` and the null
// devices write nothing.
function writesFile(raw: string): boolean {
  let quote: '"' | "'" | null = null
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i] ?? ''
    if (quote !== null) {
      if (c === quote) quote = null
    } else if (c === '"' || c === "'") quote = c
    else if (c === '>') {
      let j = i + 1
      if (raw[j] === '>') j++
      const target = raw.slice(j).replace(/^[ \t]*/, '')
      if (!/^(?:&[12]|\/dev\/null|nul|\$null)(?![\w/.\\-])/i.test(target)) return true
      i = j
    }
  }
  return false
}

// ---- Judging ----

// Only commands that print or search text; their arguments are data.
const TEXT_COMMANDS = new Set([
  'echo', 'printf', 'write-host', 'write-output', 'grep', 'egrep', 'fgrep', 'rg', 'select-string', 'findstr',
])
const GIT_TEXT = new Set(['commit', 'log', 'grep', 'show'])

// What a text segment may be piped into: other text commands or plain filters.
const FILTERS = new Set([
  'head', 'tail', 'wc', 'sort', 'uniq', 'cat', 'less', 'more', 'cut', 'tr',
  'select-object', 'measure-object', 'sort-object', 'out-host', 'out-null', 'out-string',
])

// A runner of other text: when one is in the command, a name in a text command
// may be what it runs, so no text counts as text.
const RUNNERS = new Set([
  'node', 'python', 'python3', 'py', 'bash', 'sh', 'zsh', 'dash', 'cmd', 'pwsh', 'powershell', 'iex', 'invoke-expression',
  'source', '.', 'eval', 'wsl', 'perl', 'ruby', 'deno', 'bun', 'npx', 'exec', 'invoke-command', 'icm', 'start-process', 'saps',
])

const nameOf = (seg: Seg) => lastPart(seg.words[0] ?? '').replace(/\.exe$/, '')
const isPlain = (word: string) => /^[A-Za-z][A-Za-z0-9._-]*$/.test(word)

function isTextCommand(seg: Seg): boolean {
  const first = seg.words[0] ?? ''
  if (!isPlain(first) || seg.subst || /\$\(|`|<\(|>\(/.test(seg.raw) || writesFile(seg.raw)) return false
  const name = first.toLowerCase().replace(/\.exe$/, '')
  const words = seg.words.map(w => w.toLowerCase())
  if (TEXT_COMMANDS.has(name)) {
    return !words.some(w => w.startsWith('--pre') || w === '-exec' || w === '-execdir')
  }
  if (name === 'git') {
    // `git grep -O<cmd>` and `--ext-diff` run programs.
    return GIT_TEXT.has(words[1] ?? '') && !seg.words.some(w => /^-O/.test(w)) &&
      !words.some(w => w.startsWith('--open-files-in-pager') || w.startsWith('--ext-diff') || w.startsWith('--exec'))
  }
  if (name === 'gh') return words[1] === 'pr' && (words[2] === 'create' || words[2] === 'comment')
  return false
}

const isFilter = (seg: Seg) => {
  const first = seg.words[0] ?? ''
  const name = first.toLowerCase().replace(/\.exe$/, '')
  // A filter that writes (`> f`, `sort -o f`, `sort --output=f`) is no filter.
  const writes = writesFile(seg.raw) || (name === 'sort' && seg.words.some(w => /^-[a-z]*o|^--output/i.test(w)))
  return isPlain(first) && FILTERS.has(name) && !seg.subst && !/\$\(|`|<\(|>\(/.test(seg.raw) && !writes
}

const isVariableCommand = (seg: Seg) => {
  const first = seg.raw.trimStart().replace(/^["']+/, '')
  if (!/^(\$|%[^%\s]+%)/.test(first)) return false
  const w1 = seg.words[1] ?? ''
  const isAssignment = /^[+\-*/]?=$/.test(w1) || /^(\+\+|--)$/.test(w1) || /^\$[\w:{}.]*[+\-*/]?=/.test(seg.words[0] ?? '')
  return !isAssignment
}

// ---- Python one-liners that only handle data (CRE-GRD-FP-1, R1) ----

// A `python -c "<code>"` one-liner read as data: the bare word `kill` inside its code (`'kill' in line`)
// is then no command. Closed form, everything else keeps the rule's old verdict: the segment is exactly
// `python|python3|py [-I|-B|-u]... -c <code>` with at most `2>&1` or a null redirect after it (no `$`,
// backtick, substitution or file written); the code imports only plain-data modules (`os` is allowed,
// `from os import` only for `path`) and has no way to start a program, reach a module by name or build
// an attribute from text (`__`, getattr and friends, eval/exec/compile, subprocess, system, popen,
// spawn, exec*, fork, startfile, signal, ctypes, operator, modules, `._x`) and no `.kill`/`.terminate`
// attribute. The names `taskkill`, `pkill`, `killall`, `wmic` and the rest of KILL_NAMES are not
// relaxed: hasName still stops them wherever they are.
const PYTHON = new Set(['python', 'python3', 'py'])
const PY_FLAGS = new Set(['-I', '-B', '-u'])
const PY_MODULES = new Set([
  'json', 'sys', 're', 'pathlib', 'collections', 'csv', 'itertools', 'math', 'datetime', 'textwrap', 'string', 'statistics', 'glob', 'os',
])
const PY_FORBIDDEN = /__|\.\s*_|\.\s*(?:kill|terminate|abort)|getattr|setattr|delattr|globals|locals|\bvars\b|eval|exec|compile|\binput\b|breakpoint|importlib|builtins|subprocess|system|popen|spawn|fork|startfile|ctypes|signal|\bpty\b|operator|attrgetter|methodcaller|modules|formatter|get_field|\bimport\b[^;\n]*[\s,]_/

function pythonCodeIsData(code: string): boolean {
  const text = code.toLowerCase()
  if (PY_FORBIDDEN.test(text)) return false
  // `from <module> import <names>`: `os` only for `path`.
  let rest = text
  for (const m of text.matchAll(/\bfrom\s+([\w.]+)\s+import\b([^;\n]*)/g)) {
    const root = (m[1] ?? '').split('.')[0] ?? ''
    if (!PY_MODULES.has(root)) return false
    if (m[1] === 'os' && !/^\s*path\s*$/.test(m[2] ?? '')) return false
  }
  rest = rest.replace(/\bfrom\s+[\w.]+\s+import\b[^;\n]*/g, ' ')
  for (const m of rest.matchAll(/\bimport\s+([^;\n]+)/g)) {
    for (const part of (m[1] ?? '').split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0]?.trim() ?? ''
      if (!PY_MODULES.has(name.split('.')[0] ?? '')) return false
    }
  }
  return true
}

function isPythonData(seg: Seg): boolean {
  if (!PYTHON.has(nameOf(seg)) || seg.subst || /[$`]|<\(|>\(/.test(seg.raw)) return false
  let i = 1
  while (PY_FLAGS.has(seg.words[i] ?? '')) i++
  if (seg.words[i] !== '-c') return false
  const code = seg.words[i + 1]
  if (code === undefined) return false
  const after = seg.words.slice(i + 2)
  if (!after.every(w => /^(?:2>&1|[12]?>\/dev\/null)$/i.test(w))) return false
  return pythonCodeIsData(code)
}

// Rule 3 (CRE-GRD-FP-1, ronda 2): may an interpreter segment beside a read-only `gh pr` count as no merge?
// Only python: `python|python3|py [-I|-B|-u] -c "<code>"` with at most `2>&1` or a null redirect after it,
// no `$`, backtick or substitution, and code in the data-only form above (reading `sys.stdin` as data is
// fine; `exec`, `eval`, `compile`, `input`, `system`, `subprocess`, `getattr`, `__`… are not). A bare
// interpreter (`python`, `python -`), a script, `-m`, or a program taken from the pipe stays unclear. Node,
// perl and ruby never count (always false): a list of forbidden words cannot close a language where a name
// is built by concatenation and reached by index (`module['req'+'uire']`, `readpipe`, `to_sym.to_proc`),
// or loaded from an environment variable (`NODE_OPTIONS`, `PERL5OPT`). The caller refuses an assignment or a
// wrapper before the interpreter (`PYTHONPATH=. python -c …` would load a planted module).
export function inlineCodeIsData(name: string, words: string[], raw: string): boolean {
  if (!PYTHON.has(name) || /[$`]|<\(|>\(/.test(raw)) return false
  let i = 1
  while (PY_FLAGS.has(words[i] ?? '')) i++
  const code = words[i + 1]
  if (words[i] !== '-c' || code === undefined) return false
  if (!words.slice(i + 2).every(w => /^(?:2>&1|[12]?>\/dev\/null)$/i.test(w))) return false
  return pythonCodeIsData(code)
}

// What follows a segment in a pipe must be text commands or plain filters, never something that runs it.
function feedsOnlyText(segs: Seg[], index: number): boolean {
  let end = segs[index]?.end ?? ''
  for (let j = index + 1; /\|/.test(end) && !/\|\|/.test(end); j++) {
    const follow = segs[j]
    if (follow === undefined) break
    if (!isTextCommand(follow) && !isFilter(follow)) return false
    end = follow.end
  }
  return true
}

const pythonDataSegs = (segs: Seg[], ok: boolean) =>
  new Set(ok ? segs.filter((s, i) => isPythonData(s) && feedsOnlyText(segs, i)) : [])

// `-Name`, `-ProcessName` and any abbreviation of them.
const NAME_FLAG = /(?:stop-process|spps|(?:^|[^a-z0-9])kill)(?![a-z0-9-])[^|;&]*? -(?:n|na|nam|name|p|pr|pro|proc|proce|proces|process|processn|processna|processnam|processname)(?=[ :=]|$)/

function shapeOf(text: string): string | undefined {
  const f = flat(text)
  if (/taskkill(?:\.exe)?[^|;&]*(?:^| )[/-]{1,2}(?:im|fi)(?= |$)/.test(f)) return 'taskkill /IM'
  if (/(^|[^a-z0-9])pkill([^a-z0-9]|$)/.test(f)) return 'pkill'
  if (/(^|[^a-z0-9])killall([^a-z0-9]|$)/.test(f)) return 'killall'
  if (/(^|[^a-z0-9])(tskill|pskill)([^a-z0-9]|$)/.test(f)) return 'tskill'
  if (NAME_FLAG.test(f)) return /stop-process/.test(f) ? 'Stop-Process -Name' : /spps/.test(f) ? 'spps -Name' : 'kill -Name'
  return undefined
}

const excerpt = (text: string) => {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > 60 ? `${t.slice(0, 57)}...` : t
}

// What the command does with process killers, or undefined when it names none or only
// in the clear forms and in text. `kind` 'name': a recognizable close by name; 'unclear':
// anything else the parse does not follow with certainty.
export function findKill(command: string, shell: 'Bash' | 'PowerShell' = 'Bash'): Kill | undefined {
  // A continuation joins the words around it: `\` + newline in Bash, `` ` `` + newline in PowerShell.
  const joined = shell === 'Bash' ? command.replace(/\\\r?\n/g, '') : command.replace(/`\r?\n/g, '')
  const original = joined.replace(new RegExp(CLEAR_MARK, 'g'), '')
  const { text: withoutBodies, bodies } = takeBodies(original)
  if (shell === 'Bash' && /\$'(?:[^'\\]|\\.)*?\\(?:x[0-9a-f]|u[0-9a-f]|U[0-9a-f]|[0-7])/i.test(withoutBodies)) {
    return { kind: 'escape', why: "$'\\x..' (ANSI-C de Bash)" }
  }
  if (shell === 'PowerShell' && /`u\{/i.test(withoutBodies)) return { kind: 'escape', why: '`u{..} de PowerShell' }
  const marked = withoutBodies.replace(clearRegex(shell), (_m, lead: string) => `${lead}${CLEAR_MARK}`)
  const expand = (text: string) => text.replace(/@@B(\d+)@@/g, (_m, n: string) => bodies[Number(n)] ?? '')

  const { segs, broken, escapedQuote } = split(marked)
  // A read-only `python -c` one-liner: the bare word `kill` in its code is data (R1 of CRE-GRD-FP-1).
  const dataOk = !broken && !escapedQuote
  const pyData = pythonDataSegs(segs, dataOk)
  // `kill` counts only as a command: first in its segment (after assignments) or after a wrapper;
  // inside a nested interpreter's text any `kill` word counts. `docker kill`, `kill-port`, a branch
  // named fix/kill are arguments or other words.
  const killCommand = (seg: Seg) => {
    if (RUNNERS.has(nameOf(seg)) && KILL_WORD.test(flat(expand(seg.raw))) && !pyData.has(seg)) return true
    // `namesOriginal` below splits the text again, so its segments are never in `pyData`: the relaxation
    // applies only to the marked split, and a variable as command still counts the word `kill` as a name there.
    const words = seg.words
    let start = 0
    let wrapped = false
    // Assignments and Bash control words put the next word in command position.
    while (start < words.length) {
      const w = words[start] ?? ''
      const control = CONTROL.has(w.toLowerCase())
      if (!control && !/^[a-z_][a-z0-9_]*=/i.test(w)) break
      if (WRAPPERS.has(w.toLowerCase())) wrapped = true
      start++
    }
    for (let i = start; i < words.length; i++) {
      const w = words[i] ?? ''
      if (isKillWord(w) && (i === start || wrapped)) return true
      if (WRAPPERS.has(lastPart(w))) wrapped = true
    }
    return false
  }
  const namesSeg = (seg: Seg) => hasName(expand(seg.raw)) || killCommand(seg) || seg.words.some(globHit)
  const namesOriginal = hasName(original) || split(withoutBodies).segs.some(s => killCommand(s) || s.words.some(globHit))

  if (!namesOriginal && !segs.some(namesSeg)) return undefined

  const textOk = !broken && !escapedQuote && !segs.some(s => RUNNERS.has(nameOf(s)))
  // The worst segment so far: one with a recognizable close by name beats the rest.
  const worst: { text?: string } = {}
  const note = (seg: Seg) => {
    const text = expand(seg.raw)
    if (worst.text === undefined || (shapeOf(worst.text) === undefined && shapeOf(text) !== undefined)) worst.text = text
  }

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]!
    if (!namesSeg(seg)) continue
    if (textOk && isTextCommand(seg)) {
      // Its output must go nowhere that runs it: only text commands and plain filters follow in a pipe.
      let end = seg.end
      for (let j = i + 1; /\|/.test(end) && !/\|\|/.test(end); j++) {
        const follow = segs[j]
        if (follow === undefined) break
        if (!isTextCommand(follow) && !isFilter(follow)) {
          note(seg)
          break
        }
        end = follow.end
      }
      continue
    }
    note(seg)
  }

  if (worst.text !== undefined) {
    const shaped = shapeOf(worst.text)
    return shaped !== undefined ? { kind: 'name', why: shaped } : { kind: 'unclear', why: excerpt(worst.text) }
  }
  // A variable as the command, in a command that names a killer anywhere: it may hold one.
  const variable = segs.find(isVariableCommand)
  if (variable !== undefined && namesOriginal) return { kind: 'unclear', why: `variable como comando: ${excerpt(variable.raw)}` }
  return undefined
}
