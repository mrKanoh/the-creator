# Handoff para una sesión nueva

Lo usa cualquier chat cuando corresponde `ESTADO: NUEVA SESIÓN` (ver `global/CLAUDE.md`, «Cuándo recomendar cambiar de sesión»). El handoff se entrega **en la conversación**, no en un archivo.

Entregar:

1. Proyecto, ruta, worktree, rama, último commit, objetivo y alcance.
2. Trabajo completado y decisiones confirmadas.
3. Archivos creados, modificados o eliminados; cambios sin commit y su origen conocido.
4. Verificaciones y resultados exactos; problemas preexistentes, errores y riesgos.
5. Punto exacto donde quedó la tarea y comandos verificados para retomar.
6. Siguiente paso y prompt autocontenido listo para una sesión nueva.

Antes del handoff, si el proyecto usa Git y es seguro, ejecutar `git status --short --branch` y `git diff --check`. No modificar el proyecto solo para preparar el handoff.

No crear un archivo de handoff dentro del repositorio salvo que el responsable lo solicite o el proyecto ya tenga esa convención.

Formato del aviso:

> ⚠️ **ESTADO: NUEVA SESIÓN — existe una señal concreta de degradación o cambio de tarea.** A continuación entrego el handoff para continuar sin perder el estado.
