# Cerrar el ciclo, paso 5: fusionar con «no»

Paso 5 de `C:\repos\creador\skills\orquestador\cerrar.md`, que lees solo si el `AGENTS.md` dice `- Fusionar publica en producción: no`.

**«no»:** con la CI en verde (`gh pr checks`; sin checks ni workflow aplicable por sus `paths`, cuenta como verde y el aviso lo dice; si uno debía correr y no corrió, no) y la auditoría aprobada (si correspondía) o «no corrió», fusiona tú con `gh pr merge <número> --merge` (nunca `--admin` ni `--auto`) y sigue al paso 6. Si el PR quedó desactualizado, `gh pr update-branch <número>` y espera la CI.

**Si `guardia` frena con «guardia: solo el orquestador fusiona PR, y esta sesión no lo es»:** su «fusiona el responsable» no aplica aún. En un piloto de Creador no pidas `/orquestador`: fusiona el responsable y el informe lo dice. Si no, pide al responsable escribir `/orquestador reintenta la fusión del PR <número>` y reintenta. Si frena otra vez, fusiona el responsable y el informe lleva el enlace del PR y que `guardia` frenó dos veces. Sin respuesta en el turno, déjalo en el aviso pendiente; sigue solo con una tarea que no dependa de esa fusión (si depende, detente); su orden parte de la principal sin ella y lo dice. Otro mensaje de la regla 3 sigue su propia salida.
