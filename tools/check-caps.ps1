# Verifica los topes de tamaño de los archivos de Creador. Sale con código 2 si alguno se excede o falta.
# Si Claude Code ya está continuando por un bloqueo anterior de este hook (stop_hook_active), no vuelve a bloquear.
if ([Console]::IsInputRedirected) {
    try {
        $payload = [Console]::In.ReadToEnd()
        if ($payload) {
            $data = $payload | ConvertFrom-Json
            if ($data.stop_hook_active -eq $true) { exit 0 }
        }
    } catch { }
}

$root = Split-Path -Parent $PSScriptRoot
# Dentro de un worktree (<repo>\.claude\worktrees\<nombre>) los enlaces apuntan a la carpeta principal: no se revisan.
$inWorktree = $root -like '*\.claude\worktrees\*'

function Count-Lines($path) {
    return @(Get-Content -LiteralPath $path).Count
}

function Count-Words($path) {
    return @((Get-Content -LiteralPath $path -Raw) -split '\s+' | Where-Object { $_ }).Count
}

$checks = @(
    @{ File = 'CLAUDE.md';            Cap = 150 },
    @{ File = 'global/CLAUDE.md';     Cap = 220 },
    @{ File = 'PROYECTOS.md';         Cap = 100 },
    @{ File = 'templates/orden.md';   Cap = 80 },
    # Skills en núcleo + archivos de fase (CRE-SKL-FASES-1): palabras = tamaño real + ~7-15 %, líneas = 3 a 10 de margen; lo nuevo de una fase va a su archivo, no al núcleo. Todo .md de estas dos carpetas necesita su fila (ver abajo).
    @{ File = 'skills/orquestador/SKILL.md'; Cap = 100; Words = 2300 },
    @{ File = 'skills/orquestador/redactar-orden.md'; Cap = 18; Words = 540 },
    @{ File = 'skills/orquestador/afinar.md'; Cap = 32; Words = 440 },
    @{ File = 'skills/orquestador/revisar-informe.md'; Cap = 14; Words = 310 },
    @{ File = 'skills/orquestador/cerrar.md'; Cap = 17; Words = 1380 },
    @{ File = 'skills/orquestador/cerrar-no.md'; Cap = 10; Words = 215 },
    @{ File = 'skills/orquestador/cerrar-si.md'; Cap = 8; Words = 340 },
    @{ File = 'skills/orquestador/traspaso.md'; Cap = 12; Words = 270 },
    @{ File = 'skills/trabajador/SKILL.md';  Cap = 65; Words = 1300 },
    @{ File = 'skills/trabajador/cerrar-etapa.md'; Cap = 14; Words = 470 },
    @{ File = 'skills/trabajador/formato-progress.md'; Cap = 34; Words = 520 },
    @{ File = 'skills/trabajador/informe.md'; Cap = 22; Words = 205 },
    @{ File = 'skills/trabajador/modo-paralelo.md'; Cap = 15; Words = 200 },
    @{ File = 'templates/orquestador-referencia.md'; Cap = 46 },
    @{ File = 'templates/diagnostico-proyecto.md'; Cap = 100 },
    @{ File = 'templates/checklist-web.md'; Cap = 120 },
    @{ File = 'templates/auditoria.md'; Cap = 60 },
    @{ File = 'templates/paralelo.md'; Cap = 80 },
    @{ File = 'templates/diagnostico-error.md'; Cap = 70 },
    @{ File = 'skills/sin-relleno/SKILL.md'; Cap = 50 },
    @{ File = 'skills/sin-relleno/referencias.md'; Cap = 70 },
    @{ File = 'templates/escribir-para-agentes.md'; Cap = 70 },
    @{ File = 'templates/contenido-web.md'; Cap = 80 }
)

$fail = @()
foreach ($c in $checks) {
    $p = Join-Path $root $c.File
    if (-not (Test-Path -LiteralPath $p)) {
        Write-Output ("  XX  {0}: no existe" -f $c.File)
        $fail += ("{0}: archivo obligatorio ausente" -f $c.File)
        continue
    }
    $n = Count-Lines $p
    $ok = $n -le $c.Cap
    Write-Output ("  {0}  {1}: {2} / {3}" -f $(if ($ok) { 'ok' } else { 'XX' }), $c.File, $n, $c.Cap)
    if (-not $ok) { $fail += ("{0}: {1} líneas, tope {2}" -f $c.File, $n, $c.Cap) }
    if ($c.Words) {
        $w = Count-Words $p
        $okW = $w -le $c.Words
        Write-Output ("  {0}  {1} palabras: {2} / {3}" -f $(if ($okW) { 'ok' } else { 'XX' }), $c.File, $w, $c.Words)
        if (-not $okW) { $fail += ("{0}: {1} palabras, tope {2}" -f $c.File, $w, $c.Words) }
    }
}

# Cada .md de las skills con archivos de fase debe tener su fila de tope arriba.
foreach ($dir in 'skills/orquestador', 'skills/trabajador') {
    foreach ($f in Get-ChildItem -LiteralPath (Join-Path $root $dir) -Filter '*.md' -File -ErrorAction SilentlyContinue) {
        $rel = "$dir/$($f.Name)"
        if (-not ($checks | Where-Object { $_.File -eq $rel })) {
            Write-Output ("  XX  {0}: sin fila de tope en check-caps.ps1" -f $rel)
            $fail += ("{0}: archivo de skill sin fila de tope en check-caps.ps1" -f $rel)
        }
    }
}

$lessons = Join-Path $root 'LESSONS.md'
if (-not (Test-Path -LiteralPath $lessons)) {
    Write-Output "  XX  LESSONS.md: no existe"
    $fail += "LESSONS.md: archivo obligatorio ausente"
} else {
    $n = 0; $inFence = $false
    foreach ($line in Get-Content -LiteralPath $lessons) {
        if ($line -match '^\s*(```|~~~)') { $inFence = -not $inFence; continue }
        if (-not $inFence -and $line -match '^## ') { $n++ }
    }
    $ok = $n -le 30
    Write-Output ("  {0}  LESSONS.md entradas: {1} / 30" -f $(if ($ok) { 'ok' } else { 'XX' }), $n)
    if (-not $ok) { $fail += "LESSONS.md: $n entradas, tope 30" }
}

if ($inWorktree) {
    Write-Output "  --  enlaces: no se revisan en worktree"
} elseif ($env:CI -eq 'true') {
    Write-Output "  --  enlaces: no se revisan en CI"
} else {
# Las skills de Creador son el original; ~/.claude/skills/<nombre> debe ser un enlace (junction) a ellas.
$global = Join-Path $env:USERPROFILE '.claude\skills'
foreach ($s in Get-ChildItem -LiteralPath (Join-Path $root 'skills') -Directory -ErrorAction SilentlyContinue) {
    $link = Join-Path $global $s.Name
    $item = Get-Item -LiteralPath $link -ErrorAction SilentlyContinue
    if (-not $item) {
        Write-Output ("  --  skill {0}: no instalada en ~/.claude/skills" -f $s.Name)
    } elseif ($item.LinkType -eq 'Junction' -and (($item.Target -join '') -eq $s.FullName)) {
        Write-Output ("  ok  skill {0}: enlazada a Creador" -f $s.Name)
    } else {
        Write-Output ("  XX  skill {0}: no es un enlace a Creador" -f $s.Name)
        $fail += ("skill {0}: reemplaza ~/.claude/skills/{0} por un junction a skills/{0}" -f $s.Name)
    }
}

# ~/.claude/CLAUDE.md debe ser un enlace simbólico a global/CLAUDE.md.
$gLink = Join-Path $env:USERPROFILE '.claude\CLAUDE.md'
$gSrc = Join-Path $root 'global\CLAUDE.md'
$gItem = Get-Item -LiteralPath $gLink -ErrorAction SilentlyContinue
if ($gItem -and $gItem.LinkType -eq 'SymbolicLink' -and (($gItem.Target -join '') -eq $gSrc)) {
    Write-Output "  ok  CLAUDE.md global: enlazado a Creador"
} else {
    Write-Output "  XX  CLAUDE.md global: no es un enlace a Creador"
    $fail += "CLAUDE.md global: ~/.claude/CLAUDE.md debe ser un enlace simbólico a global/CLAUDE.md"
}
}

if ($fail.Count -gt 0) {
    [Console]::Error.WriteLine("CHEQUEO FALLIDO:`n  " + ($fail -join "`n  "))
    exit 2
}
