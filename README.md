<p align="center"><img src="assets/logo.png" alt="Logo de Creador" width="200"></p>

# Creador

Creador es un método para trabajar con Claude Code en varios proyectos a la vez. Reparte cada tarea entre dos chats con roles fijos, deja el estado escrito en el repositorio y frena con dos mods los errores que ya se repitieron.

Contiene:

- `skills/`: los roles `/orquestador` y `/trabajador`, más `/sin-relleno` (quita marcas de escritura de IA de un texto en español).
- `templates/`: la orden, la auditoría, el modo paralelo, el handoff, los diagnósticos y las listas de revisión web.
- `mods/`: los mods de Claude Code `guardia` y `tablero`, con su marketplace local.
- `tools/check-caps.ps1`: los topes de tamaño de skills y plantillas.

La copia pública del método, `mrKanoh/the-creator`, se publica sin los archivos de estado del repositorio original (`PROGRESS.md`, `LESSONS.md`, `DECISIONS.md`, `PROYECTOS.md`) ni datos de sus proyectos.

## Roles

- **Orquestador.** Recibe la tarea, redacta la orden, lanza al trabajador, revisa cada etapa y decide. No edita archivos.
- **Trabajador.** Implementa la orden en su propia rama `tarea/<id>`, por etapas, con un commit local por etapa verificada. Se detiene al cerrar cada etapa y espera la revisión.
- **Auditor.** Un subagente que el orquestador lanza en tareas normales y grandes. Revisa el trabajo sin haber visto el razonamiento de los otros dos. `templates/auditoria.md` fija su modelo según el tamaño de la tarea; en las tareas chicas no hay auditor.

Una persona responsable decide lo que el método no delega: el alcance, las acciones destructivas, los secretos y la fusión donde fusionar publica en producción.

## Flujo de una tarea

1. La idea se vuelve una orden con `templates/orden.md`: tipo de solicitud, qué está autorizado, alcance, verificación y cierre esperado. Si la idea es grande o difusa, el orquestador la afina antes con rondas de preguntas.
2. El orquestador lanza al trabajador, de preferencia en un worktree propio. En una tarea grande, el trabajador entrega primero un plan y espera la aprobación.
3. El trabajador avanza etapa por etapa. En cada una corre las verificaciones rápidas (topes, lint, pruebas focalizadas), hace su commit y escribe un informe con formato fijo.
4. El orquestador revisa cada informe y responde con un veredicto: `APROBABLE`, `REQUIERE CORRECCIÓN` o `BLOQUEADO`.
5. Al cierre, el orquestador corre la suite lenta una sola vez y, según el tamaño, lanza al auditor.
6. El trabajador sube su rama y abre el PR en borrador. Lo fusiona el orquestador solo si la CI está en verde, la auditoría aprobó y el `AGENTS.md` del proyecto dice `- Fusionar publica en producción: no`; si no, fusiona la persona responsable.

El estado que debe sobrevivir entre chats vive en el repositorio de cada proyecto: `PROGRESS.md` (trabajo actual, pendientes y terminados, con el formato de `skills/trabajador/formato-progress.md`), `DECISIONS.md` (qué se decidió y por qué) y `LESSONS.md` (qué salió mal y cómo se previene).

## Mods

- **`guardia`** frena con un hook siete errores del método: abrir un PR con trabajo abierto en `PROGRESS.md`, editar `skills/` o `mods/` en la carpeta principal del método, fusionar un PR sin ser el orquestador o donde fusionar publica en producción, cerrar procesos por nombre en vez de por PID, cambiar la rama de la carpeta principal, quitar un worktree y hacer un push fuera de las tres formas del método. Detalle en `mods/guardia/README.md`.
- **`tablero`** muestra junto al chat un panel de solo lectura con el estado del proyecto abierto, leído de `PROGRESS.md`: lo que está en curso, lo que espera a la persona responsable, los pendientes y lo terminado. Avisa si el archivo pasa sus topes o rompe el formato. Detalle en `mods/tablero/README.md`.

## Instalarlo en otro equipo

Requisitos: Claude Code, Git y PowerShell 7 (`pwsh`) para `tools/check-caps.ps1`. Los mods están pensados para Windows.

1. Clona este repositorio en `C:\repos\creador`. Las skills, las plantillas y `guardia` nombran la carpeta del método por su ruta absoluta; si lo clonas en otra carpeta, reemplaza `C:\repos\creador` por tu ruta en todo el repositorio.
2. Enlaza cada skill en `~/.claude/skills` con una junction, para que editar el repositorio actualice todos los proyectos. En PowerShell:

   ```powershell
   New-Item -ItemType Junction -Path "$HOME\.claude\skills\orquestador" -Target "C:\repos\creador\skills\orquestador"
   ```

   Repite con `trabajador` y `sin-relleno`.
3. Instala los mods desde el marketplace local:

   ```powershell
   claude plugin marketplace add C:\repos\creador\mods
   ```

   ```powershell
   claude plugin install guardia@creador
   ```

   ```powershell
   claude plugin install tablero@creador
   ```

4. Las reglas globales que el método supone (español neutro, cuándo pedir confirmación, cómo cerrar procesos) viven en un `~/.claude/CLAUDE.md` propio de cada persona y no vienen en este repositorio. Escribe el tuyo.

## Usarlo en un proyecto

1. En el proyecto, crea un `AGENTS.md` con la ruta del repositorio, cómo verificar, qué no tocar y la línea exacta `- Fusionar publica en producción: sí` o `no`. Su `CLAUDE.md` lo importa con `@AGENTS.md`.
2. Abre un chat de Claude Code en el proyecto, escribe `/orquestador` y dale la tarea. El orquestador lanza al trabajador en otro chat, que empieza con `/trabajador`.

## Verificar el método

- Pruebas de un mod: `claude plugin test mods/guardia` y `claude plugin test mods/tablero`.
- Topes de tamaño: `pwsh -File tools/check-caps.ps1`. También cuenta líneas de `PROYECTOS.md` y entradas de `LESSONS.md`, archivos de estado que no vienen en la copia pública: ahí termina con código 2 hasta que los crees o quites sus líneas del script.

## Copia pública

Cada fusión en `main` del repositorio original publica, además, la copia pública `mrKanoh/the-creator`: una foto saneada de `main`, sin historial, que reemplaza a la anterior. El workflow `copia-publica.yml` la arma con `tools/copia-publica/armar.mjs`, que deja fuera los archivos de estado, la CI y su propia carpeta, cambia las rutas locales por `C:\repos\creador` y los nombres de proyectos por genéricos. Si la comprobación encuentra un dato privado, no publica. Esa carpeta y el workflow no vienen en la copia.

En el repositorio original, verifícalo en local sin publicar:

```powershell
node --test tools/copia-publica/copia.test.mjs
```

```powershell
node tools/copia-publica/armar.mjs --ensayo
```

El ensayo lista los archivos de la foto y debe terminar con 0 hallazgos.

## Licencia

MIT. Ver `LICENSE`.
