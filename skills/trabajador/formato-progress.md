# PROGRESS.md (estado del trabajo, para no perder contexto)

Fase de la skill del trabajador: la lees cuando `SKILL.md` lo pide; las reglas de `SKILL.md` siguen rigiendo.

Archivo en la raíz del repositorio. **Reemplaza la sección del trabajo actual; no acumules.**

- Mientras el trabajo está abierto, guarda **la orden completa** tal como la recibiste.
- Al cerrarlo, la sección pasa a «Terminados» como **una sola línea de 300 caracteres como máximo**, escrita al cerrar y sin estado del PR ni de la fusión («PR #n abierto», «fusionado», «pendiente: fusión»); el detalle va en el commit y el PR, no en la fila. Después solo se completan el auditor y `rondas`, y tras la fusión nadie la actualiza. «pendiente» lista solo trabajo real o «nada». Si la orden pide otra cosa, sigue la orden.
- «Terminados» conserva las 10 últimas filas, la más reciente primero. La que sale va como primera viñeta de `progress/archivo.md`, después de su título `#` (créalo si falta), nunca a otra sección de `PROGRESS.md`: el archivo no se lee al empezar. Ningún título `##` que empiece con «Trabajo actual», «Pendiente del responsable», «Pendientes» o «Terminados»: `guardia` y `tablero` lo leerían como estado vigente.
- **`Ciclo:`** lo dicta el orquestador en cada veredicto (rondas = rondas de corrección de la última etapa revisada); cópialo tal cual en tu próximo commit. Sin esos valores del orquestador: en una orden chica escribe «rondas 0» y «auditoría no hubo» (o el número de rondas si hubo una corrección); en una normal o grande, antes del primer veredicto, «auditoría pendiente» y «rondas 0»; `etapas aprobadas` = las que el orquestador ya aprobó (0 si ninguna). Si un veredicto llega sin `Ciclo`, repite los valores del último. Nunca «sin dato». La línea `Ciclo` dice `auditoría …` y la fila de «Terminados» dice `auditor …`, con los mismos valores. La fila lleva `auditor no hubo` si la orden es chica y `auditor pendiente` si es normal o grande; en este caso actualízala con el valor que dicte el orquestador tras la auditoría, en el commit de correcciones o, si no hay correcciones, en el que él te ordene antes de abrir el PR. `rondas` en la fila = total de rondas de corrección de la tarea, incluidas las del cierre.

```
## Trabajo actual: <id> <nombre>  (rama tarea/<nombre>)
- Etapas: [x] 1 <qué> (commit abc123) · [ ] 2 <qué>
- Ciclo: etapas aprobadas <n>, auditoría <pendiente|no hubo|no corrió|a/m/b>, rondas <n>
- Línea base de pruebas: <qué pasaba y qué fallaba antes de empezar>
- Pendiente / bloqueos: <...>
### Orden completa
<pegada sin cambios>
## Pendiente del responsable
- <lo que solo el responsable puede hacer o decidir; o «Ninguno.»>
## Pendientes
- <trabajo siguiente del proyecto, en orden; o «Ninguno.»>
## Terminados
- <fecha> <id> — <resultado> · `tarea/<nombre>` · rondas <n> · auditor <pendiente|no hubo|no corrió|a/m/b> · pendiente: <observaciones o «nada»>
```

Estos cuatro títulos van siempre, con ese texto exacto: `tablero` y `guardia` los leen. Otras secciones propias del proyecto pueden ir debajo. Si el archivo tiene otro formato, agrega los cuatro títulos arriba, sin reescribir su historial.
