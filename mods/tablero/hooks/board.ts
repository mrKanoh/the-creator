// Pure reading of PROGRESS.md / progress/<id>.md into the three blocks of the
// panel. No engine, no files: the module only receives text.

export type Source = { file: string; text: string }
export type Work = { file: string; heading: string; stages?: string; ciclo?: string; blockers?: string }
export type Board = {
  empty: boolean // no file has any section the panel knows
  sources: string[]
  done: string[]
  current: Work[]
  todo: string[]
  owner: string[]
  warnings: SizeWarning[] // size limits passed (CRE-TAB-TAM-1) and format problems (CRE-TAB-FMT-1); the panel only shows them
  noFiles: boolean // there is no PROGRESS.md and no progress/*.md at all (the empty panel then says where to open the chat)
}
// What the panel draws. Colors are theme keys; `text` is already clean.
export type Tone = 'dim' | 'warning' | 'success' | 'accent'
export type Row = {
  text: string
  mark?: string // «•», «✓», «○», «▶»
  markTone?: Tone
  lead?: string // dimmed, before the text (a compact date)
  tone?: Tone
  bold?: boolean
  indent?: boolean
  wrap?: boolean // a title: wraps instead of being cut to the width
  key?: string // a row that can unfold its description: the panel draws it as a Button with this address
}
export type Block = { title: string; tone?: Tone; rows: Row[] }

type Section = { title: string; lines: string[] }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
// Markdown out, text kept: bold, inline code and links.
export const clean = (s: string) =>
  s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim()
const plain = clean
const BULLET = /^(?:[-*]|\d+\.)\s+(.*)$/

// `## ` sections outside ``` fences, in order. Lines inside a fence are kept
// (so the section still ends where it should) but marked with a leading \0.
function sections(text: string): Section[] {
  const out: Section[] = []
  // CommonMark: a fence closes with the same character, at least as long.
  let fence: { ch: string; len: number } | undefined
  for (const raw of text.split(/\r?\n/)) {
    const m = /^[ \t]*(`{3,}|~{3,})(.*)$/.exec(raw)
    if (fence !== undefined) {
      out.at(-1)?.lines.push('\0' + raw)
      if (m !== null && m[1]![0] === fence.ch && m[1]!.length >= fence.len && m[2]!.trim() === '') fence = undefined
      continue
    }
    if (m !== null) {
      fence = { ch: m[1]![0]!, len: m[1]!.length }
      out.at(-1)?.lines.push('\0' + raw)
      continue
    }
    const h = /^##\s+(.+?)\s*#*\s*$/.exec(raw)
    if (h !== null) out.push({ title: h[1]!, lines: [] })
    else out.at(-1)?.lines.push(raw)
  }
  return out
}

const real = (lines: string[]) => lines.filter(l => !l.startsWith('\0'))

// Top-level list items (nested lines and continuations are ignored).
const bullets = (lines: string[]) =>
  real(lines).flatMap(l => {
    const m = BULLET.exec(l)
    return m === null ? [] : [m[1]!.trim()]
  })

// Empty only when the whole phrase is «ninguno», «ninguna», «nada» or «sin
// bloqueos», alone, in parentheses, with a final dot or a note in parentheses.
// «Nada-1 tarea» or «Nada de tests aún: falta CI» are real text.
const isNone = (s: string) =>
  /^\(?\s*(ningun[oa]s?|nada|sin\s+bloqueos?)\s*[).]?\s*(\(.*\))?\s*$/.test(norm(s).replace(/^[-*]\s+/, ''))

function work(file: string, s: Section): Work | undefined {
  let heading = s.title.replace(/^trabajo actual/i, '').replace(/^\s*[:—-]\s*/, '').trim()
  if (heading === '') {
    heading = plain(real(s.lines).find(l => l.trim() !== '' && !l.startsWith('###')) ?? '').replace(/^[-*]\s+/, '')
  }
  heading = clean(heading).replace(/^[-*]\s+/, '')
  if (heading === '' || isNone(heading)) return undefined
  const w: Work = { file, heading }
  // Only the facts before the first ### (the pasted order lives below it).
  const head: string[] = []
  for (const l of s.lines) {
    if (!l.startsWith('\0') && /^###\s/.test(l)) break
    head.push(l)
  }
  for (const b of bullets(head)) {
    // Clean first: «- **Etapas:** …» is a key too.
    const key = /^(etapas|ciclo|pendiente\s*\/\s*bloqueos?)\s*:\s*(.*)$/i.exec(clean(b))
    if (key === null) continue
    const name = norm(key[1]!), value = clean(key[2]!)
    if (value === '') continue
    if (name === 'etapas') w.stages ??= value
    else if (name === 'ciclo') w.ciclo ??= value
    else if (!isNone(value)) w.blockers ??= value
  }
  return w
}

export function buildBoard(files: Source[]): Board {
  const board: Board = { empty: true, sources: [], done: [], current: [], todo: [], owner: [], warnings: allWarnings(files), noFiles: files.length === 0 }
  for (const { file, text } of files) {
    let known = false
    for (const s of sections(text)) {
      const title = norm(s.title)
      if (title.startsWith('trabajo actual')) {
        known = true
        const w = work(file, s)
        if (w !== undefined) board.current.push(w)
      } else if (title.startsWith('terminados')) {
        known = true
        board.done.push(...bullets(s.lines))
      } else if (title.startsWith('pendiente del responsable')) {
        known = true
        board.owner.push(...bullets(s.lines))
      } else if (title.startsWith('pendientes')) {
        known = true
        board.todo.push(...bullets(s.lines))
      }
    }
    if (known) {
      board.empty = false
      board.sources.push(file)
    }
  }
  return board
}

// ---- Size limits (CRE-TAB-TAM-1). Only a warning: nothing here edits or blocks. ----

export const MAX_ROWS = 10 // rows of «Terminados»
export const MAX_ROW_CHARS = 300 // characters of one «Terminados» row (the text after «- »)
export const MAX_LINES = 200 // lines of one file; see DECISIONS.md

export type SizeWarning = {
  kind: 'rows' | 'long-row' | 'lines' | 'titles' | 'row-format'
  file: string
  value: number
  limit: number // 0 for the format kinds (CRE-TAB-FMT-1): there is no number to pass
  sample?: string // long-row: the start of the row
  message: string // which limit was passed, and where
  advice: string // what to do
}

// Which limits of PROGRESS.md (or progress/<id>.md) are passed. Pure: text in, warnings out.
export function sizeWarnings(files: Source[]): SizeWarning[] {
  const out: SizeWarning[] = []
  for (const { file, text } of files) {
    const rows = sections(text)
      .filter(s => norm(s.title).startsWith('terminados'))
      .flatMap(s => bullets(s.lines))
    if (rows.length > MAX_ROWS) {
      out.push({
        kind: 'rows',
        file,
        value: rows.length,
        limit: MAX_ROWS,
        message: `${file}: «Terminados» tiene ${rows.length} filas (tope ${MAX_ROWS}).`,
        advice: `Pasa las más antiguas a progress/archivo.md, como primera viñeta tras su título #, hasta dejar ${MAX_ROWS}.`,
      })
    }
    for (const r of rows) {
      if (r.length <= MAX_ROW_CHARS) continue
      const sample = clip(clean(r), 60)
      out.push({
        kind: 'long-row',
        file,
        value: r.length,
        limit: MAX_ROW_CHARS,
        sample,
        message: `${file}: una fila de «Terminados» tiene ${r.length} caracteres (tope ${MAX_ROW_CHARS}): «${sample}».`,
        advice: 'Acórtala a una línea sin estado del PR; el detalle va en el commit y el PR.',
      })
    }
    const lines = text.replace(/\r?\n$/, '').split(/\r?\n/).length
    // progress/archivo.md is the history and grows on purpose: no line cap.
    if (text !== '' && lines > MAX_LINES && !/(^|[\\/])progress[\\/]archivo\.md$/i.test(file)) {
      out.push({
        kind: 'lines',
        file,
        value: lines,
        limit: MAX_LINES,
        message: `${file}: tiene ${lines} líneas (tope ${MAX_LINES}).`,
        advice: 'Recorta lo que ya no sirve para retomar el trabajo (órdenes de trabajos cerrados, historial) y archiva lo que valga la pena.',
      })
    }
  }
  return out
}

// ---- Format (CRE-TAB-FMT-1): the four titles and the shape of a «Terminados» row. Also only a warning. ----

const FORMAT_DOC = 'C:\\repos\\creador\\skills\\trabajador\\formato-progress.md'
const REQUIRED: { prefix: string; label: string }[] = [
  { prefix: 'trabajo actual', label: 'Trabajo actual' },
  { prefix: 'pendiente del responsable', label: 'Pendiente del responsable' },
  { prefix: 'pendientes', label: 'Pendientes' },
  { prefix: 'terminados', label: 'Terminados' },
]
// The id is upper case with digits and hyphens: «CRE-TAB-1», «PW-PROG-1». «Modo paralelo (…)» is not one.
// It has at least one letter, so a date alone («2026-11-23 (nota)») is not an id.
const ID_THEN_PAREN = /^(?:\d{4}-\d{2}-\d{2}\s+)?((?=[A-Z0-9-]*[A-Z])[A-Z0-9]+(?:-[A-Z0-9]+)+) \(/
// A state of this PR, not a description of what a role does: «PR #12 abierto» (with its number),
// «PR abierto» / «PR en borrador» / «fusionado» as a whole segment (start, or after «·» or «;», up to «·», «;» or the end),
// and «pendiente: fusión». «deja el PR listo para revisar» or «la rama del PR fusionado» are real text.
const PR_STATE =
  /\bPR\s*#\d+[\s:,]*(?:abierto|en borrador|listo|fusionad[oa]|cerrado)\b|(?:^|[·;]\s*)(?:PR\s+(?:abierto|en borrador)|fusionad[oa])\s*(?=[·;]|$)|\bpendiente:\s*(?:la\s+)?(?:fusi[oó]n|merge)\b/i

// Is this the root PROGRESS.md (the one that must carry the four titles)? progress/<id>.md does not:
// skills/trabajador/modo-paralelo.md:7 says «mismo formato» but not that it has the four titles.
const isRootProgress = (file: string) => /^(?:.*[\\/])?PROGRESS\.md$/i.test(file) && !/[\\/]progress[\\/]/i.test(file)
const isArchive = (file: string) => /(^|[\\/])progress[\\/]archivo\.md$/i.test(file)

// Missing `##` titles of PROGRESS.md and «Terminados» rows that break the row format. Pure.
export function formatWarnings(files: Source[]): SizeWarning[] {
  const out: SizeWarning[] = []
  for (const { file, text } of files) {
    const secs = sections(text)
    if (isRootProgress(file)) {
      const missing = REQUIRED.filter(r => !secs.some(s => norm(s.title).startsWith(r.prefix)))
      if (missing.length > 0) {
        out.push({
          kind: 'titles',
          file,
          value: missing.length,
          limit: 0,
          message: `${file}: faltan títulos obligatorios: ${missing.map(m => `«## ${m.label}»`).join(', ')}.`,
          advice: `Agrégalos con ese texto exacto (puede seguir «: …»); sin ellos el panel no muestra esos bloques. Formato: ${FORMAT_DOC}.`,
        })
      }
    }
    if (isArchive(file)) continue // the history keeps old rows as they were
    const rows = secs.filter(s => norm(s.title).startsWith('terminados')).flatMap(s => bullets(s.lines))
    for (const r of rows) {
      const body = clean(r)
      const sample = clip(body, 60)
      const id = ID_THEN_PAREN.exec(body)
      if (id !== null) {
        out.push({
          kind: 'row-format',
          file,
          value: 0,
          limit: 0,
          sample,
          message: `${file}: la fila de «Terminados» «${sample}» tiene « (» justo tras el id ${id[1]}: HECHO mostraría solo el id.`,
          advice: `Escribe el resultado tras el id, sin paréntesis: «<fecha> ${id[1]} <resultado> · \`tarea/<nombre>\` · …».`,
        })
      }
      const state = PR_STATE.exec(body)
      if (state !== null) {
        out.push({
          kind: 'row-format',
          file,
          value: 0,
          limit: 0,
          sample,
          message: `${file}: la fila de «Terminados» «${sample}» lleva estado de PR o de fusión («${state[0]}»).`,
          advice: 'Quítalo: la fila no lleva estado del PR ni de la fusión; el detalle va en el commit y el PR.',
        })
      }
    }
  }
  return out
}

// Every warning the panel and the model get: sizes first, then format.
export const allWarnings = (files: Source[]): SizeWarning[] => [...sizeWarnings(files), ...formatWarnings(files)]

const isFormat = (w: SizeWarning) => w.kind === 'titles' || w.kind === 'row-format'
export function warningTitle(warnings: SizeWarning[]): string {
  const f = warnings.filter(isFormat).length
  return f === 0 ? 'AVISO: PROGRESS.md EXCEDE SUS TOPES' : f === warnings.length ? 'AVISO: PROGRESS.md NO SIGUE SU FORMATO' : 'AVISO: PROGRESS.md EXCEDE TOPES Y NO SIGUE SU FORMATO'
}

// Text for the model (a notice, never an order to stop). Empty when nothing passed.
export function warningContext(warnings: SizeWarning[]): string {
  if (warnings.length === 0) return ''
  const f = warnings.filter(isFormat).length
  return [
    f === 0
      ? 'Aviso de tablero: PROGRESS.md excede sus topes de tamaño.'
      : f === warnings.length
        ? 'Aviso de tablero: PROGRESS.md no sigue su formato.'
        : 'Aviso de tablero: PROGRESS.md excede sus topes de tamaño y no sigue su formato.',
    ...warnings.map(w => `- ${w.message} ${w.advice}`),
    `Es solo un aviso: no bloquea nada. ${f === 0 ? 'Recórtalo' : 'Corrígelo'} antes de cerrar la tarea.`,
  ].join('\n')
}

// Is this tool call worth checking the sizes after? An edit of PROGRESS.md or progress/*.md,
// or a `git commit` (where the worker closes a stage).
export function isProgressTouch(tool: string, args: { file_path?: unknown; command?: unknown }): boolean {
  if ((tool === 'Edit' || tool === 'Write') && typeof args.file_path === 'string') {
    return /(^|\/)(PROGRESS\.md|progress\/[^/]+\.md)$/i.test(args.file_path.replace(/\\/g, '/'))
  }
  if ((tool === 'Bash' || tool === 'PowerShell') && typeof args.command === 'string') {
    return /(^|&&|;)\s*git(\s+-C\s+\S+)?\s+commit\b/.test(args.command)
  }
  return false
}

export const clip = (s: string, n: number) => (s.length > n ? s.slice(0, Math.max(1, n - 1)).trimEnd() + '…' : s)

const BACKUP = 90 // a title with no delimiter is cut here

// Done: «27-10» + the name up to the first « (», «: » or « · ».
export function doneTitle(raw: string): { lead?: string; text: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(.*)$/.exec(raw)
  const body = clean(m === null ? raw : m[4]!)
  const cut = [' (', ': ', ' · '].map(d => body.indexOf(d)).filter(i => i > 0)
  const text = clip(cut.length > 0 ? body.slice(0, Math.min(...cut)) : body, BACKUP)
  return m === null ? { text } : { lead: `${m[3]}-${m[2]}`, text }
}

// First sentence: parentheticals out, up to the first «: » or «. » (or the end).
// A «Tras X: hacer Y» pending is about Y: the time condition before «: » is skipped.
const WHEN = /^(tras|despues de|antes de|cuando|al)\b/

// A dot that does not end a sentence is swapped for U+2024 while looking for the cut.
const ABBREVIATION = /\b(?:p\. ?ej|etc|ej|vs)\./gi

export function sentenceTitle(raw: string): string {
  const full = clean(raw)
  let s = full
  for (let prev = ''; prev !== s; ) {
    prev = s
    s = s.replace(/\s*\([^()]*\)/g, '')
  }
  s = s.replace(ABBREVIATION, m => m.replace(/\./g, '․'))
  const colon = s.indexOf(': ')
  if (colon > 0 && s.slice(colon + 2).trim() !== '' && WHEN.test(norm(s.slice(0, colon)))) s = s.slice(colon + 2)
  const cut = [': ', '. '].map(d => s.indexOf(d)).filter(i => i > 0)
  const title = (cut.length > 0 ? s.slice(0, Math.min(...cut)) : s).replace(/[.:]$/, '').replace(/․/g, '.').trim()
  return clip(title === '' ? full : title, BACKUP)
}

// Pending of the method: the bold text if there is one, else the first sentence.
export function bulletTitle(raw: string): string {
  const bold = /\*\*(.+?)\*\*/.exec(raw)
  return bold !== null ? clip(clean(bold[1]!), BACKUP) : sentenceTitle(raw)
}

// What the title leaves of the bullet, clean: the text that follows it, else (a title
// that was cut at a parenthesis or rewritten) the whole bullet. Empty when there is no more.
export function detail(raw: string, title: string, dated = false): string {
  let full = clean(raw)
  if (dated) full = full.replace(/^\d{4}-\d{2}-\d{2}\s+/, '')
  const core = title.endsWith('…') ? title.slice(0, -1) : title
  const at = full.indexOf(core)
  let end = at + core.length
  // A title cut by the cap may end inside a word: the rest starts at that word.
  if (at >= 0 && core !== title && /\S/.test(full[end] ?? ' ')) end = full.lastIndexOf(' ', end) + 1
  const tidy = (s: string) => s.replace(/^[\s.:·]+/, '').trim()
  if (at >= 0) {
    const rest = tidy(full.slice(end))
    if (rest !== '') return rest
    return at > 0 ? full.slice(0, at).replace(/[\s:]+$/, '') : ''
  }
  // A title with its parentheses taken out: walk both texts, keeping what the title dropped.
  const dropped: string[] = []
  let i = 0, j = 0
  while (j < core.length) {
    if (full[i] === core[j]) {
      i++, j++
      continue
    }
    const open = full[i] === ' ' && full[i + 1] === '(' ? i + 1 : full[i] === '(' ? i : -1
    if (open < 0) return full
    let depth = 0, k = open
    for (; k < full.length; k++) {
      if (full[k] === '(') depth++
      else if (full[k] === ')' && --depth === 0) break
    }
    if (depth !== 0) return full
    dropped.push(full.slice(open, k + 1))
    i = k + 1
    if (full[i] === ' ' && core[j] !== ' ') i++
  }
  return [...dropped, tidy(full.slice(i))].filter(s => s !== '').join(' ')
}

// Greedy word wrap into at most `lines` lines of `width`; what does not fit ends in «…».
export function wrapLines(text: string, width: number, lines = 2): string[] {
  const out: string[] = []
  let cur = ''
  const words = text.split(' ')
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!
    const next = cur === '' ? w : `${cur} ${w}`
    if (next.length <= width) {
      cur = next
      continue
    }
    if (out.length === lines - 1) return [...out, clip([cur === '' ? w : cur, ...words.slice(cur === '' ? i + 1 : i)].join(' '), width)]
    if (cur !== '') out.push(cur)
    cur = clip(w, width) // a word wider than the line ends in «…» too
  }
  return cur === '' ? out : [...out, cur]
}

function stageRows(stages: string): Row[] {
  let current = false
  return stages.split(' · ').map(part => {
    const m = /^\[( |x|X)\]\s*(.*)$/.exec(part.trim())
    if (m === null) return { mark: '•', text: clean(part), indent: true }
    if (m[1] !== ' ') return { mark: '✓', markTone: 'success', text: clean(m[2]!), indent: true, tone: 'dim' }
    const isCurrent = !current
    current = true
    return isCurrent
      ? { mark: '▶', markTone: 'accent', text: clean(m[2]!), indent: true, bold: true }
      : { mark: '○', markTone: 'dim', text: clean(m[2]!), indent: true }
  })
}

export const EMPTY_TEXT =
  'No hay PROGRESS.md (ni progress/*.md) con secciones conocidas: Trabajo actual, Terminados, Pendientes. Nada que mostrar.'
// Only when there is no file at all (CRE-TAB-FMT-1 R4): with a PROGRESS.md of its own the problem is not where the chat is open.
export const EMPTY_HINT = 'Abre el chat en la carpeta raíz del repo del proyecto.'

const nothing = (text: string): Row[] => [{ text, tone: 'dim', indent: true }]

// Fits every row but the wrapping titles to `width` columns (mark and lead included).
function fit(rows: Row[], width: number): Row[] {
  return rows.map(r => {
    if (r.wrap === true) return r
    const used = (r.indent === true ? 2 : 0) + (r.mark !== undefined ? r.mark.length + 1 : 0) + (r.lead !== undefined ? r.lead.length + 1 : 0)
    return { ...r, text: clip(r.text, Math.max(12, width - used)) }
  })
}

// The blocks in order: EN CURSO, TE TOCA A TI, PENDIENTES DEL MÉTODO, HECHO.
// The panel only draws them. `width` is the panel's `bodyColumns`.
// `open` holds the keys of the rows the person unfolded: their description (at most 2
// lines, dim) goes right below the row. A bullet with nothing after its title has no key.
export function describe(board: Board, width = 60, open: ReadonlySet<string> = new Set()): Block[] {
  // Size warning first, in every case (also for a file with a format of its own).
  const warning: Block[] =
    board.warnings.length === 0
      ? []
      : [
          {
            title: warningTitle(board.warnings),
            tone: 'warning',
            rows: board.warnings.flatMap((w): Row[] => [
              { mark: '⚠', markTone: 'warning', text: w.message, tone: 'warning', wrap: true },
              { text: `Qué hacer: ${w.advice}`, tone: 'dim', indent: true, wrap: true },
            ]),
          },
        ]
  if (board.empty) return [...warning, { title: 'Tablero', rows: [{ text: board.noFiles ? `${EMPTY_TEXT} ${EMPTY_HINT}` : EMPTY_TEXT, tone: 'dim', wrap: true }] }]
  const current: Row[] = []
  for (const w of board.current) {
    const where = board.sources.length > 1 ? `${w.file}: ` : ''
    current.push({ text: `${where}${w.heading}`, bold: true, wrap: true })
    if (w.stages !== undefined) current.push(...stageRows(w.stages))
    if (w.ciclo !== undefined) current.push({ text: `Ciclo: ${w.ciclo}`, tone: 'dim', indent: true })
    if (w.blockers !== undefined) current.push({ mark: '⚠', markTone: 'warning', text: `Bloqueos: ${w.blockers}`, tone: 'warning', indent: true })
  }
  // The row, and below it its description when it is open (already wrapped to 2
  // lines, so `fit` leaves it alone).
  // The key is the raw bullet (the date apart from the title comes with it), plus an
  // occurrence suffix when the same bullet repeats: unique, and the same on every redraw.
  const seen = new Map<string, number>()
  const withDetail = (block: string, raw: string, row: Row, more: string): Row[] => {
    if (more === '') return [row]
    const base = `${block}:${raw}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    const key = n === 0 ? base : `${base}#${n + 1}`
    const rows: Row[] = [{ ...row, key }]
    if (open.has(key)) for (const l of wrapLines(more, Math.max(8, width - 4))) rows.push({ text: `  ${l}`, tone: 'dim', indent: true, wrap: true })
    return rows
  }
  const bullet = (block: string, raw: string, title: string): Row[] => withDetail(block, raw, { mark: '•', text: title }, detail(raw, title))
  const list = (items: string[], max: number, empty: string, show: (t: string) => Row[]): Row[] => {
    if (items.length === 0) return nothing(empty)
    const rows = items.slice(0, max).flatMap(show)
    if (items.length > max) rows.push({ text: `+${items.length - max} más`, tone: 'dim', indent: true })
    return fit(rows, width)
  }
  return [
    ...warning,
    { title: 'EN CURSO', tone: 'accent', rows: fit(current.length > 0 ? current : nothing('Nada en curso'), width) },
    {
      title: `TE TOCA A TI (${board.owner.length})`,
      tone: 'warning',
      rows: list(board.owner, 6, 'Nada pendiente', t => bullet('owner', t, sentenceTitle(t))),
    },
    {
      title: `PENDIENTES DEL MÉTODO (${board.todo.length})`,
      rows: list(board.todo, 8, 'Nada pendiente', t => bullet('todo', t, bulletTitle(t))),
    },
    {
      title: `HECHO (${board.done.length})`,
      tone: 'success',
      rows: list(board.done, 5, 'Nada hecho', t => {
        const d = doneTitle(t)
        return withDetail('done', t, { mark: '•', lead: d.lead, text: d.text }, detail(t, d.text, true))
      }),
    },
  ]
}
