import type { EngineInterface, Register } from 'claude-code'
import { allWarnings, buildBoard, describe, isProgressTouch, warningContext } from './board.ts'
import type { Row, Source, Tone } from './board.ts'

const PANE = 'tablero'
const TITLE = 'Tablero'
const EVERY_MS = 5000
const DEFAULT_COLUMNS = 60

// Tones are theme keys, so the panel follows the person's theme.
const COLOR: Record<Tone, string> = { dim: 'subtle', warning: 'warning', success: 'success', accent: 'claude' }

// Read-only: only $.fs.read and $.fs.list, only PROGRESS.md and progress/*.md
// of the session's project root. A missing file or folder is simply skipped.
async function load($: EngineInterface): Promise<Source[]> {
  // The project root, which follows /cd and worktrees (a shell `cd` does not move it).
  const cwd = (await $.session.root()).replace(/[\\/]+$/, '')
  const files: Source[] = []
  const take = async (file: string) => {
    const text = await $.fs.read(`${cwd}/${file}`).catch(() => undefined)
    if (typeof text === 'string') files.push({ file, text })
  }
  await take('PROGRESS.md')
  const listed = await $.fs.list(`${cwd}/progress`).catch(() => [])
  const notes = listed.filter(f => f.kind === 'file' && /\.md$/i.test(f.name)).map(f => f.name).sort()
  for (const name of notes) await take(`progress/${name}`)
  return files
}

export const register: Register = on => {
  // Rows the person unfolded (by Row.key). Lives with the module: a reload folds them all.
  const open = new Set<string>()

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'tablero', description: 'Abre el panel de estado (PROGRESS.md, solo lectura)' })
    void $.ui.open({ id: PANE, title: TITLE })
    // The drawing reads the files again on each redraw; the timer asks for one.
    $.clock.every(EVERY_MS, () => $.ui.invalidate('ui.render'))

    return next(e)
  })

  // The notice for the model (R3, CRE-TAB-TAM-1): after an edit of PROGRESS.md / progress/*.md or a
  // `git commit` that left a limit passed, the tool's result carries one extra context line the model
  // reads. Once per turn of the main loop. It never denies, never changes the result and never starts a
  // turn (classic.Stop's additionalContext does: see README).
  let noticed = false
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) noticed = false
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (noticed || ran.deny !== undefined || ran.isError === true) return ran
    if (!isProgressTouch(e.tool, e as { file_path?: unknown; command?: unknown })) return ran
    const text = warningContext(allWarnings(await load($)))
    if (text === '') return ran
    noticed = true
    return { ...ran, context: [...(ran.context ?? []), text] }
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'tablero' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Panel Tablero abierto.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    // Rows are fitted to the box the pane draws into (narrower than the viewport when docked).
    const width = Math.max(20, e.props.bodyColumns ?? DEFAULT_COLUMNS)
    const blocks = describe(buildBoard(await load($)), width, open)
    const parts = (row: Row) => [
      row.indent === true ? '  ' : '',
      row.mark !== undefined && <Text color={row.markTone === undefined ? undefined : COLOR[row.markTone]}>{row.mark} </Text>,
      row.lead !== undefined && <Text dimColor>{row.lead} </Text>,
      <Text bold={row.bold === true} dimColor={row.tone === 'dim'} color={row.tone === undefined || row.tone === 'dim' ? undefined : COLOR[row.tone]}>
        {row.text}
      </Text>,
    ]
    // A row with a description is a Button: a click (or Enter under the focus) unfolds it, another folds it.
    // No `label`: claude-code.d.ts (ButtonProps.label) says that without it the control is named by the
    // children's text. A desktop draws its native button (types) and, as the owner saw, a label of row.text
    // alone left out the mark and the date. The `key` is the address the children no longer give.
    const line = (row: Row) =>
      row.key === undefined ? (
        <Text wrap={row.wrap === true ? 'wrap' : 'truncate-end'}>{parts(row)}</Text>
      ) : (
        <Button
          key={row.key}
          plain
          onPress={() => {
            if (!open.delete(row.key!)) open.add(row.key!)
            $.ui.invalidate('ui.render')
          }}
        >
          {parts(row)}
        </Button>
      )

    return (
      <Box flexDirection="column">
        {blocks.map(block => (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color={block.tone === undefined ? undefined : COLOR[block.tone]}>
              {block.title}
            </Text>
            {block.rows.map(line)}
          </Box>
        ))}
      </Box>
    )
  })
}
