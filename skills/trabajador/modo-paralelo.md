# Modo paralelo

Fase de la skill del trabajador: la lees cuando `SKILL.md` lo pide; las reglas de `SKILL.md` siguen rigiendo.

- Trabaja solo en tu worktree y tu rama `tarea/<id>`; no toques la carpeta principal ni la rama de la otra tarea (excepto la limpieza de cierre que ordene el orquestador, regla 6 de `SKILL.md`). Instala dependencias antes de empezar e informa la ruta de tu worktree.
- Ramas: no hagas `git switch <principal>` ni `git pull`, salvo esa limpieza (la principal está abierta en la carpeta principal). Ejecuta `git fetch origin` y crea tu rama con `git switch -c tarea/<id> origin/<principal>`; si ya existe, comprueba la base con `git merge-base --is-ancestor origin/<principal> HEAD` y, si falla, detente e informa.
- Escribe tu estado en `progress/<id>.md` (mismo formato) en vez de `PROGRESS.md`, que no tocas. Al cerrar, «PROGRESS.md: cerrado» pasa a «`progress/<id>.md`: cerrado».
- Usa el puerto de la orden; corre pruebas pesadas o con servidores solo cuando el orquestador te dé el turno. Nunca hagas `merge` ni `rebase`.
- En modo paralelo no archives filas en `progress/archivo.md`: las de `progress/<id>.md` se consolidan en la tarea de consolidación (ver `templates/paralelo.md`).
