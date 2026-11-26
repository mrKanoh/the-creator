# Referencia del orquestador

Lo usa `/orquestador`. Cada sección se lee solo cuando la skill lo pide, con la condición que ahí figura.

## Primera vez en este proyecto

Léela antes de la primera orden de un proyecto, o si falta algo del estado del método. Comprueba que existan `.claude/settings.json` versionado, o `.claude/settings.local.json` en proyectos antiguos (permisos) y un `AGENTS.md` del proyecto con el `CLAUDE.md` del proyecto importándolo con `@AGENTS.md`, y que la rama actual parta de la principal actualizada. Si falta algo, la **primera orden** es prepararlo: permisos desde `C:\repos\creador\templates\permisos-proyecto.json` más los comandos de verificación del proyecto (los allow de `gh pr merge` y `gh pr update-branch` solo si fusionar no publica en producción **y** `guardia` está instalado y activo en esta máquina; sin guardia no se copian; la frontera real es la protección de rama de GitHub; ver su `_uso`), y un `AGENTS.md` mínimo (ruta real del repo, cómo verificar, qué publica con la línea exacta `- Fusionar publica en producción: sí` o `no`, y qué no tocar) más el `CLAUDE.md` del proyecto con `@AGENTS.md`. Si la rama actual es de una tarea ya fusionada, ordena primero volver a la principal actualizada. Mientras `origin/<principal>` no tenga en su `AGENTS.md` la línea exacta de producción (repo nuevo, o un PR que crea o cambia esa línea), ese PR lo fusiona el responsable aunque su propia línea diga «no»: `guardia` lo frena a propósito, porque la línea que autoriza la fusión no puede venir del mismo PR. Desde el PR siguiente rige la línea ya fusionada.

## Permisos al lanzar al trabajador

Léela si tu modo es menor que `acceptEdits` o si la orden toca `.claude/settings*.json`.

- **Modo menor que `acceptEdits`:** solo si tu modo es menor que `acceptEdits` (`default` o `plan`, p. ej. porque `auto` no está disponible), justo después de lanzarla pásala a `acceptEdits` con `mcp__ccd_session_mgmt__set_session_permission_mode` (session_id de la sesión que creaste); la app le mostrará al responsable **una** tarjeta: avísale en una línea que es para que el trabajador edite sin preguntar. Si la herramienta no existe o falla, avísale que cada permiso de edición le llegará a él. Los comandos de terminal dependen de la lista de permisos del proyecto (`.claude/settings.json` versionado, o `.claude/settings.local.json` en proyectos antiguos); si no existe, la primera orden es crearla desde `C:\repos\creador\templates\permisos-proyecto.json`.
- **Si la orden toca `.claude/settings*.json`:** el trabajador no edita sus permisos por pedido de otra sesión. Incluye el cambio en la orden y, al lanzarla, avisa al responsable en una línea qué archivo de permisos cambia, qué regla y por qué, con el enlace al chat del trabajador: allí el trabajador le preguntará y él aprobará con un clic. Nunca le des una frase para copiar y pegar, ni le reenvíes al trabajador una aprobación del responsable: en la prueba 2b de CRE-AUT-1 el trabajador no aceptó una aprobación reenviada por el orquestador, y en la 2c sí aceptó la que el responsable escribió en su chat. Si el aviso de fin de turno del trabajador es su pregunta de permisos al responsable, no la revises ni la respondas: espera el aviso siguiente. No lo descubras al final.

## Traspaso por compactación

Léela al redactar el traspaso por compactación o señal de contexto.

Redacta el traspaso, un bloque en el chat para el responsable (no editas): proyecto, id, rama, línea `Ciclo`, última etapa aprobada, hallazgos abiertos, tareas lanzadas sin el responsable: n, siguiente paso y un prompt autocontenido para `/orquestador`. Si el traspaso debe quedar en el repo, ordénale al trabajador registrarlo en «Pendiente / bloqueos» y espera su commit. Después, siempre, déjalo detenido o archivado y agrégalo al traspaso. Abre un orquestador nuevo con tu mismo modelo (herramientas de sesiones; primer mensaje: «Lee y aplica las reglas de `C:\repos\creador\skills\orquestador\SKILL.md`», seguido del traspaso); sin herramientas, pídeselo al responsable. De noche, sin herramientas de sesiones, deja el traspaso escrito y detente hasta la mañana.

## Fricciones de herramientas

Léela si `archive_session` falla o `bind_pr` es denegado.

- **`archive_session` falla al primer intento** porque un hook cambia la entrada tras la revisión del modo auto: reenvíala igual una vez; no es un rechazo.
- **`bind_pr` denegado por el clasificador del modo auto:** el PR queda sin vincular, sin otro efecto; sigue.

## Si algo salió mal

Léela si hay que deshacer una etapa o un trabajo, revertir una fusión o una migración, o explicar en el aviso de cierre cómo volver atrás.

- Antes de fusionar, `main` no se tocó: si el trabajo no sirve, basta con no fusionar la rama. Si ya fusionaste, el camino de vuelta es una tarea nueva con `git revert -m 1 <commit de fusión>` y su PR.
- Para deshacer una etapa concreta, ordena `git revert <commit>` (conserva el historial). `git reset --hard`, `git checkout -- .` y equivalentes solo con autorización explícita del responsable y objetivo exacto confirmado.
- Si hubo migración de base de datos, el respaldo previo es el camino de vuelta, no Git. Si no existe respaldo, es BLOQUEADO: avisa al responsable.

## Solicitud de decisión

Léela al escalarle algo al responsable (una decisión de su lista o un BLOQUEADO).
**Solicitud de decisión** (notificación al celular si tienes la herramienta; si no, en este chat). Lenguaje simple, sin jerga ni rutas, máximo ~12 líneas:
1. **Qué pasa:** la situación en 1–2 frases, como se la contarías a alguien que no programa.
2. **Por qué te lo pregunto:** qué lo hace importante o difícil de deshacer.
3. **Opciones:** 2 o 3, cada una con su consecuencia concreta.
4. **Recomiendo:** cuál y por qué.
5. **Por qué no las otras:** una línea por cada una.
6. **Si no respondes:** qué queda esperando.
