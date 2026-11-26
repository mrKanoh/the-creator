// roleOf over the real text of skills/orquestador and skills/trabajador, read
// from the repo. `claude plugin test` reads no files (no fs, no .md import),
// so this runs under node: node --experimental-strip-types <this file>
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { roleOf } from '../hooks/rules.ts'

const read = (role) => readFileSync(new URL(`../../../skills/${role}/SKILL.md`, import.meta.url), 'utf8')
const withoutFrontMatter = (text) => text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
const tag = (role) => `<command-message>${role}</command-message>\n<command-name>/${role}</command-name>`
const base = (role) => `Base directory for this skill: C:\\Users\\usuario\\.claude\\skills\\${role}\n\n`
const launch = (role) => `Lee y aplica las reglas de \`C:\\repos\\creador\\skills\\${role}\\SKILL.md\``

const ORQ = read('orquestador')
const TRAB = read('trabajador')
// The finding A1 rests on: the orchestrator's skill quotes the worker's launch line.
assert.ok(ORQ.includes(launch('trabajador')), 'skills/orquestador/SKILL.md no longer quotes the worker launch line')
// roleOf counts a launch line inside a skill's text only at a line start: the real one must quote it mid-line.
assert.ok(!/^[ \t]*lee y aplica las reglas de/im.test(ORQ), 'skills/orquestador/SKILL.md has a launch line at a line start')

const cases = [
  ['/orquestador, tag and skill in one message', [`${tag('orquestador')}\n${ORQ}`], 'orquestador'],
  ['/orquestador, tag and skill apart', [tag('orquestador'), base('orquestador') + withoutFrontMatter(ORQ)], 'orquestador'],
  ['/orquestador with a later user message', [tag('orquestador'), base('orquestador') + withoutFrontMatter(ORQ), 'fusiona el PR 12'], 'orquestador'],
  ['orchestrator launched by its launch line, with a hand-over', [`${launch('orquestador')}\n\nTraspaso: el trabajador sigue con la etapa 2.`], 'orquestador'],
  ['real worker: launch line, then an order naming the orchestrator',
    [`Background (from the session that started this one):\nx\n\nTask:\n${launch('trabajador')}\n\n\`\`\`\nProyecto: x\n` +
      `No autorizado: fusionar (lo hace el orquestador). Al cerrar, el orquestador relanza con ${launch('orquestador')}\n\`\`\``], 'trabajador'],
  ['/trabajador, tag and skill', [tag('trabajador'), base('trabajador') + withoutFrontMatter(TRAB)], 'trabajador'],
  ['orchestrator skill text with the worker launch line starting a line',
    [`${tag('orquestador')}\n${ORQ}\n${launch('trabajador')}\n`], 'trabajador'],
  ['worker that also got the orchestrator skill', [`${launch('trabajador')}\n\n\`\`\`\nx\n\`\`\``, `${tag('orquestador')}\n${ORQ}`], 'trabajador'],
  // CRE-GRD-ROL-1: a pasted block that quotes the worker launch line, then a real /orquestador.
  ['pasted block quoting the worker launch, then /orquestador',
    [`<pasted_content id="1">\n${launch('orquestador')}\n\n\`\`\`\n${launch('trabajador')}\n\`\`\`\n</pasted_content id="1">`,
      `${tag('orquestador')}\n<command-args>reintenta la fusión del PR 6</command-args>`, base('orquestador') + withoutFrontMatter(ORQ)], 'orquestador'],
]

for (const [name, texts, want] of cases) assert.equal(roleOf(texts), want, name)
console.log(`rol-skills-reales: ${cases.length} casos con el texto real de las skills, todos bien`)
