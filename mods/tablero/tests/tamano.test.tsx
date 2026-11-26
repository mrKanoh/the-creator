import { expect, test } from 'claude-code/testing'
import { MAX_LINES, MAX_ROW_CHARS, MAX_ROWS, sizeWarnings } from '../hooks/board.ts'

// CRE-TAB-TAM-1: PROGRESS.md size limits. Only warns; these test the detection.

// A bullet whose text (after «- ») has exactly `len` characters.
const row = (n: number, len = 40) => {
  const head = `2026-11-01 X-${n} `
  return `- ${head}${'a'.repeat(Math.max(0, len - head.length))}`
}
// With the four titles formato-progress.md requires, so a size test never trips the format warning (CRE-TAB-FMT-1).
const doc = (rows: string[], extra: string[] = []) =>
  ['# P', '## Trabajo actual: ninguno', '## Pendiente del responsable', '## Pendientes', '## Terminados', ...rows, ...extra, ''].join('\n')
const src = (text: string, file = 'PROGRESS.md') => [{ file, text }]

test('limits are 10 rows, 300 chars per row, 200 lines', () => {
  expect([MAX_ROWS, MAX_ROW_CHARS, MAX_LINES]).toEqual([10, 300, 200])
})

test('more than 10 rows in Terminados warns, naming the file and the count', () => {
  const w = sizeWarnings(src(doc(Array.from({ length: 11 }, (_, i) => row(i)))))
  expect(w).toHaveLength(1)
  expect(w[0]).toMatchObject({ kind: 'rows', file: 'PROGRESS.md', value: 11, limit: 10 })
})

test('exactly 10 rows: no warning', () => {
  expect(sizeWarnings(src(doc(Array.from({ length: 10 }, (_, i) => row(i)))))).toEqual([])
})

test('a row over 300 characters warns, and says which row', () => {
  const w = sizeWarnings(src(doc([row(1), row(2, 301)])))
  expect(w).toHaveLength(1)
  expect(w[0]).toMatchObject({ kind: 'long-row', file: 'PROGRESS.md', value: 301, limit: 300 })
  expect(w[0]!.sample).toContain('X-2')
})

test('a row of exactly 300 characters: no warning', () => {
  expect(sizeWarnings(src(doc([row(1, 300)])))).toEqual([])
})

test('every long row is reported once', () => {
  const w = sizeWarnings(src(doc([row(1, 400), row(2, 500), row(3)])))
  expect(w.filter(x => x.kind === 'long-row').map(x => x.value)).toEqual([400, 500])
})

test('a file over 200 lines warns; exactly 200 does not', () => {
  const pad = (n: number) => Array.from({ length: n }, () => 'texto')
  // doc() = 6 fixed lines (incl. the final empty one is not a line) + rows + extra
  const base = doc([row(1)], pad(0)).split('\n').length - 1 // lines without the trailing newline's empty piece
  const over = sizeWarnings(src(doc([row(1)], pad(MAX_LINES - base + 1))))
  expect(over).toHaveLength(1)
  expect(over[0]).toMatchObject({ kind: 'lines', value: MAX_LINES + 1, limit: 200 })
  expect(sizeWarnings(src(doc([row(1)], pad(MAX_LINES - base))))).toEqual([])
})

test('no «Terminados» section: no row warnings (the line cap still applies)', () => {
  expect(sizeWarnings(src('# P\n\n## Trabajo actual: ninguno\n'))).toEqual([])
  const long = '# P\n' + 'x\n'.repeat(MAX_LINES + 5)
  expect(sizeWarnings(src(long)).map(w => w.kind)).toEqual(['lines'])
})

test('no files at all: no warnings and no error', () => {
  expect(sizeWarnings([])).toEqual([])
})

test('a pasted order inside a ``` fence does not count as Terminados rows', () => {
  const fenced = ['## Trabajo actual: X', '### Orden completa', '```', '## Terminados', ...Array.from({ length: 15 }, (_, i) => row(i, 400)), '```', ''].join('\n')
  expect(sizeWarnings(src(fenced)).filter(w => w.kind !== 'lines')).toEqual([])
})

test('progress/*.md files are checked too, each under its own name', () => {
  const rows = Array.from({ length: 12 }, (_, i) => row(i))
  const w = sizeWarnings([...src(doc([row(1)])), ...src(doc(rows), 'progress/cre-x-1.md')])
  expect(w).toHaveLength(1)
  expect(w[0]).toMatchObject({ kind: 'rows', file: 'progress/cre-x-1.md' })
})

test('each warning says what to do', () => {
  const all = sizeWarnings(src(doc([row(1, 500), ...Array.from({ length: 11 }, (_, i) => row(i + 2))], Array.from({ length: 210 }, () => 'x'))))
  expect(all.map(w => w.kind).sort()).toEqual(['lines', 'long-row', 'rows'])
  for (const w of all) expect(w.message).toMatch(/PROGRESS|progress/)
  for (const w of all) expect(w.advice.length).toBeGreaterThan(10)
})

// ---- R2: the warning block in the panel (stage 2) ----

import { buildBoard, describe } from '../hooks/board.ts'
import { NONE, OWN_FORMAT } from './fixtures.ts'

const BIG = doc([row(1, 400), ...Array.from({ length: 11 }, (_, i) => row(i + 2))])
const blocksOf = (files: { file: string; text: string }[], width = 80) => describe(buildBoard(files), width)

test('the panel puts a warning block first when a limit is passed', () => {
  const list = blocksOf(src(BIG))
  expect(list[0]!.title).toMatch(/^AVISO/)
  expect(list[0]!.tone).toBe('warning')
  expect(list.slice(1).map(b => b.title.split(' (')[0])).toEqual(['EN CURSO', 'TE TOCA A TI', 'PENDIENTES DEL MÉTODO', 'HECHO'])
  const text = list[0]!.rows.map(r => r.text).join('\n')
  expect(text).toContain('PROGRESS.md')
  expect(text).toContain('12 filas')
  expect(text).toContain('400 caracteres')
  expect(text).toContain('archivo.md') // what to do
  for (const r of list[0]!.rows) expect(r.wrap).toBe(true) // never cut
})

test('no warning block when every limit holds', () => {
  expect(blocksOf(src(NONE)).map(b => b.title)).toEqual(['EN CURSO', 'TE TOCA A TI (0)', 'PENDIENTES DEL MÉTODO (0)', 'HECHO (1)'])
})

test('no warning block without PROGRESS.md, and a foreign format has no size warning', () => {
  expect(blocksOf([])[0]!.title).toBe('Tablero')
  expect(sizeWarnings(src(OWN_FORMAT))).toEqual([])
  // CRE-TAB-FMT-1: it does get the missing-titles warning (see formato.test.tsx).
  expect(blocksOf(src(OWN_FORMAT)).map(b => b.title)).toEqual(['AVISO: PROGRESS.md NO SIGUE SU FORMATO', 'Tablero'])
})

test('a huge file with a format of its own still warns about its lines', () => {
  const list = blocksOf(src('# hal\n## Checkpoint\n' + '- x\n'.repeat(MAX_LINES + 10)))
  expect(list.map(b => b.title.split(' (')[0])).toEqual(['AVISO: PROGRESS.md EXCEDE TOPES Y NO SIGUE SU FORMATO', 'Tablero'])
  expect(list[0]!.rows.map(r => r.text).join('\n')).toContain('líneas (tope 200)')
})

test('the warning block names each file in parallel mode', () => {
  const list = blocksOf([...src(doc([row(1)])), ...src(BIG, 'progress/x-1.md')])
  const text = list[0]!.rows.map(r => r.text).join('\n')
  expect(text).toContain('progress/x-1.md')
  expect(text).not.toMatch(/^PROGRESS\.md:/m)
})

test('the mounted pane shows the warning, on every surface', async ($, on) => {
  on('session.root', () => ({ value: '/repo' }))
  on('fs.read', (_, e) => {
    if (!e.path.replace(/\\/g, '/').endsWith('/repo/PROGRESS.md')) throw new Error('ENOENT')
    return { value: BIG }
  })
  on('fs.list', () => {
    throw new Error('ENOENT')
  })
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({
      plugin: 'tablero',
      component: 'Pane',
      requestId: 'tablero',
      surface,
      props: { title: 'Tablero', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
    })
    expect(await ui.find({ type: 'Text', text: /EXCEDE SUS TOPES/ }), `${surface}: title`).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /12 filas/ }), `${surface}: message`).toBeDefined()
    await ui.unmount()
  }
})

// ---- Round 1 (CRE-TAB-TAM-1): archive, CRLF, the model's warning ----
import { isProgressTouch, warningContext } from '../hooks/board.ts'

test('progress/archivo.md is the history: no line cap, whatever its length', () => {
  const long = '# Archivo\n' + '- fila\n'.repeat(250)
  expect(sizeWarnings(src(long, 'progress/archivo.md'))).toEqual([])
  expect(sizeWarnings(src(long, 'progress\\archivo.md'))).toEqual([])
  expect(sizeWarnings(src(long, 'PROGRESS.md')).map(w => w.kind)).toEqual(['lines']) // the same text elsewhere warns
  expect(sizeWarnings(src(long, 'progress/otro.md')).map(w => w.kind)).toEqual(['lines'])
})

test('CRLF files count the same: rows, row length and lines', () => {
  const rows = Array.from({ length: 11 }, (_, i) => row(i, i === 0 ? 301 : 40))
  const crlf = doc(rows).replace(/\n/g, '\r\n')
  const w = sizeWarnings(src(crlf))
  expect(w.map(x => `${x.kind}:${x.value}`).sort()).toEqual(['long-row:301', 'rows:11'])
  const exact = doc([row(1, 300)]).replace(/\n/g, '\r\n')
  expect(sizeWarnings(src(exact))).toEqual([]) // no «\r» counted in the row
  const lines = ['# P', ...Array.from({ length: MAX_LINES - 1 }, () => 'x')].join('\r\n') + '\r\n'
  expect(sizeWarnings(src(lines))).toEqual([]) // exactly 200 lines
})

test('only the first line of a split row counts toward its 300', () => {
  const split = doc([row(1, 100), '  ' + 'b'.repeat(500)])
  expect(sizeWarnings(src(split)).filter(w => w.kind === 'long-row')).toEqual([])
})

test('isProgressTouch: edits of PROGRESS.md or progress/*.md and git commit, nothing else', () => {
  expect(isProgressTouch('Edit', { file_path: 'D:\\p\\PROGRESS.md' })).toBe(true)
  expect(isProgressTouch('Write', { file_path: '/p/progress/cre-x-1.md' })).toBe(true)
  expect(isProgressTouch('Edit', { file_path: '/p/README.md' })).toBe(false)
  expect(isProgressTouch('Edit', { file_path: '/p/docs/PROGRESS.md.bak' })).toBe(false)
  expect(isProgressTouch('Read', { file_path: '/p/PROGRESS.md' })).toBe(false)
  expect(isProgressTouch('Bash', { command: 'git commit -m "x"' })).toBe(true)
  expect(isProgressTouch('Bash', { command: 'git -C /p commit -q -m x' })).toBe(true)
  expect(isProgressTouch('PowerShell', { command: 'git commit -m x' })).toBe(true)
  expect(isProgressTouch('Bash', { command: 'git status --short' })).toBe(false)
  expect(isProgressTouch('Bash', { command: 'echo git commit' })).toBe(false)
})

test('warningContext: names every warning and says it is only a notice', () => {
  const all = sizeWarnings(src(doc([row(1, 400), ...Array.from({ length: 11 }, (_, i) => row(i + 2))])))
  const text = warningContext(all)
  for (const w of all) expect(text).toContain(w.message)
  expect(text).toMatch(/aviso/i)
  expect(text).toMatch(/no (bloquea|es obligatorio)/i)
  expect(warningContext([])).toBe('')
})


test('tool.call: after an Edit of PROGRESS.md over a limit, the model gets the notice as context, once per turn', async ($, on) => {
  on('session.root', () => ({ value: '/repo' }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('fs.read', (_, e) => {
    if (!e.path.replace(/\\/g, '/').endsWith('/repo/PROGRESS.md')) throw new Error('ENOENT')
    return { value: BIG }
  })
  on('fs.list', () => {
    throw new Error('ENOENT')
  })
  on('tool.call', () => ({ result: { filePath: '/repo/PROGRESS.md' }, text: 'ok' }) as never)
  await $.turn.start({ text: 'cierra la tarea', turnId: 't1' })
  const first = await $.tool.call({ tool: 'Edit', file_path: '/repo/PROGRESS.md', old_string: 'a', new_string: 'b' } as never)
  expect(first.context?.join('\n') ?? '').toContain('12 filas')
  const again = await $.tool.call({ tool: 'Edit', file_path: '/repo/PROGRESS.md', old_string: 'a', new_string: 'b' } as never)
  expect(again.context).toBeUndefined() // once per turn
  await $.turn.start({ text: 'sigue', turnId: 't2' })
  const next = await $.tool.call({ tool: 'Bash', command: 'git commit -m x' } as never)
  expect(next.context?.join('\n') ?? '').toContain('12 filas') // a new turn, a new notice
  const other = await $.tool.call({ tool: 'Edit', file_path: '/repo/src/a.ts', old_string: 'a', new_string: 'b' } as never)
  expect(other.context).toBeUndefined() // not PROGRESS.md
})

test('tool.call: no notice when PROGRESS.md is within the limits, is missing, or the tool failed', async ($, on) => {
  on('session.root', () => ({ value: '/repo' }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  let text: string | undefined = NONE
  on('fs.read', () => {
    if (text === undefined) throw new Error('ENOENT')
    return { value: text }
  })
  on('fs.list', () => {
    throw new Error('ENOENT')
  })
  let fails = false
  on('tool.call', () => ({ result: {}, text: fails ? 'fail' : 'ok', ...(fails ? { isError: true } : {}) }) as never)
  await $.turn.start({ text: 'x', turnId: 'a' })
  expect((await $.tool.call({ tool: 'Edit', file_path: '/repo/PROGRESS.md', old_string: 'a', new_string: 'b' } as never)).context).toBeUndefined()
  text = undefined
  await $.turn.start({ text: 'x', turnId: 'b' })
  expect((await $.tool.call({ tool: 'Edit', file_path: '/repo/PROGRESS.md', old_string: 'a', new_string: 'b' } as never)).context).toBeUndefined()
  text = BIG
  fails = true
  await $.turn.start({ text: 'x', turnId: 'c' })
  expect((await $.tool.call({ tool: 'Edit', file_path: '/repo/PROGRESS.md', old_string: 'a', new_string: 'b' } as never)).context).toBeUndefined()
})
