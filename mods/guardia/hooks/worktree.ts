// Rule 6: no `git worktree remove`, with or without --force, in any folder. Pure logic, no `$`.
//
// Even without --force, Git follows a junction that .gitignore ignores (a linked
// `node_modules`) and empties its target: in landing-cliente it emptied the repository's own
// folder, and the orchestrator reproduced it with git 2.53 (CRE-GRD-WT-1, audit A1).
// Archiving the session leaves the worktree in the app's reserve; removing it is the owner's job.
//
// Fails closed: once the command names `worktree` and `remove` as words, it passes only
// when every piece that names either word is a closed-list text (echo, grep, a commit
// message, a PR body…) and nothing in the command runs other text, or a plain
// `git worktree <other verb>`. Whatever else (a plain remove, a continuation, a block, an
// assignment, a substitution, a variable, a wrapper or interpreter) stops. Nothing here runs.

import { commandName, commandWords, NESTED, segments } from './rules.ts'

const WHO = 'Al archivar la sesión, el worktree queda en la reserva de la app; quitarlo es del responsable, no tuyo. ' +
  'Aun sin `--force`, Git sigue una junction que el `.gitignore` ignora (p. ej. `node_modules`) y vacía su destino, como pasó en landing-cliente. ' +
  'Si terminaste, informa que el worktree queda para archivar; si hay que quitarlo ya, pídeselo al responsable.'

export const MSG_WORKTREE_REMOVE = (what: string) =>
  `guardia: no quites un worktree (${what}). ${WHO}`

export const MSG_WORKTREE_UNCLEAR = (what: string) =>
  `guardia: este comando podría quitar un worktree (${what}) y no lo entiendo con certeza (continuación de línea, bloque, asignación, sustitución, variable, intérprete o envoltura), así que lo frené. ${WHO} ` +
  'Si solo lo mencionas como texto, usa `echo`, `grep`, `rg`, `git grep`, `git log --grep`, `git commit -m` o `gh pr create|edit|comment --body` con texto literal, sin `$(…)` ni acento grave.'

export type WorktreeRemove = { kind: 'remove' | 'unclear'; why: string }

export const INVISIBLE = /[​-‍⁠﻿­]/g

// Line continuations joined the way the shells do: `\` + newline (Bash) and `` ` `` + newline (PowerShell).
export const joinContinuations = (command: string) => command.replace(/[\\`]\r?\n/g, '')

// A word with escapes and invisible characters out: `re\move`, `remo`ve`, `w^orktree`.
export const bare = (word: string) => word.replace(INVISIBLE, '').replace(/[\\`^]/g, '')
export const low = (word: string) => bare(word).toLowerCase()

// The text in two readings (a backslash as a folder and as an escape), lowercase, no quotes.
const readings = (text: string) => {
  const t = text.replace(INVISIBLE, '').toLowerCase().replace(/[`^"']/g, '')
  return [t.replace(/\\/g, '/'), t.replace(/\\/g, '')]
}
const word = (w: string) => new RegExp(`(^|[^a-z0-9_])${w}([^a-z0-9_]|$)`)
const WORKTREE = word('worktree')
const REMOVE = word('remove')
const namesWorktree = (text: string) => readings(text).some(t => WORKTREE.test(t))
const namesRemove = (text: string) => readings(text).some(t => REMOVE.test(t))

// Both words, joined or not, for the whole command and the fail-closed reading of register.ts.
export const namesWorktreeRemove = (text: string) =>
  [joinContinuations(text), text].some(t => readings(t).some(r => WORKTREE.test(r) && REMOVE.test(r)))

// A word the shell may still turn into something else.
const EXPANDS = /[$%`{}*?[\]]|^@/
export const expands = (w: string) => EXPANDS.test(w)

const CONTROL = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', '{', '}'])
const WITH_VALUE = new Set(['-C', '-c', '--namespace', '--super-prefix', '--config-env', '--git-dir', '--work-tree'])
const GLUED_VALUE = /^--(namespace|super-prefix|config-env|git-dir|work-tree|exec-path)=/
const PLAIN_OPTIONS = new Set([
  '--no-pager', '-P', '-p', '--paginate', '--no-optional-locks', '--no-replace-objects', '--literal-pathspecs',
  '--glob-pathspecs', '--noglob-pathspecs', '--icase-pathspecs', '--no-advice', '--bare',
])

// Commands that run other text or blocks, beyond the interpreters and wrappers of rule 3.
export const EXECUTORS = new Set([
  ...NESTED, 'start-job', 'start-threadjob', 'foreach-object', '%', 'where-object', '?', 'invoke-item', 'ii',
  'function', 'filter', 'busybox', 'git-bash', 'try', 'catch', 'finally', 'trap', 'at', 'batch', 'parallel',
])
// What a text may be piped into.
export const FILTERS = new Set([
  'head', 'tail', 'wc', 'sort', 'uniq', 'cat', 'cut', 'tr', 'less', 'more', 'grep', 'egrep', 'fgrep', 'rg', 'findstr',
  'select-string', 'sls', 'select-object', 'select', 'measure-object', 'measure', 'out-host', 'out-string', 'sort-object',
])
const TEXT_COMMANDS = new Set(['echo', 'printf', 'write-host', 'write-output', 'grep', 'egrep', 'fgrep', 'rg', 'select-string', 'sls', 'findstr'])

const excerpt = (words: string[]) => {
  const t = words.join(' ').replace(/\s+/g, ' ').trim()
  return t.length > 60 ? `${t.slice(0, 57)}...` : t
}

export const strip = (words: string[]) => {
  let w = words
  while (w.length > 0 && CONTROL.has((w[0] ?? '').toLowerCase())) w = w.slice(1)
  return commandWords(w)
}
export const nameOf = (first: string) => {
  const names = [commandName(first.replace(INVISIBLE, '')), commandName(bare(first))]
  return names.find(n => n === 'git' || EXECUTORS.has(n)) ?? names[0] ?? ''
}

// The pieces after each unquoted single `|` (not `||`), each one's first word.
export function pipedInto(command: string): string[] {
  const out: string[] = []
  let quote: string | null = null
  for (let i = 0; i < command.length; i++) {
    const c = command[i] ?? ''
    if (quote) {
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") quote = c
    else if (c === '|' && command[i + 1] !== '|' && command[i - 1] !== '|') {
      const next = segments(command.slice(i + 1).replace(/^&/, ''))[0]
      out.push(nameOf(strip(next?.words ?? [])[0] ?? ''))
    }
  }
  return out
}

// An unquoted `>` that writes to a file (the file may run later); null targets and `>&n` do not.
export function writesFile(raw: string): boolean {
  let quote: string | null = null
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i] ?? ''
    if (quote) {
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") quote = c
    else if (c === '>') {
      const target = raw.slice(i + 1).replace(/^>/, '').trimStart()
      if (!/^(&\d|\/dev\/null|nul|\$null)(\s|$)/i.test(target)) return true
    }
  }
  return false
}

// `git [globals] worktree <verb>`: the verb, or unclear; undefined when it is not git worktree.
function gitWorktree(words: string[]): { verb?: string; unclear?: true } | undefined {
  if (nameOf(words[0] ?? '') !== 'git') return undefined
  const rest = words.slice(1).filter(w => !/^(\d*|&)[<>]/.test(w) && w !== '}')
  let i = 0
  let isUnknown = false
  while (i < rest.length && bare(rest[i] ?? '').startsWith('-')) {
    const w = bare(rest[i] ?? '')
    if (WITH_VALUE.has(w)) i += 2
    else if (GLUED_VALUE.test(w) || PLAIN_OPTIONS.has(w)) i++
    else {
      isUnknown = true
      i++
    }
  }
  if (low(rest[i] ?? '') !== 'worktree') return isUnknown && rest.some(w => low(w) === 'worktree') ? { unclear: true } : undefined
  if (isUnknown) return { unclear: true }
  const after = rest.slice(i + 1)
  const verb = after.find(w => !bare(w).startsWith('-')) ?? ''
  if (verb === '' || expands(verb)) return { unclear: true }
  return { verb: low(verb) }
}

// A closed-list text that only shows or stores the words: echo, grep, a commit message, a PR body.
export function isText(words: string[], raw: string): boolean {
  if (/[`]|\$\(|<\(/.test(raw) || writesFile(raw)) return false
  const name = nameOf(words[0] ?? '')
  if (TEXT_COMMANDS.has(name)) return !(name === 'rg' && words.some(w => /^--pre/.test(w)))
  if (name === 'gh') return low(words[1] ?? '') === 'pr' && ['create', 'edit', 'comment'].includes(low(words[2] ?? ''))
  if (name !== 'git') return false
  let i = 1
  while (i < words.length) {
    const w = words[i] ?? ''
    if (w === '-C') i += 2
    else if (w === '--no-pager' || w === '-P') i++
    else break
  }
  if (!['commit', 'log', 'grep'].includes(words[i] ?? '')) return false
  return !words.slice(i + 1).some(w => /^(-O|--open-files-in-pager|--ext-diff|--textconv)/.test(w))
}

// Whether a command may remove a worktree; undefined when it names no such thing or only as text.
// The joining does not know the shell or an escaped escape (`D:\x\` in PowerShell, `\\` in
// Bash, a multi-line backtick substitution), so both readings are checked and either one
// stops; a backtick anywhere in the original voids the text exemption.
export function findWorktreeRemove(command: string): WorktreeRemove | undefined {
  const joined = joinContinuations(command)
  // A continuation in the original whose joined reading names both words: a text may hide a
  // real continuation after a wrongly joined one (`echo foo\\⏎git worktree \⏎remove x`).
  const continued = /[\\`]\r?\n/.test(command) && namesWorktreeRemove(joined)
  const noText = command.includes('`') || continued
  const found = [read(joined, noText), read(command, noText)]
  return found.find(f => f?.kind === 'remove') ?? found.find(f => f !== undefined)
}

function read(joined: string, noText: boolean): WorktreeRemove | undefined {
  const segs = segments(joined)
  // An expansion may stand for the missing word: `git $w remove x`, `git worktree $v x`.
  for (const s of segs) {
    const words = strip(s.words)
    if (nameOf(words[0] ?? '') !== 'git') continue
    const git = gitWorktree(words)
    const sub = words.slice(1).find(w => !bare(w).startsWith('-')) ?? ''
    const at = words.findIndex(w => low(w) === 'worktree')
    const verb = at < 0 ? undefined : words.slice(at + 1).find(w => !bare(w).startsWith('-'))
    if ((git?.unclear && verb !== undefined && expands(verb)) || (git === undefined && expands(sub) && words.some(w => low(w) === 'remove'))) {
      return { kind: 'unclear', why: excerpt(words) }
    }
  }
  if (!readings(joined).some(r => WORKTREE.test(r) && REMOVE.test(r))) return undefined
  const substitutes = /[`]|\$\(|<\(/.test(joined)
  const runsText = segs.some(s => {
    const w = strip(s.words)
    const first = w[0] ?? ''
    return EXECUTORS.has(nameOf(first)) || /^[$%&@.{-]/.test(first) || first.endsWith('{')
  }) || pipedInto(joined).some(n => !FILTERS.has(n))
  let remove: string | undefined
  let unclear: string | undefined
  for (const s of segs) {
    if (!namesWorktree(s.raw) && !namesRemove(s.raw)) continue
    const words = strip(s.words)
    const git = gitWorktree(words)
    if (git !== undefined) {
      if (git.unclear) unclear ??= excerpt(words)
      else if (git.verb === 'remove') remove ??= excerpt(words)
      continue
    }
    if (!runsText && !noText && isText(words, s.raw)) continue
    if ((namesWorktree(s.raw) && namesRemove(s.raw)) || substitutes || runsText || /[$%@]/.test(s.raw) || words.length === 0) {
      unclear ??= excerpt(words.length > 0 ? words : s.words)
    }
  }
  if (remove !== undefined) return { kind: 'remove', why: remove }
  if (unclear !== undefined) return { kind: 'unclear', why: unclear }
  return undefined
}
