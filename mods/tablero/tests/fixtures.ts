// Text samples in the formats in use. CREADOR follows PROGRESS.md of this repo
// (CRE-TAB-1 open, long bullets shortened but with the same shapes: dates, bold,
// inline code, links, parentheses and « · » tails).
const F = '```'

export const CREADOR = [
  '# PROGRESS — Creador (el método)',
  '',
  'Estado del método y trabajo pendiente.',
  '',
  '## Trabajo actual: CRE-TAB-1 Mod `tablero`  (rama tarea/cre-tab-1)',
  '- Etapas: [x] 1 rama y registro (f3c4e59) · [x] 2 mod `mods/tablero/` (lógica pura + panel) · [ ] 3 prueba real y docs · [ ] 4 cierre',
  '- Ciclo: etapas aprobadas 4, auditoría pendiente, rondas 0',
  '- Línea base de pruebas: sin dato',
  '- Pendiente / bloqueos: ninguno',
  '### Orden (resumida)',
  'Tamaño normal, implementación. Ejemplo pegado:',
  F,
  '## Terminados',
  '- esto es una línea de la orden pegada, no un terminado',
  F,
  '',
  '## Pendientes del método (en orden de ejecución)',
  '',
  'Origen: auditoría completa del 2026-10-26.',
  '',
  '1. **`guardia`: `HOME_LINK` no cubre `consulta`** (`mods/guardia/hooks/rules.ts:9`): ampliarlo, con sus pruebas. Sin implementar.',
  '2. **`/consulta`: evaluar `disallowed-tools` en su frontmatter** para quitar la shell. Sin implementar.',
  '3. Revisar el [manual de pruebas](https://example.com/manual) cuando haya tiempo. Después lo demás.',
  '',
  '## Pendiente del responsable',
  '',
  '- Decidir si `global/CLAUDE.md:100` (lista de roles) menciona `/consulta` (ese archivo solo se edita con pedido tuyo explícito). El enlace ya existe.',
  '- Tras fusionar CRE-TAB-1: instalar `tablero` (`claude plugin install tablero@creador`) y comprobar en una sesión interactiva que el panel se ve y se actualiza.',
  '- Activar **Remote Control**: Settings → Claude Code → «Connect new sessions to Remote Control».',
  '- **Proteger `main` en GitHub** (protección de ramas) en cada repo de proyecto: las reglas deny no son una frontera completa.',
  '',
  '## Sin probar en uso real',
  '',
  'Modo paralelo con dos tareas reales.',
  '',
  '## Terminados',
  '',
  '- 2026-10-27 CRE-TAB-1 Mod `tablero`: panel de solo lectura (Hecho, En curso, Por hacer) · commits `f3c4e59`',
  '- 2026-10-27 CRE-CON-1 Skill `/consulta`: `skills/consulta/SKILL.md` (Haiku, `context: fork`) · commits `fac453c`',
  '- 2026-10-26 CRE-MOD-1 Mod `guardia` en `mods/guardia/` (frena `gh pr create` con trabajo abierto) · commits `b8ced4c`',
  '- 2026-10-26 Modo paralelo (worktrees, `progress/<id>.md`, puertos, un PR por tarea) · `10066cb`',
  '- 2026-10-25 Lecciones de la prueba Cloudflare, auditoría en `templates/auditoria.md` · `21834d4`',
  '- 2026-10-24 CRE-OLD-1 Algo más antiguo: detalle',
  '',
].join('\n')

// CRE-TAB-FMT-1: carries the four titles formato-progress.md requires (it lacked two before), with no bullets under them.
export const NONE = [
  '# P',
  '',
  '## Trabajo actual: ninguno',
  '',
  '## Pendiente del responsable',
  '',
  '## Pendientes',
  '',
  '## Terminados',
  '- 2026-10-01 X-1 listo · pendiente: nada',
  '',
].join('\n')

export const PARALLEL_A = [
  '## Trabajo actual: A-1 Tarea A  (rama tarea/a-1)',
  '- Etapas: [x] 1 uno · [ ] 2 dos',
  '- Ciclo: etapas aprobadas 1, auditoría pendiente, rondas 1',
  '- Pendiente / bloqueos: espera la decisión del **responsable**',
  '',
].join('\n')

export const PARALLEL_B = [
  '## Trabajo actual',
  '',
  'B-2 Tarea B  (rama tarea/b-2)',
  '- Etapas: [ ] 1 uno',
  '',
].join('\n')

// Own format (no sections the panel knows).
export const OWN_FORMAT = ['# proyecto-a', '## Checkpoint 0A', '### Estado', '- todo bien', ''].join('\n')
