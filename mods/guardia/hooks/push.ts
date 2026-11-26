// Rule 7: a push passes only in one of the method's three clear forms, in any folder. Pure logic, no `$`.
//
// The permission globs of templates/permisos-proyecto.json cannot tell `git push -u origin tarea/x`
// from `git push origin tarea/x -uf` (grouped short flags) or `git push origin tarea/x ref*` (a
// refspec pattern that pushes main), and they miss the forms with no branch or with git's global
// options before `push` (CRE-PUSH-1, report from a project). Same design as rules 3 to 6:
// a closed list of clear forms, a closed list of texts that only mention a push, and fail closed
// for the rest. Nothing here runs.

import { commandName, segments } from './rules.ts'
import {
  bare, EXECUTORS, expands, FILTERS, INVISIBLE, isText, joinContinuations, low, nameOf, pipedInto, strip, writesFile,
} from './worktree.ts'

const FORMS = '`git push -u origin tarea/<n>`, `git push origin tarea/<n>` y `git push origin --delete tarea/<n>` ' +
  '(literales, con espacios simples y, a lo más, ` 2>&1` al final; `<n>` solo minúsculas, dígitos y guiones, sin main, master ni head)'

export const MSG_PUSH = (what: string) =>
  `guardia: este push no está en la forma clara (${what}), así que lo frené. Solo pasan ${FORMS}. ` +
  'Un push distinto (otra rama, otras banderas, opciones de git antes de `push`, una tubería) lo hace el responsable: pídeselo.'

export const MSG_PUSH_UNCLEAR = (what: string) =>
  `guardia: este comando podría hacer un push (${what}) y no lo entiendo con certeza (opción de git, alias, variable, intérprete, envoltura, sustitución o texto que se ejecuta), así que lo frené. ` +
  `Solo pasan ${FORMS}; un push distinto lo hace el responsable. ` +
  'Si solo lo mencionas como texto, usa `echo`, `grep`, `rg`, `git grep`, `git log --grep`, `git commit -m` (sin `-C` ni `-c` delante: la plantilla de permisos los bloquea cuando el texto dice push; corre el commit desde la carpeta del repo) o `gh pr create|edit|comment --body` con texto literal, sin `$(…)` ni acento grave.'

export type Push = { kind: 'push' | 'unclear'; why: string }

// The words of a text as the shells may split them, escapes out: `"git push x"`, `alias.p=push`,
// `push>out` and `pu\sh` all name `push`; `tarea/fix-push` does not. Read twice: split at the
// quotes (a quoted text) and with the quotes removed, the way the shell joins `pu"sh"`, `pu''sh`
// and `"pu"sh` into one word (A1 of the stage 2 audit). The typographic quotes ‘ ’ ‚ ‛ “ ” „
// (U+2018 to U+201E) count too: PowerShell reads them as quotes (A1, round 2).
const QUOTE = /["'‘-„]/g
const tokens = (text: string) =>
  text.replace(INVISIBLE, '').split(/[\s"'‘-„();|&=<>{},]+/).filter(t => t !== '')
const unquoted = (text: string) => text.replace(QUOTE, '')
const readings = (text: string) => [tokens(text), tokens(unquoted(text))]
export const namesPush = (text: string) => readings(text).some(r => r.some(t => low(t) === 'push'))
const isGit = (t: string) => [commandName(t), commandName(bare(t))].some(n => /^git(\.exe|\.cmd|\.bat)?$/.test(n))
const namesGit = (text: string) => readings(text).some(r => r.some(isGit))

// The text with each `$(…)` removed, nested parentheses included and parentheses inside quotes
// skipped (`pu$(echo $(true))sh`, `pu$(:;(:))sh`); `at`, where it starts, when one does not close.
function dropSubstitutions(text: string): { text: string } | { at: number } {
  let out = ''
  let i = 0
  while (i < text.length) {
    if (text[i] !== '$' || text[i + 1] !== '(') {
      out += text[i++]
      continue
    }
    let depth = 0
    let quote = ''
    let j = i + 1
    for (; j < text.length; j++) {
      const c = text[j] ?? ''
      if (quote !== '') {
        if (c === quote) quote = ''
      } else if (c === '"' || c === "'") quote = c
      else if (c === '(') depth++
      else if (c === ')' && --depth === 0) break
    }
    if (j >= text.length) return { at: i }
    i = j + 1
  }
  return { text: out }
}

// The text with quotes and expansions removed: `pu${x}sh`, `pu$()sh`, `pu$1sh`, `pu$@sh`, `pu$''sh`,
// `` pu`true`sh ``, `%p%sh` and `pus{h,}` become `push`. A push that only shows up this way is armed
// by the shell. The `$` before a quote goes first (`$''`, `$""`), or `$sh` would read as a variable.
const squashRest = (text: string) => text
  .replace(/`[^`]*`/g, '').replace(/\$(?=["'‘-„])/g, '').replace(QUOTE, '')
  .replace(/\$\{[^}]*\}|\$[@*#?!$0-9-]|\$[A-Za-z_][A-Za-z0-9_]*|\$|%[^%\s]*%|[{}`]/g, '')
const armsPush = (squashed: string) => namesPush(squashed) && namesGit(squashed)

// A `$(` that does not close (M4 of round 3: an apostrophe or a lone `"` inside it, as in a
// heredoc commit body) is cut out to each word end or `)` after it, and to the end: the command
// stops only when one of those readings arms a push (`git pu$(echo sh origin main`). Naming git
// alone is not enough. A second unclosed `$(` in a reading only loses its two characters.
function unclosedArmsPush(text: string, at: number): boolean {
  for (let j = at + 2; j <= text.length; j++) {
    if (j !== at + 2 && j !== text.length && !/[\s)]/.test(text[j - 1] ?? '')) continue
    const cut = text.slice(0, at) + text.slice(j)
    const inner = dropSubstitutions(cut)
    if (armsPush(squashRest('text' in inner ? inner.text : cut.replace(/\$\(/g, '')))) return true
  }
  return false
}

const hidesPush = (text: string) => {
  if (namesPush(text)) return false
  const t = text.replace(INVISIBLE, '')
  const dropped = dropSubstitutions(t)
  return 'at' in dropped ? unclosedArmsPush(t, dropped.at) : armsPush(squashRest(dropped.text))
}

// The three clear forms, whole segment, with ` 2>&1` as the only tail.
const CLEAR = /^git push (?:-u origin|origin|origin --delete) tarea\/([a-z0-9-]+)(?: 2>&1)?$/
const isClear = (raw: string) => {
  const name = CLEAR.exec(raw)?.[1]
  return name !== undefined && !/main|master|head/.test(name)
}

const WITH_VALUE = new Set(['-C', '-c', '--namespace', '--super-prefix', '--config-env', '--git-dir', '--work-tree', '--attr-source'])
const REDIRECT = /^(\d*|&)[<>]/

// Where git's subcommand is, after its global options.
function subAt(words: string[]): number {
  let i = 1
  while (i < words.length) {
    const w = bare(words[i] ?? '')
    if (REDIRECT.test(w)) i++
    else if (WITH_VALUE.has(w)) i += 2
    else if (w.startsWith('-')) i++
    else break
  }
  return i
}

// Git subcommands that only store, search or show the word: rule 6's git texts, plus (only for
// rule 7, M3 of the stage 2 audit) `stash` (`git stash push` pushes nothing), `tag` and `notes`
// messages and `git help push`.
const GIT_TEXTS = new Set(['commit', 'log', 'grep', 'stash', 'tag', 'notes', 'help'])

// `git [-C <ruta>|-c <k=v>|--no-pager|-P] <text subcommand> …` that only stores or searches the
// word: `-c` counts only before `commit` (a `-c core.pager=…` before `log` or `grep` runs a
// program), and `push` may show only after the subcommand.
function isGitText(words: string[], at: number, raw: string): boolean {
  if (/[`]|\$\(|<\(/.test(raw) || writesFile(raw)) return false
  let i = 1
  let hasConfig = false
  while (i < at) {
    const w = words[i] ?? ''
    if (w === '-C' || w === '-c') {
      hasConfig ||= w === '-c'
      i += 2
    } else if (w === '--no-pager' || w === '-P') i++
    else return false
  }
  const sub = words[at] ?? ''
  if (i !== at || !GIT_TEXTS.has(sub) || (hasConfig && sub !== 'commit')) return false
  if (words.slice(1, at).some(namesPush)) return false
  return !words.slice(at + 1).some(w => /^(-O|--open-files-in-pager|--ext-diff|--textconv)/.test(w))
}

// `gh issue create|comment` with a body that only stores the word (rule 7 only), same conditions.
const isIssueText = (words: string[], raw: string) =>
  !/[`]|\$\(|<\(/.test(raw) && !writesFile(raw) && nameOf(words[0] ?? '') === 'gh' &&
  low(words[1] ?? '') === 'issue' && ['create', 'comment'].includes(low(words[2] ?? ''))

const excerpt = (words: string[]) => {
  const t = words.join(' ').replace(/\s+/g, ' ').trim()
  return t.length > 60 ? `${t.slice(0, 57)}...` : t
}

// A single `|` (not `||`) right before or after a piece of the text.
const pipedBefore = (text: string) => /(^|[^|])\|$/.test(text.trimEnd())
const pipedAfter = (text: string) => /^\|(?!\|)/.test(text.trimStart())

// Whether a command may push outside the clear forms; undefined when it pushes only in a clear
// form, names no push, or names it only as text. Read joined and unjoined, like rule 6: a wrong
// joining must not hide the next line, and a backtick or a continuation voids the text exemption.
export function findPush(command: string): Push | undefined {
  const joined = joinContinuations(command)
  // A push armed from fragments (`pu${x}sh`, `pu$()sh`, `-c alias.p=pu${x}sh`) is no clear form.
  const hidden = [command, joined].find(hidesPush)
  if (hidden !== undefined) return { kind: 'unclear', why: excerpt(hidden.split(/\s+/)) }
  // An expansion or a wildcard as git's subcommand may stand for push, named or not (closing M2).
  const expanded = [command, joined].map(expandedSub).find(w => w !== undefined)
  if (expanded !== undefined) return { kind: 'unclear', why: expanded }
  if (!namesPush(command) && !namesPush(joined)) return undefined
  const continued = /[\\`]\r?\n/.test(command) && namesPush(joined)
  const noText = command.includes('`') || continued
  const found = [read(joined, noText), read(command, noText)]
  return found.find(f => f?.kind === 'push') ?? found.find(f => f !== undefined)
}

// The first git segment whose subcommand (after the global options) holds an expansion or a
// shell wildcard (`git ${x:-push} …`, `git $a$b …`, `git pus[h] …`, `git pu$(echo s)h …`). Accepted
// cost: every `git $var …` stops; write the subcommand literally. Options with an expanded value
// (`git -C "$dir" commit`) do not count: `subAt` skips them.
function expandedSub(text: string): string | undefined {
  let pos = 0
  for (const s of segments(text)) {
    const at = text.indexOf(s.raw, pos)
    const end = at < 0 ? pos : at + s.raw.length
    pos = end
    const words = strip(s.words)
    if (nameOf(words[0] ?? '') !== 'git') continue
    const i = subAt(words)
    const sub = words[i]
    if (sub !== undefined && expands(sub)) return excerpt(words)
    // A PowerShell expression as the subcommand (`git ('pu'+'sh') …`): `segments` splits at the `(`.
    if (sub === undefined && text.slice(end).trimStart().startsWith('(')) return excerpt(words)
  }
  return undefined
}

// An alias or a function for git defined in the command (closing M1): `Set-Alias gx git`,
// `New-Alias`, `sal`, `nal`, `alias gx=git`, `doskey gx=git $*`, `gx() { git …; }`, `function gx { git … }`.
// Then any segment that names push may be that git.
const ALIASERS = new Set(['set-alias', 'new-alias', 'sal', 'nal', 'alias', 'doskey', 'function'])
const definesGit = (text: string, segs: ReturnType<typeof segments>) =>
  segs.some(s => ALIASERS.has(low(strip(s.words)[0] ?? '')) && namesGit(s.raw)) ||
  // `name()` counts only outside quotes: `echo "usa main() y git push"` defines nothing.
  (/(^|[\s;&|(])[A-Za-z_][\w-]*\s*\(\s*\)/.test(text.replace(/"[^"]*"|'[^']*'/g, '""')) && namesGit(text))

function read(text: string, noText: boolean): Push | undefined {
  const segs = segments(text)
  const aliased = definesGit(text, segs)
  const substitutes = /[`]|\$\(|<\(/.test(text)
  const runsText = segs.some(s => {
    const w = strip(s.words)
    const first = w[0] ?? ''
    return EXECUTORS.has(nameOf(first)) || /^[$%&@.{-]/.test(first) || first.endsWith('{')
  }) || pipedInto(text).some(n => !FILTERS.has(n))
  const pushed = namesPush(text)
  let push: string | undefined
  let unclear: string | undefined
  let pos = 0
  for (const s of segs) {
    const at = text.indexOf(s.raw, pos)
    const start = at < 0 ? pos : at
    const end = at < 0 ? pos : at + s.raw.length
    pos = end
    const words = strip(s.words)
    // An assignment, `env` or a control word before the command (A3 of round 2): the program
    // it names may run (`GIT_EDITOR="git push … #" git commit`), so no text exemption, as in rule 3.
    const prefixed = words.length !== s.words.length
    if (nameOf(words[0] ?? '') === 'git') {
      const i = subAt(words)
      const sub = low(words[i] ?? '').replace(QUOTE, '')
      if (/^push([<>]|$)/.test(sub)) {
        const piped = pipedBefore(text.slice(0, start)) || pipedAfter(text.slice(end))
        if (!isClear(s.raw) || piped) push ??= excerpt(words)
        continue
      }
      // The subcommand may be an expansion standing for `push` (`p=push; git $p origin main`),
      // and a word of the segment may arm it from fragments (`-c alias.p=pu${x}sh`).
      if (((sub === '' || expands(words[i] ?? '')) && pushed) || hidesPush(s.raw)) {
        unclear ??= excerpt(words)
        continue
      }
      if (!namesPush(s.raw)) continue
      if (!runsText && !noText && !prefixed && isGitText(words, i, s.raw)) continue
      unclear ??= excerpt(words)
      continue
    }
    if (!namesPush(s.raw)) continue
    if (aliased) {
      unclear ??= excerpt(words.length > 0 ? words : s.words)
      continue
    }
    if (!runsText && !noText && !prefixed && (isText(words, s.raw) || isIssueText(words, s.raw))) continue
    if (namesGit(s.raw) || substitutes || runsText || /[$%@]/.test(s.raw) || words.length === 0) {
      unclear ??= excerpt(words.length > 0 ? words : s.words)
    }
  }
  if (push !== undefined) return { kind: 'push', why: push }
  if (unclear !== undefined) return { kind: 'unclear', why: unclear }
  return undefined
}
