import { expect, test } from 'claude-code/testing'
import { allWarnings, buildBoard, describe, formatWarnings, sizeWarnings, warningContext } from '../hooks/board.ts'
import { CREADOR_REAL } from './creador-real.ts'
import { CREADOR, NONE, OWN_FORMAT, PARALLEL_A } from './fixtures.ts'

// CRE-TAB-FMT-1: PROGRESS.md format. R1 the four titles, R2 the shape of a «Terminados» row. Only warnings.

const src = (text: string, file = 'PROGRESS.md') => [{ file, text }]
const TITLES = ['## Trabajo actual: ninguno', '## Pendiente del responsable', '## Pendientes', '## Terminados']
const withRows = (...rows: string[]) => [...TITLES, ...rows, ''].join('\n')

// ---- R1 ----

test('R1: the four titles present, in the loose forms buildBoard accepts: no warning', () => {
  expect(formatWarnings(src(NONE))).toEqual([])
  expect(formatWarnings(src(CREADOR))).toEqual([]) // «## Pendientes del método», «## Trabajo actual: CRE-TAB-1 …»
  expect(formatWarnings(src(['## trabajo actual', '## PENDIENTE DEL RESPONSABLE', '## Pendientes (en orden)', '## Terminados'].join('\n')))).toEqual([])
})

test('R1: each missing title is named, once, in one warning', () => {
  const [w, ...rest] = formatWarnings(src('# P\n## Trabajo actual: ninguno\n## Terminados\n- a\n'))
  expect(rest).toEqual([])
  expect(w).toMatchObject({ kind: 'titles', file: 'PROGRESS.md', value: 2 })
  expect(w!.message).toContain('«## Pendiente del responsable»')
  expect(w!.message).toContain('«## Pendientes»')
  expect(w!.message).not.toContain('«## Terminados»')
  expect(w!.advice).toContain('formato-progress.md')
})

test('R1: a title inside a ``` fence does not count; neither does a ### or a single #', () => {
  const text = ['```', ...TITLES, '```', '### Trabajo actual', '# Terminados'].join('\n')
  const [w] = formatWarnings(src(text))
  expect(w!.value).toBe(4)
})

test('R1: a foreign format and an empty file warn; no file does not', () => {
  expect(formatWarnings(src(OWN_FORMAT)).map(w => w.kind)).toEqual(['titles'])
  expect(formatWarnings(src('')).map(w => w.kind)).toEqual(['titles'])
  expect(formatWarnings([])).toEqual([])
})

test('R1: progress/<id>.md and progress/archivo.md are out (modo-paralelo.md:7 says «mismo formato», not «los cuatro títulos»)', () => {
  expect(formatWarnings(src(PARALLEL_A, 'progress/A-1.md'))).toEqual([])
  expect(formatWarnings(src('# Archivo\n- fila\n', 'progress/archivo.md'))).toEqual([])
  expect(formatWarnings(src('# Archivo\n- fila\n', 'progress\\archivo.md'))).toEqual([])
})

// ---- R2 ----

const rowWarnings = (...rows: string[]) => formatWarnings(src(withRows(...rows)))

test('R2: « (» right after the id warns and quotes the row', () => {
  const [w, ...rest] = rowWarnings('- 2026-11-20 CRE-X-1 (parcial) Resultado · `tarea/cre-x-1`')
  expect(rest).toEqual([])
  expect(w).toMatchObject({ kind: 'row-format', file: 'PROGRESS.md' })
  expect(w!.sample).toContain('CRE-X-1')
  expect(w!.message).toContain('CRE-X-1')
  expect(w!.message).toMatch(/HECHO/)
  expect(w!.advice).toContain('CRE-X-1 <resultado>')
  // markdown around the id does not hide it; a row with no date works too
  expect(rowWarnings('- **PW-PROG-1** (algo)')).toHaveLength(1)
  expect(rowWarnings('- `PW-PROG-1` (algo)')).toHaveLength(1)
})

test('R2: no « (» right after the id → no warning (parenthesis later, a date alone, «: » not detected)', () => {
  expect(rowWarnings('- 2026-11-20 CRE-X-1 Resultado (con detalle) · `tarea/x`')).toEqual([])
  // Known limit, not detected: «: » or « · » right after the id also cuts HECHO to the id, but only « (» is checked.
  expect(rowWarnings('- 2026-11-20 CRE-X-1: resultado (detalle)')).toEqual([])
  // The date alone is not an id: an id has at least one letter.
  expect(rowWarnings('- 2026-11-23 (nota) algo')).toEqual([])
  expect(rowWarnings('- 2026-11-23 2026-11-23 (nota) algo')).toEqual([])
  expect(rowWarnings('- 2026-10-26 Modo paralelo (worktrees, `progress/<id>.md`) · `1006`')).toEqual([]) // «Modo» is no id
  expect(rowWarnings('- 2026-11-20 CRE-X-1 — resultado')).toEqual([]) // the «—» of the template is not required
})

test('R2: a PR or merge state in the row warns', () => {
  for (const state of ['PR #12 abierto', 'PR #3 en borrador', 'PR #7 fusionado', 'PR abierto', 'PR en borrador', 'fusionado', 'Fusionada', 'pendiente: fusión', 'pendiente: la fusión']) {
    const w = rowWarnings(`- 2026-11-20 CRE-X-1 Resultado · rondas 1 · auditor 0/1/2 · ${state}`)
    expect(w, state).toHaveLength(1)
    expect(w[0]!.kind).toBe('row-format')
    expect(w[0]!.advice).toMatch(/estado del PR/)
  }
})

test('R2: «fusión» or «PR» as plain words are not a state (the real rows say «la fusión comprueba producción»)', () => {
  expect(rowWarnings('- 2026-11-23 CRE-GRD-FP-1 `guardia`: la fusión comprueba producción antes que el rol · pendiente: nada')).toEqual([])
  expect(rowWarnings('- 2026-11-23 CRE-X-1 En «sí» no fusiona aunque el responsable lo autorice · pendiente: piloto')).toEqual([])
  expect(rowWarnings('- 2026-11-23 CRE-X-1 El PR se abre en borrador por defecto · pendiente: nada')).toEqual([])
  // Descriptive text about PRs is not a state of this PR.
  expect(rowWarnings('- 2026-11-23 CRE-X-1 El orquestador deja el PR listo para revisar · pendiente: nada')).toEqual([])
  expect(rowWarnings('- 2026-11-23 CRE-X-1 Limpia la rama del PR fusionado y archiva · pendiente: nada')).toEqual([])
  expect(rowWarnings('- 2026-11-23 CRE-X-1 Cierra el PR abierto al relanzar · pendiente: nada')).toEqual([])
  expect(rowWarnings('- 2026-11-23 CRE-X-1 Si el PR está en borrador, no fusiona · pendiente: nada')).toEqual([])
})

test('R2: both problems in one row give two warnings; every bad row is reported', () => {
  expect(rowWarnings('- 2026-11-20 CRE-X-1 (a) b · PR #1 abierto')).toHaveLength(2)
  expect(rowWarnings('- 2026-11-20 CRE-X-1 (a) b', '- 2026-11-19 CRE-X-0 ok', '- 2026-11-18 CRE-X-9 (c)')).toHaveLength(2)
})

test('R2: also in progress/<id>.md, but not in progress/archivo.md, and not inside a fenced order', () => {
  const bad = withRows('- 2026-11-20 CRE-X-1 (a) b')
  expect(formatWarnings(src(bad, 'progress/cre-x-1.md')).map(w => w.file)).toEqual(['progress/cre-x-1.md'])
  expect(formatWarnings(src('# Archivo\n## Terminados\n- 2026-11-20 CRE-X-1 (a) b\n', 'progress/archivo.md'))).toEqual([])
  const fenced = ['## Trabajo actual: X', '```', '## Terminados', '- 2026-11-20 CRE-X-1 (a) b', '```', ...TITLES.slice(1), ''].join('\n')
  expect(formatWarnings(src(fenced))).toEqual([])
})

// ---- R3: no false positives ----

test('R3: the fixtures and the PROGRESS.md of this repo raise no format warning', () => {
  for (const text of [CREADOR, NONE]) expect(formatWarnings(src(text))).toEqual([])
  // The real file (frozen at origin/main 10e9b43): ten rows, the longest at the cap, «fusión» as plain words.
  expect(CREADOR_REAL).toContain('CRE-GRD-FP-1')
  expect(formatWarnings(src(CREADOR_REAL))).toEqual([])
  expect(allWarnings(src(CREADOR_REAL))).toEqual([]) // sizes too
})

// ---- Panel and notice to the model ----

test('the panel shows format warnings first, with the row quoted and what to do', () => {
  const list = describe(buildBoard(src(withRows('- 2026-11-20 CRE-X-1 (a) b'))), 80)
  expect(list[0]!.title).toBe('AVISO: PROGRESS.md NO SIGUE SU FORMATO')
  expect(list[0]!.tone).toBe('warning')
  const text = list[0]!.rows.map(r => r.text).join('\n')
  expect(text).toContain('CRE-X-1 (a) b')
  expect(text).toContain('Qué hacer:')
  for (const r of list[0]!.rows) expect(r.wrap).toBe(true)
  expect(list.slice(1).map(b => b.title.split(' (')[0])).toEqual(['EN CURSO', 'TE TOCA A TI', 'PENDIENTES DEL MÉTODO', 'HECHO'])
})

test('a size warning and a format warning share one block, with a title that says both', () => {
  const rows = Array.from({ length: 11 }, (_, i) => `- 2026-11-01 X-${i} ok`)
  const list = describe(buildBoard(src(['## Trabajo actual: ninguno', '## Terminados', ...rows, ''].join('\n'))), 80)
  expect(list[0]!.title).toBe('AVISO: PROGRESS.md EXCEDE TOPES Y NO SIGUE SU FORMATO')
  const text = list[0]!.rows.map(r => r.text).join('\n')
  expect(text).toContain('11 filas')
  expect(text).toContain('faltan títulos')
})

test('warningContext says the format is wrong and that it is only a notice', () => {
  const w = formatWarnings(src('# P\n'))
  const text = warningContext(w)
  expect(text).toMatch(/no sigue su formato/)
  expect(text).toContain(w[0]!.message)
  expect(text).toMatch(/no bloquea/i)
  expect(text).toContain('Corrígelo antes de cerrar la tarea')
  expect(text).not.toContain('Recórtalo')
  // size-only wording is unchanged
  const size = warningContext(sizeWarnings(src(withRows(...Array.from({ length: 11 }, (_, i) => `- 2026-11-01 X-${i} ok`)))))
  expect(size).toContain('excede sus topes de tamaño')
  expect(size).toContain('Recórtalo antes de cerrar la tarea')
  // mixed: it is not only a size matter, so «Corrígelo»
  expect(warningContext(allWarnings(src(['## Terminados', ...Array.from({ length: 11 }, (_, i) => `- 2026-11-01 X-${i} ok`), ''].join('\n'))))).toContain('Corrígelo')
})

// The model's notice (register.tsx) must carry the format warnings too, not only the size ones.
test('tool.call: after an Edit of PROGRESS.md, the model gets the format notice (missing title, bad row), once per turn', async ($, on) => {
  on('session.root', () => ({ value: '/repo' }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  let text: string | undefined = '# P\n## Trabajo actual: ninguno\n## Terminados\n- 2026-11-01 X-1 ok\n'
  on('fs.read', (_, e) => {
    if (text === undefined || !e.path.replace(/\\/g, '/').endsWith('/repo/PROGRESS.md')) throw new Error('ENOENT')
    return { value: text }
  })
  on('fs.list', () => {
    throw new Error('ENOENT')
  })
  on('tool.call', () => ({ result: { filePath: '/repo/PROGRESS.md' }, text: 'ok' }) as never)
  const edit = { tool: 'Edit', file_path: '/repo/PROGRESS.md', old_string: 'a', new_string: 'b' } as never

  await $.turn.start({ text: 'cierra', turnId: 't1' })
  const missing = (await $.tool.call(edit)).context?.join('\n') ?? ''
  expect(missing).toContain('no sigue su formato')
  expect(missing).toContain('«## Pendiente del responsable»')
  expect(missing).toContain('Corrígelo antes de cerrar la tarea')
  expect((await $.tool.call(edit)).context).toBeUndefined() // once per turn

  text = withRows('- 2026-11-20 CRE-X-1 (parcial) resultado')
  await $.turn.start({ text: 'sigue', turnId: 't2' })
  const row = (await $.tool.call(edit)).context?.join('\n') ?? ''
  expect(row).toContain('no sigue su formato')
  expect(row).toContain('CRE-X-1')

  text = withRows('- 2026-11-20 CRE-X-1 resultado')
  await $.turn.start({ text: 'fin', turnId: 't3' })
  expect((await $.tool.call(edit)).context).toBeUndefined() // a well-formed file: no notice
})

// ---- R4 ----

test('R4: with no PROGRESS.md the empty panel says where to open the chat', () => {
  const [b] = describe(buildBoard([]), 40)
  const row = b!.rows[0]!
  expect(row.text).toContain('Nada que mostrar')
  expect(row.text).toContain('carpeta raíz del repo del proyecto')
  expect(row.wrap).toBe(true) // wraps, so the width cap of the panel cannot cut it
})

test('R4: with a PROGRESS.md that has a format of its own (or is empty) the hint is not shown', () => {
  for (const text of [OWN_FORMAT, '']) {
    const list = describe(buildBoard(src(text)), 80)
    const empty = list.find(b => b.title === 'Tablero')!
    expect(empty.rows[0]!.text).toContain('Nada que mostrar')
    expect(empty.rows[0]!.text).not.toContain('carpeta raíz')
  }
  // progress/*.md alone also counts as having files
  const par = describe(buildBoard(src(OWN_FORMAT, 'progress/x-1.md')), 80).find(b => b.title === 'Tablero')!
  expect(par.rows[0]!.text).not.toContain('carpeta raíz')
})
