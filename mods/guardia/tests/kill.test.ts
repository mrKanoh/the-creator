import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { findKill, MSG_KILL_NAME, MSG_KILL_UNCLEAR } from '../hooks/rules.ts'

// Rule 4: no closing of processes by name. The commands here are only strings:
// nothing is ever run. «pass» = findKill returns nothing.

type Shell = 'Bash' | 'PowerShell'
const kindOf = (command: string, shell: Shell) => findKill(command, shell)?.kind ?? 'pass'
const BOTH: Shell[] = ['Bash', 'PowerShell']

const stops = (commands: string[], shells: Shell[] = BOTH) => {
  for (const c of commands) for (const shell of shells) expect([c, shell, kindOf(c, shell)]).not.toEqual([c, shell, 'pass'])
}
const passes = (commands: string[], shells: Shell[] = BOTH) => {
  for (const c of commands) for (const shell of shells) expect([c, shell, kindOf(c, shell)]).toEqual([c, shell, 'pass'])
}

// Catches: a form of closing by name that slips through (R1).
test('rule 4: closing by image name is recognized by name, in both shells', () => {
  for (const c of [
    'taskkill /F /IM node.exe', 'taskkill /im node.exe', 'TASKKILL /IM node.exe /T', 'taskkill -im node.exe', 'taskkill.exe /F /IM node.exe',
    'C:\\Windows\\System32\\taskkill.exe /F /IM node.exe', 'taskkill /FI "IMAGENAME eq node.exe"', 'taskkill /IM node.exe /F; echo listo', 'echo a && taskkill /IM node.exe',
    'taskkill //F //IM node.exe', 'taskkill \\/IM node.exe', 'taskkill --im node.exe',
    'Stop-Process -Name node', 'Stop-Process -ProcessName node -Force', 'spps -Name node', 'Stop-Process -n node', 'Stop-Process -Na node', 'Stop-Process -Pr node',
    'Stop-Process -Name:node', 'stop-process -NAME node', 'pkill node', 'pkill -f vite', 'killall node', 'killall -9 node', '/usr/bin/pkill node',
    'echo "$(pkill node)"', 'x="$(pkill node)"',
  ]) for (const shell of BOTH) expect([c, shell, kindOf(c, shell)]).toEqual([c, shell, 'name'])
  for (const c of ['kill -Name node', 'ps node | kill -n node']) expect(kindOf(c, 'PowerShell')).toBe('name')
  expect(findKill('taskkill /F /IM node.exe')?.why).toBe('taskkill /IM')
  expect(findKill('pkill node')?.why).toBe('pkill')
  expect(findKill('Stop-Process -Name node', 'PowerShell')?.why).toBe('Stop-Process -Name')
})

// Catches (audit cases): every one of these must stop.
test('rule 4: the cases of the three audits of CRE-GRD-KILL-1 stop', () => {
  stops([
    '& "C:\\Program Files\\PowerShell\\7\\pwsh.exe" -c "Stop-Process -Name node"', 'p=pkill; ${p} node', 'p=pkill; $p -f node',
    '$v = "taskkill /IM x"; cmd /c $v', 'taskkill //F //IM node.exe', 'Get-Process -Id 1 >$null; Import-Csv x | Stop-Process',
    'Get-Process -Id 5 | Where-Object CPU | Stop-Process', 'Get-Process -Id 5; Get-Date | Stop-Process',
    'Get-Process -Id $PID | Out-Null; Get-CimInstance Win32_Process -Filter "name=\'node.exe\'" | Stop-Process',
    'c="taskkill /IM node.exe"; bash -c "$c"', 'set v=taskkill /IM node.exe& cmd /c %v%', '$s = "Stop-Process -Name node"; pwsh -c $s',
    't=taskkill; $t //F //IM node.exe','$p = "pkill"; & $p node', '$c = "Stop-Process"; & $c -Name node', 'k=killall; "$k" node',
    '$m = rg taskkill; $m', '$m = Select-String taskkill a.md; & $m',
  ])
  // A Get-Process by name hidden behind an assignment, then closed by its PID: not a clear form's business to follow, but it names no killer by itself.
  stops(['$p = Get-Process node; $p.Kill()', 'Get-Process node | % { $_.Kill() }'], ['PowerShell'])
})

// Catches: an interpreter or wrapper that hides the killer from the one-level parse (R1, R2).
test('rule 4: interpreters and wrappers that name a killer stop', () => {
  stops([
    'cmd /c taskkill /IM node.exe', 'cmd /c "taskkill /PID 5"', 'cmd.exe /s /c "taskkill /f /im node.exe"', 'pwsh -Command "Stop-Process -Name node"',
    'powershell -c "taskkill /IM node.exe"', 'bash -c "pkill node"', 'sh -c "killall node"', 'echo node.exe | xargs taskkill /IM', 'xargs taskkill /PID',
    'npx taskkill', 'node -e "require(\'child_process\').exec(\'taskkill /IM node.exe\')"', 'node -e "process.kill(1234)"', 'python -c "import os; os.system(\'pkill node\')"',
    'Start-Process taskkill -ArgumentList "/IM node.exe"', 'Invoke-Expression "taskkill /IM node.exe"', 'iex "taskkill /PID 5"', 'wsl pkill node', 'sudo pkill node', 'nohup pkill node',
    'timeout 5 taskkill /PID 5', 'echo "taskkill /IM node.exe" | cmd', 'echo "taskkill /IM node.exe" | bash', 'bash <<< "taskkill /IM node.exe"',
    "bash <<'EOF'\ntaskkill /IM node.exe\nEOF", "bash <<EOF\ntaskkill /IM node.exe\nEOF", '$c = "taskkill /IM node.exe"; iex $c',
    'echo "taskkill /IM node.exe" | xargs', 'echo taskkill | Invoke-Expression', 'pwsh -c "kill -n node"', 'cmd /c wmic process where name=x delete',
    'echo "x taskkill" > run.bat; node run.js',
  ])
})

// Catches (the escapes probe of LESSONS): quotes, ^, `, %/$, globs, Unicode blanks, separators.
test('rule 4: quotes, escapes, expansions, globs, blanks and separators do not hide a killer', () => {
  stops([
    '"taskkill" /IM node.exe', "'taskkill' /PID 5", '& "taskkill" /IM node.exe', 'task^kill /IM node.exe', 'task"kill" /PID 5', 'taskkil""l /IM node.exe',
    '"Stop-Process" -Id 5', 'task\\kill /PID 5', 'p\\kill node', 'pk"ill" node', "'killall' node", '"C:\\Windows\\System32\\taskkill.exe" /IM node.exe',
    '$x /IM node.exe; taskkill /IM y', '%x% /IM node.exe; pkill y', '& $c /IM node.exe; taskkill /IM x', '${x} -Name node; pkill x', '$(echo taskkill) /IM node.exe',
    'taskkill $args', 'taskkill /F $x', 'taskkill /PID 5 $extra', 'taskkill @params', 'taskkill /PID 5 %x%', 'taskkill /PID 5 $(rm x)',
    'taskk* /IM node.exe', 'tas?kill /PID 5', '[t]askkill /PID 5', 'Stop-Proc* -Id 5', 'pk*ill node', '/d/windows/system32/task* /PID 5', 'Stop-Pro?ess -Id 5', 'pk{i,}ll node', '*kill*',
    'task\u200bkill /PID 5', 'taskkill\u00a0/IM\u00a0node.exe', 'taskkill\u2003/IM node.exe', 'Stop-Process\u00a0-Name\u00a0node',
    'echo a; taskkill /IM node.exe', 'echo a;taskkill /IM node.exe', 'a || taskkill /IM node.exe', 'a | taskkill /IM node.exe', 'a & taskkill /IM node.exe',
    'a && taskkill /IM node.exe', 'a\ntaskkill /IM node.exe', 'a\r\ntaskkill /IM node.exe', '(taskkill /IM node.exe)', '& { Stop-Process -Name node }',
    'if (1) { taskkill /IM node.exe }', 'if true; then taskkill /IM node.exe; fi', 'echo \\"; taskkill /IM node.exe; echo \\"', 'echo "unclosed; taskkill /IM node.exe',
    "echo 'unclosed; pkill node", 'echo "$(taskkill /IM node.exe)"', 'echo "`taskkill /IM node.exe`"', 'echo `pkill node`',
    'Write-Host "a`"; taskkill /IM node.exe; Write-Host "b"', 'Write-Host "$(taskkill /IM node.exe)"', 'Write-Host @(taskkill /IM x)',
  ])
  stops(['Stop-Proc`ess -Name node', 'Stop-Proc`ess -Id 5; kill -n x'], ['PowerShell'])
})

// Catches (CRE-GRD-ROL-1, R4): the real command of a worker of CRE-CIERRE-2 stopped as «no lo entiendo».
// `[$(git branch --show-current)]` read as a glob class holds `w-c` (from `show-current`), a range out
// of order: the class did not compile, and a class that does not compile counted as a killer. A class
// with a range out of order now reads its range both ways; globs that name a killer still stop.
test('rule 4 (R4): a bracket with a range out of order is no killer unless it may name one', () => {
  passes([
    'cd "C:/repos/creador/.claude/worktrees/x" && echo "rama=[$(git branch --show-current)]"; git rev-parse --short HEAD',
    'echo "rama=[$(git branch --show-current)]"',
    'echo "[$(git branch --show-current)]"',
    'printf "%s\\n" "[w-c]"',
    'ls [z-a]*.md',
  ], ['Bash'])
  stops([
    '[z-a]askkill /PID 5', '[u-s]askkill /PID 5', 'pk[z-a]ll node', '[w-c]ill 5', 'killal[z-a] node',
    'Stop-Proc[z-a]ss -Name node', '[t]askkill /PID 5', 'tas[a-z]kill /IM node.exe', 'pk[-i]ll node', 'pk[i-]ll node', 'pk[a-z-]ll node',
    // The two holes the audit of CRE-GRD-FP-2 found (PR #74): a range out of order keeps its other
    // members (`p[kz-a]ill` is `pkill` in Bash and `find`), and a quoted glob is still a pattern there.
    'p[kz-a]ill node', 'taskk[z-a]ll /IM node.exe', 'find . -name "p[kz-a]ill" -exec {} \\;', 'find -name "p[k]ill"',
  ])
  stops(['Get-Command "Stop-Proc*"', '& (Get-Command "p[kz-a]ill") node'], ['PowerShell'])
})

// Catches: a PID form widened beyond the closed list (R2).
test('rule 4: only the exact PID forms pass; whatever else stops', () => {
  stops([
    'taskkill /FI "PID eq 5"', 'taskkill -PID 5', 'taskkill /PID', 'taskkill /PID abc', 'taskkill /PID 5 /IM node.exe', 'taskkill /PID $(pgrep node)', 'taskkill /PID 5; taskkill /IM x',
    'taskkill /PID `pidof node`', 'taskkill /PID $_.Id', 'taskkill /S host /PID 5', 'taskkill /PID "5"', 'taskkill /PID 5 /U x', 'taskkill /?',
    'Stop-Process', 'Stop-Process 1234', 'Stop-Process -InputObject $p', 'spps -Id 5', 'Stop-Process -Id 1,2,3', 'Stop-Process -Id:5', 'Stop-Process -i 5', 'Stop-Process -Id $p.Name',
    'Stop-Process -Id (Get-Process node).Id', 'Stop-Process -Id (Get-NetTCPConnection -LocalPort 4321).OwningProcess; Stop-Process -Name x', 'Stop-Process -Id $_.Id',
    'Get-NetTCPConnection -LocalPort 4321 | Stop-Process', 'Stop-Process -Id (Get-NetTCPConnection -LocalPort $p).OwningProcess',
    'Get-Process node | ForEach-Object { Stop-Process -Id $_.Id }', 'Get-Process node | % { taskkill /PID $_.Id }', 'Get-NetTCPConnection | % { Stop-Process -Id $_.OwningProcess }',
    'Get-NetTCPConnection -LocalPort 3000 | % { Stop-Process -Id $_.Name }', 'Get-NetTCPConnection -LocalPort 3000 | % { Stop-Process -Id $_.Id; Stop-Process -Name x }',
    'Get-Process -Id 1234 | Stop-Process', 'kill 1234', 'kill $pid', 'kill %1', 'kill -9 1234', 'Stop-Process -Id 5 | kill',
  ], ['PowerShell'])
  stops([
    'kill $(lsof -ti:3000)', 'kill `pidof node`', 'kill $(pgrep node)', 'pgrep node | xargs kill', 'lsof -ti:3000 | xargs kill', 'kill', 'kill -l', 'kill %1', 'kill 5; kill $(pgrep x)',
    'kill -9', 'kill -n node', 'kill 5 && pkill x', 'ps aux | grep node | awk \'{print $2}\' | xargs kill -9', 'kill "5"', 'kill 5 > out',
  ], ['Bash'])
  stops(['taskkill /PID 5 /F /IM x', 'taskkill //PID', 'taskkill //F //IM x'], BOTH)
})

// Catches: a clear PID form that is refused (R2). Includes the cases of the order.
test('rule 4: the clear PID forms pass', () => {
  passes([
    'taskkill /PID 1234', 'taskkill /F /PID 1234', 'taskkill /PID 1234 /F /T', 'taskkill /T /F /PID 1234', 'TASKKILL /pid 5 /f', 'taskkill /PID $pid', 'taskkill /PID $p.Id',
    'taskkill /PID $p.OwningProcess /F', 'taskkill /PID $p.PID', 'taskkill /F /PID 999999', 'taskkill //F //PID 1234', 'taskkill //PID 999999', 'taskkill.exe /F /PID 5',
    'taskkill /PID 5 2>&1', 'taskkill /PID 5 >nul 2>&1', 'taskkill /PID 5 && echo listo', 'echo a; taskkill /PID 5; echo b', 'cd D:/x && taskkill /F /PID 5',
  ])
  passes([
    'Stop-Process -Id 1234', 'Stop-Process -Id 1234 -Force', 'Stop-Process -Force -Id 1234', 'Stop-Process -Id $proc', 'Stop-Process -Id $proc.Id', 'Stop-Process -Id $x.OwningProcess',
    'Stop-Process -Id $x.PID -Force', 'Stop-Process -Id (Get-NetTCPConnection -LocalPort 4321).OwningProcess', 'Stop-Process -Id (Get-NetTCPConnection -LocalPort 4321).OwningProcess -Force',
    'Get-NetTCPConnection -LocalPort 3000 | % { Stop-Process -Id $_.OwningProcess -Force }', 'Get-NetTCPConnection -LocalPort 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess }',
    'Get-NetTCPConnection -LocalPort 3000 | % { Stop-Process -Id $_.Id }', '$p = Start-Process node -PassThru; Stop-Process -Id $p.Id',
    '$p = Start-Process node -ArgumentList x -PassThru; Start-Sleep 1; Stop-Process -Id $p.Id -Force', 'Stop-Process -Id 5; Stop-Process -Id 6',
  ], ['PowerShell'])
  passes(['Stop-Process -Id 1234', 'Stop-Process -Id (Get-NetTCPConnection -LocalPort 4321).OwningProcess'], ['Bash'])
  passes([
    'kill 1234', 'kill -9 1234', 'kill -TERM 1234', 'kill -s TERM 1234', 'kill -s KILL $pid', 'kill $pid', 'kill $a $b', 'kill 1 2 3', 'kill -9 $PID', 'kill 5 2>/dev/null', 'kill 999999',
    'node server.js & pid=$!; kill $pid', 'echo hi; kill 5; echo ok',
  ], ['Bash'])
})

// Catches: a text command refused, or a text command that runs its text (R3).
test('rule 4: commands that only mention a killer as text pass', () => {
  passes([
    'echo "taskkill /F /IM node.exe"', 'echo taskkill /IM node.exe', "echo 'Stop-Process -Name node'", 'printf "pkill node\\n"', 'Write-Host "no uses taskkill /IM"', 'Write-Output "killall"',
    'git commit -m "etapa 1: bloquea taskkill /IM y Stop-Process -Name"', 'git commit -m "x" -m "pkill y killall"',
    'gh pr create --title "guardia: regla 4" --body "frena taskkill /IM y pkill" --draft', 'gh pr comment 5 --body "taskkill /IM x"',
    "gh pr create --title t --body \"$(cat <<'EOF'\nFrena `taskkill /F /IM node.exe`, Stop-Process -Name y pkill.\nUsa iex y Invoke-Expression como ejemplo.\nEOF\n)\"",
    "git commit -m \"$(cat <<'EOF'\netapa 1: taskkill /IM, pkill, killall\n\nCo-Authored-By: X <x@y.z>\nEOF\n)\"",
    "git commit -F - <<'EOF'\netapa 1: taskkill /IM \"x\" (y)\nEOF",
    'grep -rn "taskkill" mods/guardia', 'rg "Stop-Process -Name" docs', 'Select-String -Path README.md -Pattern "taskkill"', 'findstr taskkill README.md',
    'git log --grep taskkill --oneline', 'git grep -n "pkill" -- mods', 'git show HEAD:LESSONS.md', 'cat notas.md | grep taskkill', 'git log --oneline | grep pkill | head -3',
    'echo "taskkill" | grep task | wc -l',
  ])
  // Text that is run, or piped into something that runs it, stops.
  stops([
    'echo taskkill | xargs', 'git log --grep taskkill | bash', 'git -c alias.k="!taskkill /IM node.exe" k', "git config alias.k '!pkill node'", "gh alias set k '!pkill node'",
    'git grep -Opkill x', 'rg --pre pkill x', 'echo "taskkill /IM x"; node script.js', 'grep taskkill a.md; python x.py', 'echo "pkill" | sed "s/x/y/e"',
    "awk 'BEGIN{system(\"taskkill /IM node.exe\")}'", "sed 'e taskkill /IM x' f", 'cat taskkill-notes.md', 'rm taskkill.log', 'ls taskkill*', 'node script.js taskkill',
    'echo $(taskkill /IM x)', 'git commit -m "$(taskkill /IM x)"', 'git commit -m "`pkill x`"', "gh pr create --body \"$(pkill node)\"",
  ])
})

// Catches (found while writing the battery): variables, operators and tests that name no killer are no business of the rule.
test('rule 4: variables, operators and tests pass when no killer is named', () => {
  passes([
    '$p = Start-Process node -PassThru', 'if (-not (Test-Path p)) { New-Item -ItemType File p }', 'while (-not $x) {}', '$ok = (-not $fail)', 'Get-ChildItem | Where-Object { -not $_.PSIsContainer }',
    'if ($a -ne 1) { echo x }', '& $python -m pytest -p no:cacheprovider', '$EDITOR -n file', '& $node -p "1+1"', '$p -f node', 'x=5; $x', 'Get-Process', 'Get-Process node | Select-Object Id',
  ], ['PowerShell'])
  passes(['[ -f package.json ] && npm test', '[[ -d node_modules ]] || npm ci', 'if [ -n "$x" ]; then echo a; fi', 'test -f x && ls', 'ls *.md', 'rm -f tmp?.txt', 'ls src/*.ts', 'git add -A', 'rm -rf st*', 'ls sto*'], ['Bash'])
  passes(['$p = Start-Process node -PassThru; Stop-Process -Id $p.Id', 'foreach ($i in 1..3) { Write-Host $i }'], ['PowerShell'])
  // A variable as the command, in a command that names a killer somewhere, stops.
  stops(['$c = 5; $c; echo "pkill"', '$x = 1; & $x; Write-Host "taskkill"'], ['PowerShell'])
  stops(['k=5; $k; echo taskkill'], ['Bash'])
})

// Catches (review of stage 1): `kill` counts only as a command, not as an argument or part of another word.
test('rule 4: kill is a command only first in a segment or after a wrapper', () => {
  passes(['docker kill web', 'tmux kill-session -t a', 'npx kill-port 3000', 'git branch fix/kill', 'npm run kill', 'echo kill'])
  stops(['kill $(pgrep node)', 'xargs kill', 'sudo kill 5', 'p=pkill; $p node', 'env kill 5', 'FOO=1 kill 5', 'time kill 5', 'find . -exec kill 5 ;', 'xargs -I{} kill {}',
    'pwsh -c "kill -n node"', 'echo 5 | xargs kill -9'])
  stops(['Stop-Process -Id 5 | kill', 'ps node | kill'], ['PowerShell'])
})

// Catches (audit of PR 53, finding 1): Bash control words put `kill` in command position, and there only the clear form... never passes unmarked.
test('rule 4: kill after a Bash control word is a command', () => {
  stops([
    'for pid in $(pgrep -f vite); do kill $pid; done', 'if kill -9 $p; then :; fi', 'while kill $p; do :; done', '! kill $p', 'builtin kill $p',
    'if true; then kill $p; fi', 'if x; then :; else kill $p; fi', 'if a; then :; elif kill $p; then :; fi', 'until kill $p; do :; done', 'command kill $p',
    'if x; then kill $(pgrep node); fi', 'time kill $p', 'if x\nthen kill $p\nfi',
  ], ['Bash'])
  passes(['git branch then kill', 'docker kill do', 'npm run do', 'git log --oneline then'])
})

// Catches (audit of PR 53, finding 2): a `<<'X'` inside quotes is text, not a here-document that hides the next line.
test('rule 4: a quoted here-document marker hides nothing', () => {
  stops(["echo \"<<'X'\"\npkill node\nX", "echo '<<\"X\"'\ntaskkill /IM x\nX", "echo \"a <<'X' b\"\ntaskkill /IM node.exe\nX"])
  passes(["git commit -F - <<'EOF'\nuna linea con taskkill /IM\nEOF"])
})

// Catches (audit of PR 53, finding 3): text written to a file or piped to tee is no harmless text.
test('rule 4: text that is redirected or piped to tee is checked as a command', () => {
  stops([
    'echo "pkill node" > k.sh && chmod +x k.sh && ./k.sh', 'echo "taskkill /IM x" >> k.bat', 'echo pkill node | tee k.sh', 'printf "pkill x" > k.sh',
    'echo "taskkill /IM x" 1> k.bat', 'echo pkill node | tee -a k.sh', 'grep taskkill a.md > o.txt',
  ])
  stops(['Write-Host "taskkill /IM x" > k.ps1', 'Write-Output "Stop-Process -Name x" | Out-File k.ps1', 'Write-Output "pkill" | Set-Content k.ps1'], ['PowerShell'])
  passes(['echo "taskkill" > /dev/null', 'grep taskkill a.md 2>&1', 'grep taskkill a.md 2>/dev/null', 'echo "a -> b taskkill"', 'git log --oneline 2>&1 | grep taskkill'])
})

// Catches (audit of PR 53, finding 4): PowerShell members and aliases that call Kill without parentheses.
test('rule 4: PowerShell Kill without parentheses is a close', () => {
  stops([
    'Get-Process node | % Kill', 'Get-Process node | ForEach-Object Kill', 'Get-Process node | ForEach-Object -MemberName Kill', 'Get-Process node | % -MemberName:Kill',
    '$p.Kill.Invoke()', '$p.Kill', '(Get-Process node).Kill', 'Get-Process node | foreach kill', '$p.kill;',
  ], ['PowerShell'])
  passes(['git branch -d fix-kill', 'Get-Content notas.kill.md', 'Get-Process node | % Id'], ['PowerShell'])
})

// Catches (audit of PR 53, finding 5): line continuations join words, and ANSI-C or \u{} escapes fail closed.
test('rule 4: continuations are joined and escape syntaxes that build a name fail closed', () => {
  stops(['task\\\nkill /IM node.exe', 'pk\\\nill node', 'task\\\r\nkill /IM x'], ['Bash'])
  stops(['task`\nkill /IM node.exe', 'Stop-Pro`\ncess -Name node'], ['PowerShell'])
  // A joined clear form is still a clear form.
  passes(['task\\\nkill /PID 5'], ['Bash'])
  for (const c of ["$'\\x74askkill' /IM node.exe", "$'\\164askkill' /PID 5", "echo $'\\x41'", "$'\\u0074askkill' /IM x", "x=$'\\x70kill'; $x node"]) {
    expect([c, kindOf(c, 'Bash')]).toEqual([c, 'escape'])
  }
  for (const c of ['"`u{74}askkill" /IM node.exe', 'echo "`u{41}"']) expect([c, kindOf(c, 'PowerShell')]).toEqual([c, 'escape'])
  passes(["echo $'a\\nb'", "git commit -m $'x\\ty'", "git commit -F - <<'EOF'\n$'\\x41' en el mensaje\nEOF"], ['Bash'])
  passes(['Write-Host "a`nb"'], ['PowerShell'])
})

// Catches (audit of PR 53, finding 7): `terminate` alone is a common word; only wmic's `call terminate` and CIM's Terminate method close.
test('rule 4: terminate counts only as wmic call terminate or the CIM Terminate method', () => {
  passes(['pytest -k terminate', 'aws ec2 terminate-instances --instance-ids i-1', 'npm run terminate', 'git log --grep terminate'])
  stops(['wmic process where name="x" call terminate', 'wmic process where name=x call Terminate'])
  stops(['Invoke-CimMethod -InputObject $p -MethodName Terminate', 'Get-CimInstance Win32_Process | Invoke-CimMethod -MethodName:Terminate', 'Invoke-CimMethod $p -Method Terminate'], ['PowerShell'])
})

// Documented in the README (audit of PR 53, findings 6, 8 and 9): what passes today, so a change is noticed.
test('rule 4: the documented limits and the documented passes', () => {
  // Known limits: the PID comes from a variable, or `kill 0` (the process group); the rule does not follow values.
  passes(['pids=$(pgrep node); kill $pids', 'x="1 //IM node.exe"; taskkill //PID $x', 'kill 0'], ['Bash'])
  passes(['x="1 //IM node.exe"; taskkill //PID $x'], ['PowerShell'])
  // Pass by design: text commands (egrep, fgrep, git commit with any argument) and kill with a signal and PIDs.
  passes(['egrep taskkill a.md', 'fgrep pkill a.md', 'git commit -m "x" --amend --no-verify', 'git commit -a -m "taskkill /IM"'])
  passes(['kill -HUP 5', 'kill -INT $p', 'kill -KILL 5', 'kill -15 5', 'kill -s HUP 5'], ['Bash'])
})

// Catches (second audit of PR 53, A1): a `{` glued to %, foreach or foreach-object is a block, so `kill` inside it is a command.
test('rule 4 (A1): braces glued to %, foreach and foreach-object open a block', () => {
  stops([
    'gps node|%{kill $_.id}', 'Get-Process node|foreach{kill $_.Id}', 'Get-Process node|foreach-object{kill $_.Id}', '(Get-Process node).Id|%{kill $_}',
    'gps node |% {kill $_}', 'gps node|%{ kill $_.id }', 'gps node | ForEach-Object{kill $_}', 'gps node | % {kill $_.Id}',
  ], ['PowerShell'])
  passes(['gps node|%{$_.Id}', '1..3|%{$_*2}', 'Get-ChildItem|foreach{$_.Name}', '@{a=1;b=2}', 'echo ${p}'], ['PowerShell'])
})

// Catches (second audit, M1): a here-document with an empty body ends at its first delimiter line.
test('rule 4 (M1): an empty here-document hides nothing after it', () => {
  stops([
    "git commit -F - <<'X'\nX\npkill node\nX", "echo hi <<'X'\nX\npkill node\nX", "cat <<'X'\nX\nkill $(pgrep node)\nX", "cat <<'X'\nX\ntaskkill /IM node.exe\nX",
    "gh pr create --body \"$(cat <<'X'\nX\n)\"; pkill node",
  ], ['Bash'])
  passes(["git commit -F - <<'X'\nX"], ['Bash'])
})

// Catches (second audit, M4): a backslash inside the word `kill` is only an escape.
test('rule 4 (M4): backslashes inside kill do not hide it, Windows paths still read as paths', () => {
  stops(['k\\ill $(pgrep node)', 'ki\\ll -9 $(pidof node)', 'C:\\x\\kill.exe $(pgrep node)', 'sudo k\\ill 5'], ['Bash'])
  passes(['git add C:\\x\\kill.exe'], ['Bash'])
})

// Catches (second audit, M5): a filter or a redirection that writes the text to a file; `&>` and `>&` do not cut the segment.
test('rule 4 (M5): a writing filter or redirection makes the text a command', () => {
  stops([
    'echo pkill node | cat > k.sh', 'echo pkill node | tail -n1 >> ~/.bashrc', 'echo pkill node | sort -o k.sh', 'echo pkill node | tr a a > k.sh', 'echo pkill node &>k.sh',
    'echo pkill node >&k.sh', 'echo pkill node &>>k.sh', 'echo pkill node | sort --output=k.sh', 'echo pkill node | sort -ok.sh',
  ])
  passes(['echo "taskkill" | sort', 'echo taskkill | head -1 2>&1', 'echo taskkill &>/dev/null'])
})

// Catches (second audit, M6): WMI/CIM Terminate as a member, an alias target or a method name.
test('rule 4 (M6): Terminate as a member or a ForEach-Object target is a close', () => {
  stops([
    '(gwmi win32_process -f "name=\'node.exe\'").Terminate()', 'gwmi win32_process | % Terminate', 'gwmi win32_process | ForEach-Object Terminate', 'Invoke-WmiMethod -Name Terminate',
    '$p.Terminate.Invoke()', 'gwmi win32_process | % -MemberName Terminate', '$p.Terminate',
  ], ['PowerShell'])
  passes(['pytest -k terminate', 'aws ec2 terminate-instances --instance-ids i-1', 'git log --grep terminate'])
})

// Documented in the README, «Regla 4, lo que no ve» (second audit M2, M3, B1, B2): they pass today, so a change is noticed.
test('rule 4: what it does not see, second audit', () => {
  // M3: wrappers outside the closed list put kill in an argument position.
  passes([
    'setsid kill $(pgrep node)', 'strace kill $(pgrep node)', 'flock x kill $(pgrep node)', 'ionice kill $(pgrep node)', 'winpty kill $(pgrep node)', 'chrt 1 kill $(pgrep node)',
    'coproc kill $(pgrep node)', 'trap "kill $(pgrep node)" EXIT',
  ], ['Bash'])
  // M2: a here-document handed to an interpreter stops (the runner reads the body); a body written to a file and run later passes
  // when it holds only `kill` (a name like pkill in it stops).
  stops(["bash <<'X'\nkill $(pgrep node)\nX", "sh <<'X'\npkill node\nX", "cat > k.sh <<'X'\npkill node\nX\nbash k.sh"], ['Bash'])
  passes(["cat > k.sh <<'X'\nkill $(pgrep node)\nX\nbash k.sh"], ['Bash'])
  // B1: tools that close by name without the word kill.
  passes(['fkill node', 'npx fkill-cli node'])
  // B2: PowerShell reflection.
  passes(['$m = "Kill"; (Get-Process node).$m()', '(Get-Process node).psobject.methods["Kill"].Invoke()'], ['PowerShell'])
  // `GetMethod("Kill")` stops only by accident: the `(` leaves "Kill" alone in a segment, where it reads as the command.
  stops(['(Get-Process node).GetType().GetMethod("Kill").Invoke($p, $null)'], ['PowerShell'])
})

// Accepted false positives (documented in the README): the name is in the command and it is no clear form.
test('rule 4: accepted false positives stop, and the holes of a name-based parse are the known ones', () => {
  stops(['cd wmic/', 'cat taskkill.log', 'wmic process get name', 'lsof -ti:3000 | xargs kill', 'Get-CimInstance Win32_Process | Select ProcessId; wmic os get caption'])
  // Known limits: no killer is named in the text, so nothing is seen.
  passes(['$t //IM node.exe', '$p -f node', '$(echo pk)ill node', 'iex ("task"+"kill /IM node.exe")', 'powershell -enc dABhAHMAawBrAGkAbABsAA=='])
})

// Catches (CRE-GRD-FP-1, R1): a read-only `python -c` one-liner that closes nothing was stopped as a
// close by name. Two causes: the bare word `kill` as data in the code (`'kill' in line`), and a Windows
// path such as `...\tmp\skills\...` or `...\app\skills\...`, whose backslash is taken out and fuses
// `p`/`t` + `skills` into the tool names `pskill`/`tskill`.
test('rule 4: read-only python one-liners pass (kill as data, a path that fuses into tskill/pskill)', () => {
  passes([
    `python -c "import json;print(len(json.load(open('a.json'))))"`,
    `python -c "import sys;print(sum(1 for _ in sys.stdin))"`,
    `gh pr view 5 --json files | python -c "import sys,json;print(len(json.load(sys.stdin)['files']))"`,
    `cat x.json | python -c "import sys;print(len(sys.stdin.read().splitlines()))"`,
    `python3 -c "import os;print(os.path.abspath('mods/guardia'))" 2>&1`,
    // the word `kill` only as data
    `python -c "print(open('LESSONS.md').read().count('kill'))"`,
    `python -c "import json;d=json.load(open('a.json'));print(d.get('kill', 0))"`,
    `git log --oneline | python -c "import sys;print(sum(1 for l in sys.stdin if 'kill' in l))"`,
    `py -c "import re,sys;print(len(re.findall('kill', sys.stdin.read())))"`,
    `python -I -c "from os.path import basename;print(basename('x/kill.md'))"`,
    // a Windows path whose backslashes fuse a word ending in p or t with `skills`
    `python -c "print(open(r'C:\\repos\\tmp\\skills\\a.md').read())"`,
    `python -c "print(open(r'C:\\repos\\app\\skills\\a.md').read())"`,
    `cat C:\\repos\\tmp\\skills\\a.md`,
    `Get-Content C:\\repos\\root\\skills\\a.md`,
  ])
})

// Catches (CRE-GRD-FP-1, R1): the relaxation above must not let a python one-liner close processes by name.
test('rule 4: python one-liners that close processes keep stopping', () => {
  stops([
    `python -c "import os;os.kill(1234, 9)"`,
    `python -c "import psutil;[p.kill() for p in psutil.process_iter()]"`,
    `python -c "import psutil;psutil.Process(1).terminate()"`,
    `python -c "import subprocess;subprocess.run(['taskkill','/IM','node.exe'])"`,
    `python -c "import subprocess;subprocess.run(['pkill','node'])"`,
    `python -c "import os;os.system('taskkill /IM node.exe /F')"`,
    `python -c "import os;os.system('kill $(pgrep node)')"`,
    `python -c "import subprocess;subprocess.run(['kill','-9','5'])"`,
    `python -c "from os import kill;kill(1,9)"`,
    `python -c "__import__('os').kill(1,9)"`,
    `python -c "import operator,os;operator.attrgetter('kill')(os)(1,9)"`,
    `python -c "import pathlib;pathlib.os.system('kill 5')"`,
    // ronda 1 (CRE-GRD-FP-1): string.Formatter().get_field resolves an attribute from text
    `python -c "import string,os;k='kill';string.Formatter().get_field('0.'+k,[os],{})[0](1,9)"`,
    `python -c "import os;from collections import _operator as o;o.attrgetter('kill')(os)(1,9)"`,
    `python -c "from sys import modules;modules['os'].popen('kill 5')"`,
    `python -c "import psutil;print(psutil.pids())" && python -c "import os;os.kill(1,9)"`,
    `python -c "print(1)"; pkill node`,
    `python -c "print(1)"; taskkill /IM node.exe`,
    `python -c "print('kill')" | bash`,
    `python -c "print('kill')" | xargs`,
    `python -c "print(1)" $(pkill node)`,
    `python -c "print('$x kill')"`,
    `python -c "print('kill')" > out.py`,
    `pskill node`, `tskill node`, `pskill64 node`, `ps\\kill node`, `p\\skill node`, `pskill.exe node`,
  ], ['Bash'])
  stops([
    `python -c "import os;os.kill(1234, 9)"`, `python -c "import subprocess;subprocess.run(['taskkill','/IM','node.exe'])"`,
    `python -c "from os import kill;kill(1,9)"`, `pskill node`, `tskill node`, `pskill64 node`, `pskill.exe node`,
  ], ['PowerShell'])
})

// Catches: a common development command that the rule blocks for no reason.
test('rule 4: common development commands name no killer and pass', () => {
  passes([
    'npm test', 'npm run build', 'npm install', 'npx playwright test', 'node --experimental-strip-types mods/guardia/tests/rol-skills-reales.mjs', 'claude plugin validate mods/guardia',
    'claude plugin test mods/guardia', 'git status --short --branch', 'git diff --check', 'git add LESSONS.md PROGRESS.md', 'git commit -m "etapa 1: x"', 'git push -u origin tarea/cre-grd-kill-2',
    'git switch -c tarea/cre-grd-kill-2 origin/main', 'git log --oneline -n 5', 'git branch -d tarea/cre-grd-kill-2', 'gh pr create --draft --title t --body b', 'gh pr view 5 --json url',
    'pwsh -File tools/check-caps.ps1', 'ls -la', 'cat README.md', 'mkdir -p out', 'python -m pytest', 'cargo build --release', 'tsc --noEmit', 'curl -s https://example.com',
    'Get-ChildItem -Recurse -Filter *.ts', 'Get-Content README.md', 'Set-Location C:\\repos\\x; git status', 'Get-NetTCPConnection -LocalPort 3000', 'tasklist', 'ps aux', 'pgrep node',
    'netstat -ano | findstr :3000', 'lsof -ti:3000', 'sleep 1', 'echo listo', 'cd D:/x && npm test', 'docker compose up -d', 'rm -rf node_modules', 'Remove-Item -Recurse -Force out',
  ])
})

test('rule 4: the messages say the rule, the PID way and where the rule is written', () => {
  const name = MSG_KILL_NAME(findKill('taskkill /F /IM node.exe')?.why ?? '')
  for (const part of ['no cierres procesos por nombre', 'otros chats y proyectos', 'PID propio', 'Stop-Process -Id (Get-NetTCPConnection -LocalPort <puerto>).OwningProcess', 'global/CLAUDE.md']) {
    expect(name).toContain(part)
  }
  const unclear = MSG_KILL_UNCLEAR('x')
  for (const part of ['no lo entiendo con certeza', 'PID propio', 'Stop-Process -Id (Get-NetTCPConnection -LocalPort <puerto>).OwningProcess', 'taskkill /PID <pid>', 'kill [-9] <pid|$var>', 'global/CLAUDE.md']) {
    expect(unclear).toContain(part)
  }
})

const refusal = (r: { deny?: string; isError?: true; text?: string }) => r.deny ?? (r.isError === true ? r.text : undefined)

function setup(on: On) {
  let ran = 0
  on('session.cwd', () => ({ value: 'C:/repos/otro' }))
  on('tool.call', () => {
    ran++
    return { result: {} }
  })
  return () => ran
}

test('rule 4: the hook stops closing by name in Bash and PowerShell, in every project, and lets PID closes pass', async ($, on) => {
  const ran = setup(on)
  for (const tool of ['Bash', 'PowerShell'] as const) {
    expect(refusal(await $.tool.call({ tool, command: 'taskkill /F /IM node.exe' }))).toContain('no cierres procesos por nombre')
    expect(refusal(await $.tool.call({ tool, command: 'Get-Process node | Stop-Process' }))).toContain('no lo entiendo con certeza')
    expect(refusal(await $.tool.call({ tool, command: 'Stop-Process -Name node' }))).toContain('PID propio')
    expect(refusal(await $.tool.call({ tool, command: 'p=pkill; ${p} node' }))).toContain('global/CLAUDE.md')
  }
  expect(ran()).toBe(0)
  for (const tool of ['Bash', 'PowerShell'] as const) {
    expect(refusal(await $.tool.call({ tool, command: 'taskkill /PID 999999 /F' }))).toBeUndefined()
    expect(refusal(await $.tool.call({ tool, command: 'echo "taskkill /IM node.exe"' }))).toBeUndefined()
  }
  expect(refusal(await $.tool.call({ tool: 'PowerShell', command: 'Stop-Process -Id (Get-NetTCPConnection -LocalPort 4321).OwningProcess' }))).toBeUndefined()
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'kill 999999' }))).toBeUndefined()
  expect(ran()).toBe(6)
  // `kill` is Stop-Process in PowerShell: only Bash has the clear form.
  expect(refusal(await $.tool.call({ tool: 'PowerShell', command: 'kill 999999' }))).toContain('no lo entiendo con certeza')
})
