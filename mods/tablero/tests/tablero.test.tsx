import { expect, test } from 'claude-code/testing'
import { bulletTitle, buildBoard, clean, clip, describe, detail, doneTitle, EMPTY_HINT, EMPTY_TEXT, sentenceTitle, wrapLines } from '../hooks/board.ts'
import type { Block } from '../hooks/board.ts'
import { CREADOR, NONE, OWN_FORMAT, PARALLEL_A, PARALLEL_B } from './fixtures.ts'

const blocks = (text: string, width?: number) => describe(buildBoard([{ file: 'PROGRESS.md', text }]), width)
const rowsOf = (list: Block[], start: string) => list.find(b => b.title.startsWith(start))!.rows
const texts = (list: Block[], start: string) => rowsOf(list, start).map(r => r.text)

// ---- Clean text and short titles ----

test('markdown out of every row: bold, inline code, links', () => {
  expect(clean('**`guardia`: `HOME_LINK`** y [el manual](https://x.y/z)  aquí')).toBe('guardia: HOME_LINK y el manual aquí')
  expect(clean('sin nada')).toBe('sin nada')
  const all = describe(buildBoard([{ file: 'PROGRESS.md', text: CREADOR }]))
  for (const b of all) for (const r of b.rows) expect(`${r.text}${r.lead ?? ''}`).not.toMatch(/\*\*|`|\]\(/)
})

test('Terminados: compact date + id + name up to « (», «: » or « · »', () => {
  expect(doneTitle('2026-10-27 CRE-TAB-1 Mod `tablero`: panel de solo lectura (Hecho) · commits `f3c4e59`')).toEqual({
    lead: '27-10',
    text: 'CRE-TAB-1 Mod tablero',
  })
  expect(doneTitle('2026-10-26 CRE-MOD-1 Mod `guardia` en `mods/guardia/` (frena)')).toEqual({ lead: '26-10', text: 'CRE-MOD-1 Mod guardia en mods/guardia/' })
  expect(doneTitle('2026-10-25 Lecciones de la prueba Cloudflare · `21834d4`').text).toBe('Lecciones de la prueba Cloudflare')
  expect(doneTitle('sin fecha: algo')).toEqual({ text: 'sin fecha' })
  expect(doneTitle(`2026-10-01 ${'x'.repeat(200)}`).text).toHaveLength(90) // backup cap
})

test('pendientes: the bold text if there is one, else the first sentence', () => {
  expect(bulletTitle('**`guardia`: `HOME_LINK` no cubre `consulta`** (`rules.ts:9`): ampliarlo')).toBe('guardia: HOME_LINK no cubre consulta')
  expect(bulletTitle('Revisar el [manual](https://x.y) cuando haya tiempo. Después lo demás.')).toBe('Revisar el manual cuando haya tiempo')
  expect(bulletTitle('Primero esto: luego aquello')).toBe('Primero esto')
})

test('a time condition before «: » is skipped: the title is the action', () => {
  const raw = 'Tras fusionar CRE-TAB-1: instalar `tablero` (`claude plugin install tablero@creador`) y comprobar en una sesión interactiva que el panel se ve y se actualiza.'
  expect(sentenceTitle(raw)).toBe('instalar tablero y comprobar en una sesión interactiva que el panel se ve y se actualiza')
  expect(bulletTitle('Después de fusionar: revisar el PR')).toBe('revisar el PR')
  expect(sentenceTitle('Cuando haya tiempo: ordenar todo. Luego más')).toBe('ordenar todo')
  expect(sentenceTitle('Al terminar: cerrar')).toBe('cerrar')
  expect(sentenceTitle('Tras fusionar:')).toBe('Tras fusionar') // nothing after: keep the condition
  expect(sentenceTitle(`Tras fusionar: ${'palabra '.repeat(30)}`)).toHaveLength(90) // cut at the cap
})

test('sentence edge cases: all in parentheses, «p. ej.» and «etc.» do not end a sentence', () => {
  expect(sentenceTitle('(solo un comentario entre paréntesis)')).toBe('(solo un comentario entre paréntesis)')
  expect(sentenceTitle('Revisar los formatos (p. ej. proyecto-a, etc.) de otros proyectos. Luego más')).toBe('Revisar los formatos de otros proyectos')
  expect(sentenceTitle('Revisar formatos, p. ej. proyecto-a y etc. del resto. Luego más')).toBe('Revisar formatos, p. ej. proyecto-a y etc. del resto')
})

test('keys and heading in bold or code are still keys; «**ninguno**» is none', () => {
  const text = '## Trabajo actual: X-1 t\n- **Etapas:** [x] 1 uno · [ ] 2 dos\n- **Ciclo:** etapas aprobadas 1\n- **Pendiente / bloqueos:** espera al responsable\n'
  const [w] = buildBoard([{ file: 'P', text }]).current
  expect(w).toMatchObject({ stages: '[x] 1 uno · [ ] 2 dos', ciclo: 'etapas aprobadas 1', blockers: 'espera al responsable' })
  for (const none of ['**ninguno**', '`ninguno`', '**Ninguno.**']) {
    expect(buildBoard([{ file: 'P', text: `## Trabajo actual: ${none}\n` }]).current).toEqual([])
    expect(buildBoard([{ file: 'P', text: `## Trabajo actual: X-1 t\n- **Pendiente / bloqueos:** ${none}\n` }]).current[0]!.blockers).toBeUndefined()
  }
  expect(buildBoard([{ file: 'P', text: '## Trabajo actual\n\n- **ninguno**\n' }]).current).toEqual([])
})

test('Pendiente del responsable: the first sentence, parentheses out', () => {
  expect(sentenceTitle('Decidir si `global/CLAUDE.md:100` (lista de roles) menciona `/consulta` (ese archivo solo se edita con pedido tuyo explícito). El enlace ya existe.')).toBe(
    'Decidir si global/CLAUDE.md:100 menciona /consulta',
  )
  expect(sentenceTitle('Activar **Remote Control**: Settings → Claude Code')).toBe('Activar Remote Control')
  expect(sentenceTitle('**Proteger `main` en GitHub** (protección de ramas) en cada repo: no son una frontera')).toBe('Proteger main en GitHub en cada repo')
})

// ---- The blocks ----

test('the four blocks in order, with counts, with the real PROGRESS.md of Creador', () => {
  const list = blocks(CREADOR, 100)
  expect(list.map(b => b.title)).toEqual(['EN CURSO', 'TE TOCA A TI (4)', 'PENDIENTES DEL MÉTODO (3)', 'HECHO (6)'])

  expect(texts(list, 'TE TOCA A TI')).toEqual([
    'Decidir si global/CLAUDE.md:100 menciona /consulta',
    'instalar tablero y comprobar en una sesión interactiva que el panel se ve y se actualiza',
    'Activar Remote Control',
    'Proteger main en GitHub en cada repo de proyecto',
  ])
  expect(texts(list, 'PENDIENTES')).toEqual([
    'guardia: HOME_LINK no cubre consulta',
    '/consulta: evaluar disallowed-tools en su frontmatter',
    'Revisar el manual de pruebas cuando haya tiempo',
  ])
  expect(rowsOf(list, 'PENDIENTES').every(r => r.mark === '•')).toBe(true)

  const done = rowsOf(list, 'HECHO')
  expect(done.slice(0, 5).map(r => `${r.lead} ${r.text}`)).toEqual([
    '27-10 CRE-TAB-1 Mod tablero',
    '27-10 CRE-CON-1 Skill /consulta',
    '26-10 CRE-MOD-1 Mod guardia en mods/guardia/',
    '26-10 Modo paralelo',
    '25-10 Lecciones de la prueba Cloudflare, auditoría en templates/auditoria.md',
  ])
  // The «## Terminados» pasted inside the ``` block is not a section.
  expect(done.map(r => r.text).join('\n')).not.toContain('orden pegada')
  expect(done.at(-1)).toEqual({ text: '+1 más', tone: 'dim', indent: true })
})

test('EN CURSO: bold title, stages as a list, Ciclo dim', () => {
  const rows = rowsOf(blocks(CREADOR), 'EN CURSO')
  expect(rows[0]).toMatchObject({ text: 'CRE-TAB-1 Mod tablero (rama tarea/cre-tab-1)', bold: true })
  expect(rows.slice(1, 5)).toEqual([
    { mark: '✓', markTone: 'success', text: '1 rama y registro (f3c4e59)', indent: true, tone: 'dim' },
    { mark: '✓', markTone: 'success', text: '2 mod mods/tablero/ (lógica pura + panel)', indent: true, tone: 'dim' },
    { mark: '▶', markTone: 'accent', text: '3 prueba real y docs', indent: true, bold: true },
    { mark: '○', markTone: 'dim', text: '4 cierre', indent: true },
  ])
  expect(rows[5]).toEqual({ text: 'Ciclo: etapas aprobadas 4, auditoría pendiente, rondas 0', tone: 'dim', indent: true })
  expect(rows).toHaveLength(6) // «ninguno» blockers: no row
})

test('blockers in the warning tone, markdown out', () => {
  const rows = rowsOf(blocks(PARALLEL_A), 'EN CURSO')
  expect(rows.at(-1)).toEqual({ mark: '⚠', markTone: 'warning', text: 'Bloqueos: espera la decisión del responsable', tone: 'warning', indent: true })
})

test('«Trabajo actual: ninguno»: «Nada en curso», the rest stays', () => {
  const list = blocks(NONE)
  expect(buildBoard([{ file: 'PROGRESS.md', text: NONE }]).current).toEqual([])
  expect(rowsOf(list, 'EN CURSO')).toEqual([{ text: 'Nada en curso', tone: 'dim', indent: true }])
  expect(list.map(b => b.title)).toEqual(['EN CURSO', 'TE TOCA A TI (0)', 'PENDIENTES DEL MÉTODO (0)', 'HECHO (1)'])
  expect(texts(list, 'TE TOCA A TI')).toEqual(['Nada pendiente'])
  expect(texts(list, 'HECHO')).toEqual(['X-1 listo'])
})

test('the Ciclo line, stages and blockers of the open work', () => {
  const [w] = buildBoard([{ file: 'progress/A-1.md', text: PARALLEL_A }]).current
  expect(w).toEqual({
    file: 'progress/A-1.md',
    heading: 'A-1 Tarea A (rama tarea/a-1)',
    stages: '[x] 1 uno · [ ] 2 dos',
    ciclo: 'etapas aprobadas 1, auditoría pendiente, rondas 1',
    blockers: 'espera la decisión del responsable',
  })
})

test('parallel mode: several progress/*.md, each work named by its file', () => {
  const b = buildBoard([
    { file: 'PROGRESS.md', text: NONE },
    { file: 'progress/A-1.md', text: PARALLEL_A },
    { file: 'progress/B-2.md', text: PARALLEL_B },
  ])
  expect(b.current.map(w => w.file)).toEqual(['progress/A-1.md', 'progress/B-2.md'])
  expect(b.current[1]!.heading).toBe('B-2 Tarea B (rama tarea/b-2)') // heading on the next line
  const rows = describe(b)[0]!.rows
  expect(rows[0]!.text).toMatch(/^progress\/A-1\.md: A-1 Tarea A/)
  expect(rows.some(r => r.bold === true && r.text.startsWith('progress/B-2.md: B-2'))).toBe(true)
})

test('no files, or a format of its own: empty state, no error', () => {
  const empty = { title: 'Tablero', rows: [{ text: EMPTY_TEXT, tone: 'dim', wrap: true }] }
  // no file: no warning either, and only here the hint on where to open the chat (R4)
  expect(describe(buildBoard([]))).toEqual([{ title: 'Tablero', rows: [{ text: `${EMPTY_TEXT} ${EMPTY_HINT}`, tone: 'dim', wrap: true }] }])
  // CRE-TAB-FMT-1: a PROGRESS.md with a format of its own now also gets the missing-titles warning first.
  for (const files of [[{ file: 'PROGRESS.md', text: OWN_FORMAT }], [{ file: 'PROGRESS.md', text: '' }]]) {
    const b = buildBoard(files)
    expect(b.empty).toBe(true)
    const list = describe(b)
    expect(list).toHaveLength(2)
    expect(list[0]!.title).toBe('AVISO: PROGRESS.md NO SIGUE SU FORMATO')
    expect(list[1]).toEqual(empty)
  }
})

test('a ## inside a ``` block is not a section', () => {
  const text = ['## Trabajo actual: ninguno', '```', '## Trabajo actual: FALSO-1', '## Terminados', '- falso', '```', '## Terminados', '- real', ''].join('\n')
  const b = buildBoard([{ file: 'PROGRESS.md', text }])
  expect(b.current).toEqual([])
  expect(b.done).toEqual(['real'])
})

test('a fence is closed only by the same character, at least as long; indented ones count', () => {
  const text = ['## Trabajo actual: ninguno', '~~~', '```', '## Terminados', '- falso 1', '```', '## Terminados', '- falso 2', '~~~', '## Terminados', '- real', ''].join('\n')
  expect(buildBoard([{ file: 'P', text }]).done).toEqual(['real'])
  const long = ['## Terminados', '````', '```', '## Terminados', '- falso', '````', '- real', ''].join('\n')
  expect(buildBoard([{ file: 'P', text: long }]).done).toEqual(['real'])
  expect(buildBoard([{ file: 'P', text: '## Terminados\n- a\n    ```\n    x\n```\n## Terminados\n- b\n' }]).done).toEqual(['a', 'b'])
})

test('«ninguno» is strict: the whole phrase, nothing that only starts like it', () => {
  for (const none of ['ninguno', '(ninguno)', 'Ninguno.', 'Ninguno (todo fusionado)', 'nada', 'sin bloqueos', 'Ninguna', '- Ninguno']) {
    expect(buildBoard([{ file: 'P', text: `## Trabajo actual: ${none}\n` }]).current).toEqual([])
    const w = buildBoard([{ file: 'P', text: `## Trabajo actual: X-1 t\n- Pendiente / bloqueos: ${none}\n` }]).current[0]!
    expect(w.blockers).toBeUndefined()
  }
  for (const work of ['Sin bloqueo de UI: X-1', 'NADA-3 tarea', 'Nada-1 x', 'Ninguna-2 x', 'Sin bloqueos-4 refactor', 'Ningunear-1 t']) {
    expect(buildBoard([{ file: 'P', text: `## Trabajo actual: ${work}\n` }]).current.map(w => w.heading)).toEqual([work])
  }
  for (const blocker of ['Nada de tests aún: falta CI', 'Sin bloqueos-4 refactor', 'ninguno pero espera al responsable']) {
    const w = buildBoard([{ file: 'P', text: `## Trabajo actual: X-1 t\n- Pendiente / bloqueos: ${blocker}\n` }]).current[0]!
    expect(w.blockers).toBe(blocker)
  }
})

test('limits: 5 in HECHO, 8 pendientes and 6 for el responsable, then a dim «+N más»', () => {
  const items = (n: number) => Array.from({ length: n }, (_, i) => `- item ${i + 1}`).join('\n')
  const list = blocks(`## Trabajo actual: ninguno\n## Terminados\n${items(9)}\n## Pendientes del método\n${items(10)}\n## Pendiente del responsable\n${items(8)}\n`)
  expect(list.map(b => b.title.replace(/^[^(]*/, ''))).toEqual(['', '(8)', '(10)', '(9)'])
  expect(rowsOf(list, 'HECHO')).toHaveLength(6)
  expect(rowsOf(list, 'HECHO').at(-1)).toEqual({ text: '+4 más', tone: 'dim', indent: true })
  expect(rowsOf(list, 'PENDIENTES').at(-1)!.text).toBe('+2 más')
  expect(rowsOf(list, 'PENDIENTES')).toHaveLength(9)
  expect(rowsOf(list, 'TE TOCA A TI').at(-1)!.text).toBe('+2 más')
  expect(rowsOf(list, 'TE TOCA A TI')).toHaveLength(7)
  // nothing cut, nothing added
  expect(texts(blocks('## Terminados\n- a\n- b\n'), 'HECHO')).toEqual(['a', 'b'])
})

test('rows are fitted to the panel width; titles wrap; every stage keeps its own row', () => {
  expect(clip('a'.repeat(300), 40)).toHaveLength(40)
  expect(clip('corto', 40)).toBe('corto')
  const long = `## Trabajo actual: X-1 ${'título '.repeat(20)}\n- Etapas: ${Array.from({ length: 8 }, (_, i) => `[${i < 7 ? 'x' : ' '}] ${i + 1} ${'etapa '.repeat(12)}`).join(' · ')}\n`
  const rows = rowsOf(blocks(long, 40), 'EN CURSO')
  expect(rows[0]!.wrap).toBe(true)
  expect(rows[0]!.text.length).toBeGreaterThan(40) // a title is not cut
  const stages = rows.slice(1)
  expect(stages).toHaveLength(8)
  for (const r of stages) expect(2 + 2 + r.text.length).toBeLessThanOrEqual(40)
  expect(stages.at(-1)).toMatchObject({ mark: '▶' }) // the pending one is not lost
  const narrow = blocks(CREADOR, 30)
  for (const b of narrow) for (const r of b.rows) if (r.wrap !== true) expect(r.text.length).toBeLessThanOrEqual(30)
})

// ---- The pane, on every surface ----

const PANE = {
  plugin: 'tablero',
  component: 'Pane',
  requestId: 'tablero',
  props: { title: 'Tablero', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const

test('the pane reads PROGRESS.md and progress/*.md of the session root', async ($, on) => {
  // The engine may spell the path with a drive and backslashes (Windows).
  const tail = (p: string) => p.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')
  const files: Record<string, string> = {
    '/repo/PROGRESS.md': CREADOR,
    '/repo/progress/A-1.md': PARALLEL_A,
  }
  on('session.root', () => ({ value: '/repo/' }))
  on('fs.read', (_, e) => {
    const text = files[tail(e.path)]
    if (text === undefined) throw new Error('ENOENT')
    return { value: text }
  })
  on('fs.list', (_, e) => {
    if (tail(e.path) !== '/repo/progress') throw new Error('ENOENT')
    return { value: [{ name: 'A-1.md', kind: 'file', size: 1, mtimeMs: 1, isLink: false }, { name: 'notas.txt', kind: 'file', size: 1, mtimeMs: 1, isLink: false }] }
  })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    for (const title of [/EN CURSO/, /TE TOCA A TI \(4\)/, /PENDIENTES DEL MÉTODO \(3\)/, /HECHO \(6\)/]) {
      expect(await ui.find({ type: 'Text', text: title }), `${surface}: ${title}`).toBeDefined()
    }
    expect(await ui.find({ type: 'Text', text: /progress\/A-1\.md: A-1 Tarea A/ })).toBeDefined()
    // A row with a description is a Button now (a click unfolds it).
    expect(await ui.find({ type: 'Button', text: /27-10 .*CRE-TAB-1 Mod tablero/ }), `${surface}: done row`).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Ciclo: etapas aprobadas 1/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\*\*|`/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('the pane in a folder with no PROGRESS.md shows the empty state', async ($, on) => {
  on('session.root', () => ({ value: '/vacio' }))
  on('fs.read', () => {
    throw new Error('ENOENT')
  })
  on('fs.list', () => {
    throw new Error('ENOENT')
  })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /No hay PROGRESS\.md/ })).toBeDefined()
    await ui.unmount()
  }
})

test('the mod only reads: it never writes a file', async ($, on) => {
  let wrote = 0
  on('session.root', () => ({ value: '/repo' }))
  on('fs.read', () => ({ value: CREADOR }))
  on('fs.list', () => ({ value: [] }))
  on('fs.write', () => {
    wrote++
    return { value: undefined }
  })
  on('command.register', () => ({ value: { command: 'tablero' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.find({ type: 'Text', text: /CRE-TAB-1/ })
  await ui.unmount()
  expect(wrote).toBe(0)
})

// ---- Description of each row (unfolds on click) ----

const OWNER_RAW = 'Comprobar el panel (ya instalado). Falta ver que se **redibuja** cada 5 s, con `invalidate`: [doc](https://x.y).'
const OWNER_KEY = `owner:${OWNER_RAW}`

const DESC_TEXT = [
  '## Pendiente del responsable',
  `- ${OWNER_RAW}`,
  '- Solo un título',
  '## Pendientes del método',
  '- **Subir la rama**: hacerlo con `git push` solo con permiso.',
  '## Para la próxima orden',
  '- Esto no es un pendiente del método.',
  '## Terminados',
  '- 2026-10-29 CRE-X-1 Algo hecho (detalle del trabajo) · commits `abc`',
  '',
].join('\n')

test('detail: what the title leaves, clean; the whole bullet if the title was rewritten; empty if nothing', () => {
  const raw = 'Comprobar el panel (ya instalado). Falta ver **todo**: [doc](https://x.y).'
  expect(detail(raw, sentenceTitle(raw))).toBe('(ya instalado). Falta ver todo: doc.')
  expect(detail('**Subir la rama**: hacerlo con `git push`', 'Subir la rama')).toBe('hacerlo con git push')
  expect(detail('Solo un título', 'Solo un título')).toBe('')
  expect(detail('Tras fusionar X: borrar el enlace', 'borrar el enlace')).toBe('Tras fusionar X')
  // A title that dropped a parenthesis: the description does not repeat it, and keeps what was dropped.
  expect(detail('Revisar (p. ej. esto) y más cosas', 'Revisar y más cosas')).toBe('(p. ej. esto)')
  const real = 'Proteger **`main` en GitHub** (protección de ramas) en cada repo de proyecto: las reglas deny no son una frontera.'
  expect(detail(real, sentenceTitle(real))).toBe('(protección de ramas) las reglas deny no son una frontera.')
  expect(detail('Algo que no empieza igual (x)', 'Otra cosa')).toBe('Algo que no empieza igual (x)')
  expect(detail('2026-10-29 CRE-X-1 Algo (detalle)', 'CRE-X-1 Algo', true)).toBe('(detalle)')
  const cut = sentenceTitle(`${'palabra '.repeat(30)}fin. Resto`)
  expect(detail(`${'palabra '.repeat(30)}fin. Resto`, cut).startsWith('palabra')).toBe(true)
})

test('wrapLines: at most 2 lines of the width, the rest ends in «…»', () => {
  expect(wrapLines('uno dos tres', 20)).toEqual(['uno dos tres'])
  expect(wrapLines('uno dos tres cuatro', 8)).toEqual(['uno dos', 'tres cu…'])
  expect(wrapLines('palabra '.repeat(40).trim(), 30)).toHaveLength(2)
  for (const l of wrapLines('palabra '.repeat(40).trim(), 30)) expect(l.length).toBeLessThanOrEqual(30)
  expect(wrapLines('x'.repeat(100), 10)).toEqual(['xxxxxxxxx…']) // a word wider than the line ends in «…» too
  expect(wrapLines(`${'x'.repeat(30)} fin`, 10)).toEqual(['xxxxxxxxx…', 'fin'])
})

test('rows with more text after the title carry a key; the description shows only when open', () => {
  const board = buildBoard([{ file: 'PROGRESS.md', text: DESC_TEXT }])
  const closed = describe(board, 60)
  const keys = closed.flatMap(b => b.rows.filter(r => r.key !== undefined).map(r => r.key))
  expect(keys).toHaveLength(3) // «Solo un título» has none
  expect(texts(closed, 'TE TOCA A TI')).toEqual(['Comprobar el panel', 'Solo un título'])
  expect(rowsOf(closed, 'TE TOCA A TI')[1]!.key).toBeUndefined()

  const open = describe(board, 60, new Set(keys as string[]))
  const owner = rowsOf(open, 'TE TOCA A TI')
  expect(owner[0]!.key).toBe(OWNER_KEY)
  expect(owner[1]).toMatchObject({ tone: 'dim', indent: true })
  expect(owner[1]!.text).toContain('Falta ver que se redibuja')
  expect(owner).toHaveLength(4) // title, 2 lines of description, «Solo un título»
  expect(texts(open, 'HECHO')[1]).toContain('(detalle del trabajo)')
  for (const b of open) for (const r of b.rows) expect(r.text).not.toMatch(/\*\*|`|\]\(/)
})

test('an open description is at most 2 lines and fits the width', () => {
  const long = `## Pendiente del responsable\n- Hacer algo. ${'texto largo '.repeat(40)}\n`
  const board = buildBoard([{ file: 'P', text: long }])
  const key = rowsOf(describe(board, 40), 'TE TOCA A TI')[0]!.key!
  const rows = rowsOf(describe(board, 40, new Set([key])), 'TE TOCA A TI')
  expect(rows).toHaveLength(3)
  for (const r of rows.slice(1)) expect(r.text.length).toBeLessThanOrEqual(40 - 4 + 2)
  expect(rows[2]!.text.endsWith('…')).toBe(true)
})

test('two bullets with the same title get their own key: opening one does not open the other', () => {
  const text = [
    '## Pendiente del responsable',
    '- Probar: uno',
    '- Probar: dos',
    '- Probar: uno',
    '## Terminados',
    '- 2026-10-29 CRE-X-1 Algo (primero)',
    '- 2026-10-29 CRE-X-1 Algo (segundo)',
    '',
  ].join('\n')
  const board = buildBoard([{ file: 'P', text }])
  const keysOf = (list: Block[], start: string) => rowsOf(list, start).map(r => r.key)
  const closed = describe(board, 60)
  for (const start of ['TE TOCA A TI', 'HECHO']) {
    const keys = keysOf(closed, start)
    expect(new Set(keys).size, start).toBe(keys.length) // every key is unique
    expect(keys.every(k => k !== undefined)).toBe(true)
  }
  expect(keysOf(closed, 'TE TOCA A TI')).toEqual(['owner:Probar: uno', 'owner:Probar: dos', 'owner:Probar: uno#2'])
  // Stable between redraws, and the date is not part of the title in the key's text of the row.
  expect(keysOf(describe(board, 60), 'HECHO')).toEqual(keysOf(closed, 'HECHO'))

  const [first] = keysOf(closed, 'HECHO') as string[]
  const rows = rowsOf(describe(board, 60, new Set([first!])), 'HECHO')
  expect(rows.map(r => r.text)).toEqual(['CRE-X-1 Algo', '  (primero)', 'CRE-X-1 Algo'])
  expect(rows[0]!.lead).toBe('29-10')
})

test('«## Para la próxima orden» is not «Pendientes»: its bullets do not reach any block', () => {
  const board = buildBoard([{ file: 'PROGRESS.md', text: DESC_TEXT }])
  expect(board.todo).toEqual(['**Subir la rama**: hacerlo con `git push` solo con permiso.'])
  const only = buildBoard([{ file: 'P', text: '## Para la próxima orden\n- algo\n' }])
  expect(only.empty).toBe(true)
  expect(only.todo).toEqual([])
})

test('a clickable row draws its «•» and (in HECHO) its date once, and a label that carries them, on every surface (CRE-TAB-3)', async ($, on) => {
  on('session.root', () => ({ value: '/repo' }))
  on('fs.read', (_, e) => {
    if (!e.path.replaceAll('\\', '/').endsWith('/repo/PROGRESS.md')) throw new Error('ENOENT')
    return { value: DESC_TEXT }
  })
  on('fs.list', () => {
    throw new Error('ENOENT')
  })
  const count = (s: string, what: string) => s.split(what).length - 1

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const owner = await ui.find({ type: 'Button', text: /Comprobar el panel/ })
    const done = await ui.find({ type: 'Button', text: /CRE-X-1 Algo hecho/ })
    expect(owner, `${surface}: TE TOCA A TI row`).toBeDefined()
    expect(done, `${surface}: HECHO row`).toBeDefined()
    // A desktop draws its native button from `label`. The module gives none, so the engine takes the
    // children's text (mark and date included); a label of the title alone is what hid them.
    expect(owner!.props.label, `${surface}: label = children`).toBe(owner!.text.trim())
    expect(done!.props.label, `${surface}: label = children`).toBe(done!.text.trim())
    expect(count(owner!.text, '•'), `${surface}: mark`).toBe(1)
    expect(count(done!.text, '•'), `${surface}: mark`).toBe(1)
    expect(count(done!.text, '29-10'), `${surface}: date`).toBe(1)
    expect(count(done!.text, 'CRE-X-1 Algo hecho'), `${surface}: title once`).toBe(1)
    expect(count(owner!.text, 'Comprobar el panel'), `${surface}: title once`).toBe(1)
    // The press still unfolds and folds the description.
    await ui.press({ key: OWNER_KEY })
    expect(await ui.find({ type: 'Text', text: /Falta ver que se redibuja/ }), `${surface}: open`).toBeDefined()
    await ui.press({ key: OWNER_KEY })
    expect(await ui.find({ type: 'Text', text: /Falta ver que se redibuja/ }), `${surface}: folded`).toBeUndefined()
    await ui.unmount()
  }
})

test('the pane: pressing a row unfolds its description, pressing again folds it, on every surface', async ($, on) => {
  on('session.root', () => ({ value: '/repo' }))
  on('fs.read', (_, e) => {
    if (!e.path.replaceAll('\\', '/').endsWith('/repo/PROGRESS.md')) throw new Error('ENOENT')
    return { value: DESC_TEXT }
  })
  on('fs.list', () => {
    throw new Error('ENOENT')
  })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Falta ver que se redibuja/ }), `${surface}: closed`).toBeUndefined()
    await ui.press({ key: OWNER_KEY })
    expect(await ui.find({ type: 'Text', text: /Falta ver que se redibuja/ }), `${surface}: open`).toBeDefined()
    await ui.press({ key: OWNER_KEY })
    expect(await ui.find({ type: 'Text', text: /Falta ver que se redibuja/ }), `${surface}: folded`).toBeUndefined()
    await ui.unmount()
  }
})
