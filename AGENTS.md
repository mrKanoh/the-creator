# Creador — reglas comunes para cualquier agente

- **Ruta:** `C:\repos\creador`. Remote: `origin` → `https://github.com/mrKanoh/the-creator.git`.
- **Qué es:** el método de trabajo del responsable: skills `/orquestador` y `/trabajador`, plantillas, lecciones y mods de Claude Code. Lo que se edita aquí rige en todos los proyectos. Este repo **no ejecuta** el trabajo de otros proyectos ni los edita.

## Cómo verificar

- Topes de tamaño: la única fuente es `pwsh -File tools/check-caps.ps1`; corre como hook al terminar cada turno.
- Pruebas de un mod: `claude plugin test mods/guardia` y `claude plugin test mods/tablero` (comando documentado en cada `README.md`).
- CI: `.github/workflows/ci.yml` corre en cada PR y en cada push a `main`, en `windows-latest`, los topes de tamaño, las pruebas de `guardia` y `tablero` (CLI fijada en 2.1.304, sin secretos) y las pruebas y el ensayo de la copia pública. Con `CI=true`, `check-caps.ps1` no revisa los enlaces de `~/.claude`.
- Copia pública: `node --test tools/copia-publica/copia.test.mjs` y el ensayo `node tools/copia-publica/armar.mjs --ensayo`, que arma la foto en una carpeta temporal y debe terminar con 0 hallazgos (salida 0; 1 con hallazgos; 2 con `privado.json` ausente, roto o vacío). No publica nada.
- Antes de cerrar, revisa `git diff --check` y `git status --short --branch`.

## Qué publica y qué no tocar

- Fusionar publica en producción: sí. Nada se despliega, pero lo fusionado en `main` rige de inmediato por los enlaces de `~/.claude/skills` y por la instalación de los mods; por eso fusiona el responsable.
- Copia pública: cada push a `main` corre `.github/workflows/copia-publica.yml`, que publica en `mrKanoh/the-creator` (público) una foto saneada, sin historial (push forzado de un commit sin padres), con `PUBLIC_COPY_TOKEN`. Excluye `PROYECTOS.md`, `global/`, `PROGRESS.md`, `progress/`, `LESSONS.md`, `DECISIONS.md`, `.claude/`, `.github/` y `tools/copia-publica/`; si la comprobación halla un dato privado, no publica. Un cliente, proyecto o dato privado nuevo va a `tools/copia-publica/privado.json` (reemplazo y bloqueo) antes de fusionar.
- `global/CLAUDE.md` solo con pedido explícito del responsable; `templates/` solo si el responsable lo pide.
- Todo trabajo con rama (`skills/`, `mods/`, `templates/` u otro): solo en un worktree, nunca en la carpeta principal; la regla 5 de `guardia` lo hace cumplir (ver `CLAUDE.md`, «Memoria del repo»). `skills/`: no mover ni borrar `skills/` sin recrear los enlaces.

## Git

- Rama de trabajo actual. Commits, push de `tarea/*` y su PR: con una orden de implementación (ahí van autorizados por defecto) o con petición explícita del responsable.
