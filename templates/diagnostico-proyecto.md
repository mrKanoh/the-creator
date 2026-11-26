# Diagnóstico de proyecto

Lo usa `/orquestador` cuando entra a un proyecto sin `AGENTS.md` ni PRD, o cuando el responsable pide «revisa el proyecto». **Solo lectura**: el diagnóstico no corrige nada; produce una lista de brechas y el responsable elige cuáles atacar. El orquestador lee, delega la lectura amplia y valida; el documento lo escribe un trabajador por su orden.

## 1. Clasificar antes de revisar (proporcionalidad)

Elige un perfil. Cada ítem de abajo dice en qué perfiles aplica; lo que no aplica se marca «no aplica», no se exige.

- **S — sitio estático / landing:** contenido y diseño, sin backend ni datos de usuarios.
- **A — aplicación:** backend, base de datos, autenticación o datos de usuarios.
- **H — herramienta, skill o repo de documentación:** sin despliegue público.

No conviertas un proyecto S en uno A: agregar capas que el perfil no necesita es sobreconstruir.

## 2. Cómo marcar cada ítem

`✅ cumple` · `⚠️ parcial` · `❌ falta` · `— no aplica` · `? sin verificar`

Cada marca lleva **evidencia**: ruta de archivo o comando y su resultado. Si no pudiste comprobarlo, es `?`, nunca una suposición. Cada brecha lleva **nivel** (Mínimo / Recomendado / Opcional) y **esfuerzo** (chico / mediano / grande).

## 3. Lista de revisión

| # | Ítem | Perfiles | Nivel |
|---|---|---|---|
| 1 | `README` con qué es, cómo instalar, cómo correr | S A H | Mínimo |
| 2 | `AGENTS.md` (importado por el `CLAUDE.md` del proyecto con `@AGENTS.md`) con ruta real, cómo verificar, qué publica (con la línea exacta `- Fusionar publica en producción: sí` o `no`) y qué no tocar | S A H | Mínimo |
| 3 | PRD de una página en `docs/PRD.md`: objetivo, usuarios, incluye / no incluye, criterio de éxito | S A | Mínimo |
| 4 | `DECISIONS.md` con el stack y su motivo | S A H | Recomendado |
| 5 | `.gitignore` cubre `.env*`, dependencias y salidas de build; existe `.env.example` si hay variables | S A H | Mínimo |
| 6 | Sin secretos en el código ni en el historial de Git (usa `gitleaks` si está instalado; si no, busca patrones de claves en los archivos versionados y marca el historial como `?`) | S A H | Mínimo |
| 7 | Pruebas que se pueden ejecutar, con línea base registrada | S A | Mínimo en A, Recomendado en S |
| 8 | Verificación de tipos o lint ejecutable | S A H | Recomendado |
| 9 | CI que corre al menos check/build en cada PR, y sin errores según `actionlint` si está instalado | S A | Recomendado |
| 10 | Cómo se publica, documentado; rama principal = producción si aplica; vista previa por PR si existe | S A | Mínimo |
| 11 | `.claude/settings.json` versionado (o `.claude/settings.local.json` en proyectos antiguos) desde la plantilla de permisos de Creador | S A H | Mínimo |
| 12 | Dependencias: vulnerabilidades conocidas (`npm audit` o equivalente) | S A | Recomendado |
| 13 | Dependencias muy desactualizadas o abandonadas | S A | Opcional |
| 14 | Accesibilidad (WCAG AA) de las páginas principales | S A | Recomendado |
| 15 | Rendimiento y SEO básicos (títulos, descripciones, imágenes optimizadas) y sin enlaces rotos (`lychee` sobre el sitio compilado, si está instalado y ya existe; si no, `?` con el motivo) | S | Recomendado |
| 16 | Autenticación, permisos y validación de entradas revisados | A | Mínimo |
| 17 | Respaldo y camino de vuelta de la base de datos | A | Mínimo |
| 18 | Manejo de errores y registros en producción | A | Recomendado |

Para accesibilidad, si existe la skill de WCAG del responsable (`skill-accesibilidad`), úsala.

**Sitios web (perfiles S y A con interfaz pública):** además, recorre `C:\repos\creador\templates\checklist-web.md` (Google, medición, privacidad, formularios, publicación) y resume sus Mínimos pendientes en el diagnóstico.

## 4. Proyecto nuevo: antes de escribir código

1. **PRD** (ítem 3) con el responsable: como máximo 3 preguntas; lo que no sepa queda como «por decidir», no inventado.
2. **Stack:** parte de lo que el responsable ya usa (ver `C:\repos\creador\PROYECTOS.md`) salvo que el PRD exija otra cosa. Propón 1 o 2 opciones con ventajas y costos, recomienda una. Verifica versiones actuales en la documentación oficial, no de memoria. **La elección es del responsable**; queda en `DECISIONS.md` con fecha y motivo.
3. La base mínima del perfil (ítems de nivel Mínimo) es la primera orden para el trabajador.

## 5. Entrega

Guarda el resultado en `docs/DIAGNOSTICO.md` del proyecto (lo escribe el trabajador; reemplaza el anterior, con fecha):

- Perfil elegido y por qué.
- Tabla con los 18 ítems: marca, evidencia, nivel, esfuerzo.
- **Brechas ordenadas:** primero Mínimo, luego Recomendado; dentro de cada nivel, de menor a mayor esfuerzo.
- Propuesta de las 3 primeras órdenes.

El responsable elige qué atacar. Cada brecha elegida es una orden normal, con auditoría al cierre. No agrupes más de 3 brechas en una misma orden.
