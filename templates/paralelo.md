# Modo paralelo (hasta 2 trabajadores a la vez)

Lo usa `/orquestador`. Léelo antes de lanzar dos tareas a la vez en el mismo proyecto. Cada trabajador tiene su propia copia aislada (worktree) y su propia rama, así no se pisan.

## 1. Cuándo se permite

Solo si las tareas son **independientes**. Antes de lanzar, lista los archivos que cada tarea tocará.
- Si comparten alguno, van **en secuencia**, no en paralelo. Cuentan como compartidos: `package.json`, lockfiles, configuración global, estilos y componentes comunes.
- Si no puedes predecir con certeza qué archivos tocará una tarea, trátala como compartida.
- Máximo **2** trabajadores. No hay un tercero «por si acaso».

## 2. Cómo lanzar

- Cada trabajador en su **propio worktree**, con la herramienta de sesiones de la app. No uses `git worktree add` a mano si la herramienta existe.
- Rama `tarea/<id>`, cortada de la **principal actualizada**. Al crear el worktree indica la rama base de forma explícita: la herramienta puede cortarlo desde una rama vieja.
- Preflight del trabajador: tras `git fetch origin`, compara `git log --oneline -n 1` con `origin/<principal>` (no con la principal local). Si no coincide, crea `tarea/<id>` desde la principal antes de editar.
- En un worktree la principal está abierta en la carpeta principal, así que no se puede `git switch <principal>` ni hacer `git pull`. El trabajador ejecuta `git fetch origin` y crea su rama con `git switch -c tarea/<id> origin/<principal>`. Si la rama ya existe, comprueba su base con `git merge-base --is-ancestor origin/<principal> HEAD`; si falla, se detiene e informa al orquestador.
- Cada orden dice «modo paralelo», el id de la tarea, el puerto asignado (ver 5) y los archivos que le tocan.

## 3. Preparar el worktree

- **Dependencias:** el worktree no hereda `node_modules`. La primera acción es instalarlas (`npm ci` o lo que use el proyecto).
- **Permisos:** la lista del proyecto debe estar en `.claude/settings.json` **versionado**. `.claude/settings.local.json` lo ignora Git y no llega al worktree. Si el proyecto solo tiene la local, la primera orden del orquestador es pasar las reglas comunes al archivo versionado; como es un archivo de permisos, necesita que el responsable lo apruebe con un clic en el chat del trabajador, con aviso y enlace del orquestador (ver «Si la orden toca `.claude/settings*.json`» en `skills/orquestador`).
- **Archivos ignorados:** `.env` y demás archivos que Git ignora no llegan al worktree. Si el proyecto los necesita, cópialos desde la carpeta principal sin commitearlos.
- `.claude/worktrees/` debe estar en el `.gitignore` del proyecto; si falta, se agrega en esa misma orden.

## 4. Progreso

- En modo paralelo el trabajador **no toca `PROGRESS.md`**: dos ramas editándolo chocan al fusionar. Escribe su estado en `progress/<id>.md` (archivo propio, con el mismo formato).
- La línea `Ciclo:` del formato también va en `progress/<id>.md`.
- La compuerta de cierre revisa `progress/<id>.md` en lugar de `PROGRESS.md`.
- Cuando ambas tareas estén fusionadas, el orquestador ordena una tarea corta que consolida los dos archivos en `PROGRESS.md` y los borra. Si una tarea queda bloqueada o se descarta, se consolida igual al fusionar la otra.

## 5. Recursos compartidos

- **Puertos:** el orquestador asigna uno distinto a cada trabajador para servidores de desarrollo o vista previa (p. ej. 4321 y 4322). El comando con ese puerto (p. ej. `npm run dev -- --port 4322`) debe estar en allow de los permisos del proyecto, o pedirá aprobación.
- **Pruebas pesadas** o que levantan servidores: se corren de a una, incluida la suite lenta de cierre del orquestador. El trabajador las corre solo cuando la orden se las pide, y espera el turno que le dé el orquestador. Lo ligero (lint, typecheck, `git diff --check`) corre libre.
- **Dónde verifica el orquestador:** el trabajador informa la ruta de su worktree; el orquestador verifica ahí (`git -C <ruta>` y comandos con esa ruta) y solo con ese trabajador detenido. Esos `git -C <ruta> ...` pueden pedir aprobación porque no coinciden con las reglas de permisos; es aceptable, el orquestador es interactivo.

## 6. Cierre

- **Un PR por tarea**, fusionados de a uno: los fusiona el orquestador si el proyecto no publica en producción al fusionar, y si no, el responsable (`C:\repos\creador\skills\orquestador\cerrar.md`, paso 5: con «no» se sigue `cerrar-no.md`; con «sí», `cerrar-si.md`).
- Si el segundo PR queda desactualizado tras la primera fusión: fuera de producción, el orquestador ejecuta `gh pr update-branch <número>` y espera la CI; en producción, le indica al responsable que use «Update branch» de GitHub. El trabajador nunca hace `merge` ni `rebase`.
- Tras fusionar ambos: tarea de consolidación de progreso (ver 4) y limpieza. Una rama abierta en un worktree no se puede borrar, así que el orden es: antes de archivar, el trabajador sale de la rama con `git switch --detach` (en `C:\repos\creador\skills\orquestador\cerrar-si.md`, que lo ordena con «sí»; el paso 6 de `C:\repos\creador\skills\orquestador\cerrar.md` parte de que ya salió); luego se archiva su sesión. Archivar la sesión no quita su worktree: queda en la reserva de la app. Solo entonces `git branch -d` y borrar la rama remota. Nadie corre `git worktree remove`: aun sin `--force` sigue una junction ignorada y vacía su destino, y `guardia` lo frena. Lo ejecuta un trabajador en la carpeta principal.

## 7. Trabajo nocturno

El modo paralelo y las tareas largas pueden correr de noche si los ajustes de la app están activos: mantener el equipo despierto, avisos al celular y continuar tras el límite de uso. Push y PR van autorizados por defecto y la fusión fuera de producción la hace el orquestador; lo que exige una decisión del responsable (incluida la fusión en producción) queda esperando en la mañana. Si una tarea se bloquea, la otra sigue; el orquestador deja el aviso pendiente. Lanza la siguiente tarea por su cuenta como máximo 3 veces seguidas sin un mensaje del responsable, sumando ambos carriles (cuenta en el paso 7 de «Cerrar el ciclo»); al llegar al tope deja el aviso con lo hecho y la tarea que sigue, y espera. Una tarea única también puede correr de noche, sin modo paralelo, con las mismas reglas; ante una señal de traspaso, el orquestador sigue «Tras compactación o chat nuevo»: abre el orquestador nuevo si tiene herramientas de sesiones; si no, deja el traspaso escrito y se detiene hasta la mañana.
