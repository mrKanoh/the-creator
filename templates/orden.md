# Plantilla de orden

Rellena cada sección con lo que el responsable pidió. Omite una sección solo si no aplica. Entrega la orden dentro de un bloque de código. El tamaño sigue `templates/auditoria.md`.

```
Proyecto: <nombre> — <ruta absoluta>
Id: <id corto>
Tamaño: <chica | normal | grande> — <razón en una línea>
Etiqueta antes-de-*: <sí | no>
Tipo de solicitud: <consulta | diagnóstico | auditoría | implementación | deploy | acción destructiva>
Autorizado: <qué puedes hacer; p. ej. "solo leer y reportar", "editar y verificar". En implementación, siempre: "editar, verificar, commit local por etapa en tarea/<nombre>, push de tarea/<nombre> y abrir su PR en borrador (`gh pr create --draft`), borrar tarea/<nombre> y la rama claude/… una vez fusionadas">
No autorizado: <todo lo demás; en consulta, diagnóstico y auditoría incluye editar archivos. Fusionar y marcar el PR como listo (`gh pr ready`): siempre; lo decide el orquestador o el responsable>

Objetivo
<1–3 frases con el resultado esperado, en términos observables.>

Contexto
<Solo lo necesario: síntoma, decisión previa, archivos o páginas implicadas.>

Modo paralelo (solo si aplica)
Puerto: <n>
Archivos de esta tarea: <lista>

Alcance
- Incluye (numerado; el informe y la revisión citan cada requisito por su número):
  R1. <...>
  R2. <...>
- No incluye: <...>

Antes de empezar (preflight; aplica a todos los tipos de solicitud)
1. Lee las instrucciones del proyecto y la documentación relevante (empieza por el índice de docs/ si existe).
2. Ejecuta `git status --short --branch`; trata los cambios existentes como ajenos.
3. Resume en pocas líneas: objetivo, estado encontrado, restricciones y siguiente paso.

Tarea
<Pasos concretos o etapas. Si es grande, divídela en etapas: al terminar y verificar cada una, DETENTE, informa y espera confirmación del orquestador (o del responsable en modo manual) antes de la siguiente.>
<Si el tipo es diagnóstico de un error, el trabajador sigue `C:\repos\creador\templates\diagnostico-error.md`.>
<En implementación: trabaja en la rama `tarea/<nombre>` creada desde la rama principal actualizada (nunca en main); al cerrar cada etapa verificada, haz un commit local solo con sus archivos y actualiza `PROGRESS.md`. Si es el primer trabajo en el proyecto, la etapa 1 es registrar la línea base de pruebas.>

Restricciones
- En implementación, los commits locales por etapa, el push de la rama de la tarea y su PR en borrador están permitidos por defecto. Deploy y operaciones destructivas: solo si el campo "Autorizado" los incluye de forma explícita. Fusionar: nunca el trabajador.
- Nunca commitees `.env`, claves ni secretos.
- Una acción destructiva (borrar, sobrescribir, descartar cambios, limpiar) exige que el responsable confirme el objetivo exacto antes de ejecutarla. `git revert` de tus propios commits en la rama de la tarea no es destructivo: conserva el historial.
- No hagas refactors ni mejoras fuera del alcance.
- <restricciones específicas>

Verificación
Rápidas, en cada etapa (las corre el trabajador): <check, lint, typecheck, `git diff --check`; comandos reales del proyecto, o: "lee los scripts y la documentación del proyecto y elige las que correspondan">.
Lenta, una vez al cierre (la corre el orquestador; el auditor la repite solo con una razón concreta, ver `C:\repos\creador\templates\auditoria.md`): <pruebas completas, build, e2e, servidores; o "no hay">. Excepción: <etapa en que el trabajador corre la lenta porque solo ella comprueba el cambio (p. ej. una migración), o "ninguna">.
<En consulta o auditoría, indica qué evidencia respalda cada afirmación.>

Cierre
Informa: resultado, archivos modificados (si hubo), verificaciones con su resultado real, problemas (separa los preexistentes) y siguiente paso. Si algo no pudo ejecutarse, di por qué.
```
