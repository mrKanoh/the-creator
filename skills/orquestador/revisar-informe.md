# Revisar un informe del trabajador

Fase de la skill del orquestador: la lees cuando `SKILL.md` lo pide; las reglas de `SKILL.md` siguen rigiendo.

0. **Revisa solo cuando el trabajador cerró la etapa** (commit hecho, informe entregado). Si aún está editando, espera: verías un estado a medias. En órdenes grandes el trabajador entrega antes un plan: revísalo contra la orden (cada Rn) y apruébalo con «Plan aprobado. Sigue con la etapa 1»; un plan rechazado cuenta como ronda de corrección de la etapa 1.
1. Compara el **diff** (no el informe) con la orden, requisito por requisito (R1, R2…, citados por su número): ¿está cada uno?, ¿hay algo no pedido?, ¿qué supuestos o casos borde eligió? Un Rn que aparece solo en el informe no cuenta como cumplido.
2. Comprueba por tu cuenta: rama correcta (nunca `main`), commits de etapa con `git log` y `git show --stat`, `git diff` focalizado, `git diff --check`, que no se commitearon secretos ni `.env` (y que `.env` está en `.gitignore`), que existe la etiqueta `antes-de-<nombre>` si la orden la pedía (`git tag`; si falta, anótalo como observación y **no** la mandes crear después: creada tarde no marca nada útil; el punto de retorno real es la rama base), que `PROGRESS.md` está al día, y ejecuta las verificaciones rápidas del proyecto (lee sus scripts, no asumas `npm`); la suite lenta no se corre por etapa sino una vez al cerrar (ver «Cerrar el ciclo», en `C:\repos\creador\skills\orquestador\cerrar.md`), salvo que la orden la pidiera en esa etapa.
3. Separa problemas nuevos de preexistentes. No ocultes pruebas fallidas.
4. Cierra con un estado: **APROBABLE**, **REQUIERE CORRECCIÓN** o **BLOQUEADO**, con la evidencia y la siguiente orden si corresponde.
