import type { EngineInterface, Register } from 'claude-code'
import {
  currentWork, findKill, findLinkCreate, findMerge, findPrCreate, findShellWrite, isOpen, isProtected, joinPath, linkVerdict,
  MSG_KILL_ESCAPE, MSG_KILL_NAME, MSG_KILL_UNCLEAR, MSG_LINK_FAILED, MSG_MERGE_ENV, MSG_MERGE_FAILED, MSG_MERGE_PROD, MSG_MERGE_REPO, MSG_MERGE_ROLE, MSG_MERGE_UNCLEAR, MSG_PR,
  MSG_SHELL_FAILED, MSG_SKILLS, MSG_SKILLS_FAILED, NAMES_PROTECTED, publishesOnMerge, repoOf, roleOf,
} from './rules.ts'
import { findGitMain, MSG_GITMAIN, MSG_GITMAIN_UNCLEAR, namesGitChange } from './gitmain.ts'
import { findWorktreeRemove, MSG_WORKTREE_REMOVE, MSG_WORKTREE_UNCLEAR, namesWorktreeRemove } from './worktree.ts'
import { findPush, MSG_PUSH, MSG_PUSH_UNCLEAR, namesPush } from './push.ts'

const git = ($: EngineInterface, cwd: string, args: string[]) =>
  $.process.run(['git', ...args], { cwd })

// The first file in HEAD whose «Trabajo actual» is still open: the branch's
// own progress/<x>.md, any other progress/*.md (its id need not match the
// branch), then PROGRESS.md. undefined when all are closed, there are none,
// or the folder is not a repository.
async function openWork($: EngineInterface, cwd: string) {
  const top = await git($, cwd, ['rev-parse', '--show-toplevel'])
  if (top.exitCode !== 0) return undefined
  const root = top.stdout.trim()
  const listed = await git($, root, ['ls-tree', '--name-only', 'HEAD'])
  if (listed.exitCode !== 0) return undefined
  const entries = listed.stdout.split('\n').map(l => l.trim())

  const files: string[] = []
  const folder = entries.find(n => n.toLowerCase() === 'progress')
  if (folder !== undefined) {
    const inFolder = await git($, root, ['ls-tree', '--name-only', 'HEAD', `${folder}/`])
    const branch = (await git($, root, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()
    const own = `${folder}/${branch.match(/^tarea\/(.+)$/i)?.[1] ?? ''}.md`.toLowerCase()
    const notes = inFolder.stdout.split('\n').map(l => l.trim()).filter(n => /\.md$/i.test(n))
    files.push(...notes.filter(n => n.toLowerCase() === own), ...notes.filter(n => n.toLowerCase() !== own))
  }
  const progress = entries.find(n => n.toLowerCase() === 'progress.md')
  if (progress !== undefined) files.push(progress)

  for (const file of files) {
    const shown = await git($, root, ['show', `HEAD:${file}`])
    if (shown.exitCode !== 0) throw new Error(`git show HEAD:${file} failed`)
    const status = currentWork(shown.stdout)
    if (isOpen(status)) return { file, heading: `## Trabajo actual: ${status}` }
  }
  return undefined
}

const BRANCH = /^(?!-)[A-Za-z0-9._/-]+$/

// Why the orchestrator may not merge PR `pr` from this folder, or undefined
// when it may: the PR must be of origin's repo (gh may resolve another, e.g.
// `gh repo set-default upstream`), and AGENTS.md on the remote base branch,
// origin/<the PR's base> (origin/HEAD when gh names none; a base that is no
// plain branch name stops it), never HEAD (the PR's
// own branch must not decide), must say merging does not publish. Whatever
// cannot be read stops it.
async function mergeDenial($: EngineInterface, cwd: string, pr: string) {
  const top = await git($, cwd, ['rev-parse', '--show-toplevel'])
  if (top.exitCode !== 0) return MSG_MERGE_PROD(undefined)
  const root = top.stdout.trim()
  const view = await $.process.run(['gh', 'pr', 'view', pr, '--json', 'url,baseRefName'], { cwd: root })
    .catch(() => undefined)
  let seen: { url?: unknown; baseRefName?: unknown } = {}
  try {
    if (view?.exitCode === 0) seen = JSON.parse(view.stdout)
  } catch {}
  const origin = await git($, root, ['remote', 'get-url', 'origin'])
  const prRepo = typeof seen.url === 'string' ? repoOf(seen.url) : undefined
  const originRepo = origin.exitCode === 0 ? repoOf(origin.stdout) : undefined
  if (prRepo === undefined || prRepo !== originRepo) return MSG_MERGE_REPO(prRepo, originRepo)

  // origin/HEAD only when gh names no base; a base it names that is no plain
  // branch name stops it below.
  let base = typeof seen.baseRefName === 'string' ? seen.baseRefName.trim() : ''
  if (base === '') {
    const head = await git($, root, ['rev-parse', '--abbrev-ref', 'origin/HEAD'])
    base = head.exitCode === 0 ? head.stdout.trim().replace(/^origin\//, '') : ''
  }
  if (!BRANCH.test(base)) return MSG_MERGE_PROD(undefined)
  const ref = `origin/${base}`
  const listed = await git($, root, ['ls-tree', '--name-only', ref])
  const agents = listed.exitCode !== 0 ? undefined
    : listed.stdout.split('\n').map(l => l.trim()).find(n => n.toLowerCase() === 'agents.md')
  const shown = agents === undefined ? undefined : await git($, root, ['show', `${ref}:${agents}`])
  const line = shown?.exitCode === 0 ? publishesOnMerge(shown.stdout) : undefined
  return line?.value === 'no' ? undefined : MSG_MERGE_PROD(line?.line, ref)
}

// Where a path lands, links followed; for a file not there yet, its folder's
// real path plus its name. undefined when it cannot be placed.
async function placed($: EngineInterface, path: string) {
  const own = await $.fs.stat(path, { resolve: true }).catch(() => undefined)
  if (own !== undefined) return own.realPath
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  if (cut < 0) return undefined
  const dir = await $.fs.stat(path.slice(0, cut + 1), { resolve: true }).catch(() => undefined)
  return dir?.realPath === undefined ? undefined : `${dir.realPath.replace(/[\\/]$/, '')}/${path.slice(cut + 1)}`
}

const namesSkills = (text: string) => NAMES_PROTECTED.test(text)

const shellCommand = (input: unknown) => {
  const command = (input as { command?: unknown } | undefined)?.command
  return typeof command === 'string' ? command : ''
}

export const register: Register = on => {
  // Rule 1: no `gh pr create` while PROGRESS.md (or progress/<task>.md) in HEAD
  // still has work in «Trabajo actual».
  // Rule 2, by the shell: no writing command aimed at Creador's main skills/.
  // Rule 3: only the orchestrator merges a PR, and only where merging does not
  // publish to production.
  on('tool.call', { tool: ['Bash', 'PowerShell'] }, async ($, e, next) => {
    if (e.tool !== 'Bash' && e.tool !== 'PowerShell') return next(e)
    // Rule 4: a command that names a process killer passes only in a clear PID form.
    const kill = findKill(e.command, e.tool)
    if (kill !== undefined) return { deny: kill.kind === 'name' ? MSG_KILL_NAME(kill.why) : kill.kind === 'escape' ? MSG_KILL_ESCAPE(kill.why) : MSG_KILL_UNCLEAR(kill.why) }
    const pr = findPrCreate(e.command)
    // Every command is read for rule 2: a `cd` or the session's folder may
    // put it under skills/ without the word in the text.
    const cwd = await $.session.cwd()
    // Rule 6: no `git worktree remove`, with or without --force, in any folder (before rule 5,
    // so its message wins; when the folder cannot be read, the catch below applies it).
    const removal = findWorktreeRemove(e.command)
    if (removal !== undefined) return { deny: removal.kind === 'remove' ? MSG_WORKTREE_REMOVE(removal.why) : MSG_WORKTREE_UNCLEAR(removal.why) }
    // Rule 7: a push passes only in one of the method's three clear forms, in any folder (after the
    // folder is read, like rule 6: when it cannot be read, the catch below applies it).
    const push = findPush(e.command)
    if (push !== undefined) return { deny: push.kind === 'push' ? MSG_PUSH(push.why) : MSG_PUSH_UNCLEAR(push.why) }
    // Rule 5: in Creador's main folder git changes the checkout only in a clear form.
    const gitMain = findGitMain(e.command, cwd)
    if (gitMain !== undefined) return { deny: gitMain.kind === 'branch' ? MSG_GITMAIN(gitMain.why) : MSG_GITMAIN_UNCLEAR(gitMain.why) }
    if (pr !== undefined) {
      const open = await openWork($, pr.cd === undefined ? cwd : joinPath(cwd, pr.cd))
      if (open !== undefined) return { deny: MSG_PR(open.file, open.heading) }
    }
    const merge = findMerge(e.command)
    if (merge !== undefined) {
      if (!merge.isClear || merge.pr === undefined) return { deny: MSG_MERGE_UNCLEAR(merge.why ?? 'forma no clara') }
      if (await $.env.get('GH_REPO') || await $.env.get('GH_HOST')) return { deny: MSG_MERGE_ENV }
      // The repo and the production line first, then the role: after a compaction the orchestrator's
      // sign may be gone, and where merging publishes the reason to give is the production one
      // (CRE-GRD-FP-1, R3). Cost: a worker's clear `gh pr merge` now also reads git and `gh pr view`.
      const denial = await mergeDenial($, merge.cd === undefined ? cwd : joinPath(cwd, merge.cd), merge.pr)
      if (denial !== undefined) return { deny: denial }
      const messages = await $.session.messages()
      if (!Array.isArray(messages)) throw new Error('session messages unavailable')
      const role = roleOf(messages.filter(m => m.role === 'user').map(m => m.text))
      if (role !== 'orquestador') return { deny: MSG_MERGE_ROLE }
    }
    // A skill link into ~/.claude/skills, in its exact form and in PowerShell
    // only, is the owner's to approve: the tool.check hook below asks him. Git Bash
    // drops unquoted backslashes and rewrites `/c`, so the card would not show
    // what runs there.
    if (e.tool === 'PowerShell' && findLinkCreate(e.command) !== undefined) return next(e)
    const write = findShellWrite(e.command, cwd)
    if (write !== undefined) return { deny: MSG_SKILLS(write) }
    return next(e)
  }).catch(($, e, next) => {
    if (next.called) return next(e)
    const command = 'command' in e && typeof e.command === 'string' ? e.command : ''
    const tool = 'tool' in e && e.tool === 'PowerShell' ? 'PowerShell' : 'Bash'
    try {
      const kill = findKill(command, tool)
      if (kill !== undefined) return { deny: kill.kind === 'name' ? MSG_KILL_NAME(kill.why) : kill.kind === 'escape' ? MSG_KILL_ESCAPE(kill.why) : MSG_KILL_UNCLEAR(kill.why) }
    } catch {
      return { deny: MSG_KILL_UNCLEAR('no pude analizarlo') }
    }
    // Rule 6 before rule 7, in the main handler's order (B5 of round 2).
    try {
      const removal = findWorktreeRemove(command)
      if (removal !== undefined) return { deny: removal.kind === 'remove' ? MSG_WORKTREE_REMOVE(removal.why) : MSG_WORKTREE_UNCLEAR(removal.why) }
    } catch {
      if (namesWorktreeRemove(command)) return { deny: MSG_WORKTREE_UNCLEAR('no pude analizarlo') }
    }
    try {
      const push = findPush(command)
      if (push !== undefined) return { deny: push.kind === 'push' ? MSG_PUSH(push.why) : MSG_PUSH_UNCLEAR(push.why) }
    } catch {
      if (namesPush(command) || namesPush(command.replace(/[\\`]\r?\n/g, ''))) return { deny: MSG_PUSH_UNCLEAR('no pude analizarlo') }
    }
    if (namesGitChange(command)) return { deny: MSG_GITMAIN_UNCLEAR('no pude comprobar la carpeta del comando') }
    if (findMerge(command) !== undefined) return { deny: MSG_MERGE_FAILED }
    return findPrCreate(command) !== undefined || namesSkills(command) ? { deny: MSG_SHELL_FAILED } : next(e)
  })

  // Rule 2's one exception: the skill link the tool.call hook let through asks
  // a person, or is refused when nobody can be asked. A refusal beneath stands.
  on('tool.check', { tool: 'PowerShell' }, async ($, e, next) => {
    if (e.tool !== 'PowerShell') return next(e)
    const verdict = linkVerdict(shellCommand(e.input), e.approver)
    if (verdict === undefined) return next(e)
    const below = await next(e)
    return below.decision === 'deny' ? below : verdict
  }).catch(($, e, next) =>
    findLinkCreate(shellCommand(e.input)) !== undefined ? { decision: 'deny' as const, reason: MSG_LINK_FAILED } : next(e))

  // Rule 2, by the edit tools: no edit under Creador's main skills/, by any
  // spelling or through the ~/.claude/skills links; worktrees pass.
  on('tool.call', { tool: ['Edit', 'Write', 'NotebookEdit'] }, async ($, e, next) => {
    const path = e.tool === 'NotebookEdit' ? e.notebook_path
      : e.tool === 'Edit' || e.tool === 'Write' ? e.file_path : undefined
    if (path === undefined) return next(e)

    const full = joinPath(await $.session.cwd(), path)
    if (isProtected(full)) return { deny: MSG_SKILLS(path) }
    const real = await placed($, full)
    if (real !== undefined && isProtected(real)) return { deny: MSG_SKILLS(path) }
    return next(e)
  }).catch(($, e, next) => {
    if (next.called) return next(e)
    const path = 'file_path' in e ? e.file_path : 'notebook_path' in e ? e.notebook_path : ''
    return typeof path === 'string' && !namesSkills(path) ? next(e) : { deny: MSG_SKILLS_FAILED }
  })
}
