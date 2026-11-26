# tablero

Mod de Claude Code: un panel junto al chat, **solo lectura**, con el estado del trabajo del proyecto abierto. Lee `PROGRESS.md` (y `progress/*.md` en modo paralelo) de la raíz del proyecto de la sesión y lo muestra en cuatro bloques cortos. En modo paralelo cada trabajador escribe `progress/<id>.md` en su propio worktree, así que el panel de la carpeta principal **no los ve mientras están abiertos** y cada trabajador ve solo el suyo.

## Qué muestra

Los bloques van en este orden, con encabezado en negrita y color (colores del tema de la persona) y, salvo el primero, con su conteo total entre paréntesis:

| Bloque | De dónde sale y cómo se ve |
|---|---|
| **EN CURSO** | `## Trabajo actual` de cada archivo. Título del trabajo en negrita; las `Etapas:` como lista (`✓` hechas, `▶` la primera pendiente, la actual, `○` el resto); `Ciclo:` atenuado en una línea; `Pendiente / bloqueos:` con `⚠` en color de advertencia (solo si no dice «ninguno»). Sin trabajo: «Nada en curso» atenuado. En modo paralelo cada trabajo lleva el nombre de su archivo. |
| **TE TOCA A TI (n)** | Viñetas de `## Pendiente del responsable` (hasta 6): la primera frase, sin paréntesis, hasta «: » o «. » («p. ej.» y «etc.» no terminan la frase). Si lo que va antes de «: » es una condición de tiempo («Tras…», «Después de…», «Antes de…», «Cuando…», «Al …»), el título es lo que sigue (la acción). |
| **PENDIENTES DEL MÉTODO (n)** | Viñetas de `## Pendientes…` (hasta 8): el texto en negrita si lo hay; si no, la primera frase igual que arriba. |
| **HECHO (n)** | Viñetas de `## Terminados`: las 5 más recientes (las primeras del archivo) como fecha compacta atenuada («27-10») + id + nombre, hasta el primer « (», «: » o « · ». |

Si hay más viñetas que el límite, una fila atenuada «+N más». Las listas llevan viñeta «•».

**Descripción por fila (clic):** las filas de TE TOCA A TI, PENDIENTES DEL MÉTODO y HECHO que tienen más texto después del título son un botón: un clic (o Enter con el foco en el panel) despliega debajo, atenuada y sangrada, esa descripción, y otro clic la cierra. La descripción es el resto de la viñeta original de `PROGRESS.md` que el título descarta, sin markdown, en un máximo de 2 líneas cortadas al ancho con «…». Una viñeta que es solo el título no es clicable. Las filas de EN CURSO no cambian. Las filas desplegadas se olvidan al recargar el mod. Se incluyó HECHO porque, al estar cerradas por defecto, no ensucian el panel y ahí está el detalle (commits, pendientes) que el título corta.

**Por qué clic y no segunda línea fija:** el motor sí lo permite. Los tipos de `claude-code` (`plugin-authoring/types/claude-code.d.ts`) documentan `Button` («every surface's pressable»; «a click, a `hotkey` … or Enter under the focus raises `ui.press`, its bottom `onPress`», líneas 1085–1197) y que un `Pane` puede tener el teclado («`isFocused` … Tab walks its elements, a Button's `hotkey` presses it», línea ~10885).

**Texto limpio:** en todas las filas se quitan las negritas `**`, las comillas invertidas y los enlaces markdown (queda el texto). Un título sin ningún delimitador se corta a 90 caracteres como respaldo.

**Ancho:** el panel usa `bodyColumns` (el ancho real de la caja donde se dibuja, menor que la ventana si está acoplado). Cada fila se corta a ese ancho con «…» (descontando marca, fecha y sangría) y además se dibuja con `wrap="truncate-end"`; solo los títulos de trabajo (y el texto del estado vacío) hacen wrap y no se cortan. Cada etapa tiene su propia fila, así que ninguna se pierde.

Cuenta como vacío solo si toda la frase es «ninguno», «ninguna», «nada» o «sin bloqueos» (sola, entre paréntesis, con punto final o con una nota entre paréntesis): «Nada-1 tarea» o «Nada de tests aún: falta CI» se muestran. Una `##` dentro de un bloque ``` (una orden pegada) no cuenta como sección. Sin `PROGRESS.md` ni `progress/*.md`, o con un formato sin esas secciones (p. ej. proyecto-a), el panel dice que no hay nada que mostrar; no da error. Desde CRE-TAB-FMT-1, solo cuando no hay ningún `PROGRESS.md` ni `progress/*.md`, agrega «Abre el chat en la carpeta raíz del repo del proyecto» (el panel solo lee la raíz de la sesión; el texto hace wrap, así que ningún ancho lo corta). Con un archivo de formato propio o vacío no se agrega: ahí el problema no es dónde está abierto el chat (y el aviso de formato ya lo señala).

## Aviso de formato (CRE-TAB-FMT-1)

Mismo bloque de aviso que el de tamaño (primero en el panel; si hay de los dos tipos, el título es «AVISO: PROGRESS.md EXCEDE TOPES Y NO SIGUE SU FORMATO»; solo de formato, «… NO SIGUE SU FORMATO») y mismo aviso al modelo tras editar `PROGRESS.md`/`progress/*.md` o un `git commit`. Solo avisa. Dos comprobaciones, definidas en `skills/trabajador/formato-progress.md`:

- **Títulos (R1), solo `PROGRESS.md` de la raíz:** deben existir los cuatro `##`: Trabajo actual, Pendiente del responsable, Pendientes, Terminados. Mismo criterio que el panel (sin tildes ni mayúsculas, por prefijo: «## Trabajo actual: ninguno» y «## Pendientes del método» cuentan; uno dentro de un bloque ``` o un `###` no). Un archivo vacío o con formato propio también avisa. `progress/<id>.md` no se revisa: `modo-paralelo.md:7` dice «mismo formato», no que lleve los cuatro títulos. `progress/archivo.md` queda fuera.
- **Fila de «Terminados» (R2), también en `progress/<id>.md`:** avisa (una vez por caso, citando la fila recortada y cómo corregirla) si hay « (» justo después del id (`CRE-X-1 (…`: HECHO mostraría solo el id; el id va en mayúsculas, dígitos y guiones, así que «Modo paralelo (…)» no cuenta), o si la fila lleva estado de PR o de fusión: «PR #n abierto» (con su número), «PR abierto», «PR en borrador» o «fusionado» como tramo propio (al inicio o entre « · » o «;»), y «pendiente: fusión». El texto que describe una conducta («deja el PR listo para revisar», «la rama del PR fusionado», «la fusión comprueba producción») no avisa. El id lleva al menos una letra (una fecha sola no cuenta). No se exige el «—» de la plantilla. `progress/archivo.md` (historial) queda fuera. **Límite conocido:** «: » o « · » justo tras el id (`CRE-X-1: resultado`) también dejan HECHO con solo el id (`doneTitle` corta ahí), pero no avisan; solo se detecta « (».

Cero avisos con el `PROGRESS.md` real de Creador (`tests/creador-real.ts`, copia de `origin/main` 10e9b43) y con los fixtures; `NONE` ahora lleva los cuatro títulos (le faltaban dos).

## Aviso de tamaño (CRE-TAB-TAM-1)

Si `PROGRESS.md` (o un `progress/<id>.md`) pasa alguno de estos topes, el panel muestra arriba un bloque **AVISO: PROGRESS.md EXCEDE SUS TOPES** (en color de advertencia, sin cortar el texto): una fila por tope pasado, con el archivo, el valor y «Qué hacer». Aparece también si el archivo tiene un formato propio (p. ej. proyecto-a) y es demasiado largo.

| Tope | Valor | Qué hacer |
|---|---|---|
| Filas de «Terminados» | 10 (con 11 avisa; con 10, no) | pasar las más antiguas a `progress/archivo.md` |
| Caracteres de una fila de «Terminados» (el texto tras «- ») | 300 (con 301 avisa) | acortarla; el detalle va en el commit y el PR |
| Líneas del archivo | 200 (con 201 avisa) | recortar lo que ya no sirve para retomar el trabajo |

Las filas y los caracteres son la regla vigente del método (CRE-TERM-1); las 200 líneas se midieron en los proyectos de `PROYECTOS.md` (razón en `DECISIONS.md`, 2026-11-19). Una `## Terminados` dentro de un bloque ``` no cuenta, y sin esa sección o sin `PROGRESS.md` no hay aviso de filas (no falla). **Solo avisa:** no bloquea nada, no escribe ni recorta el archivo.

Cómo se cuentan: la fila se mide sobre el texto crudo de la viñeta (con su markdown, sin el «- »); una fila partida en varias líneas cuenta solo su primera línea; cuentan como «Terminados» los encabezados `##` cuyo título empieza por «Terminados» (sin importar tildes ni mayúsculas; `###` no); los archivos con CRLF cuentan igual. `progress/archivo.md` (el historial, que crece a propósito) no tiene tope de líneas.

**Aviso al modelo (R3): sí, por `tool.call`.** Tras un `Edit` o `Write` de `PROGRESS.md` o `progress/*.md`, o un `git commit` (Bash o PowerShell), si queda un tope pasado, el resultado de esa herramienta lleva una línea de `context` («what the model reads after the tool's result», tipos del motor) con los avisos y «es solo un aviso». Una vez por turno del bucle principal; nunca deniega, no cambia el resultado y no lanza turnos. Probado con el motor real (`claude -p --plugin-dir`, haiku, 2026-11-19): tras editar un `PROGRESS.md` de 12 filas, el modelo copió el aviso literal, en un solo turno. Vías evaluadas:
- **`classic.Stop` con `additionalContext`** (tipos: «text handed to the model with the event»): **descartada**. En el mismo motor, un módulo que lo devolvía hizo que el modelo contestara una y otra vez (más de 10 respuestas «FIN» en una sola ejecución de `-p`, sin guarda): el motor trata ese contexto como una continuación, es decir, fuerza un turno nuevo. Con una guarda (`stop_hook_active`) forzaría exactamente uno; sigue sin ser «solo avisar».
- **`tool.call` con `context`**: la elegida (arriba).
- **`turn.complete`**: no sirve; su `text` es la respuesta del modelo, no un canal hacia él.
- **`prompt.compose` / `prompt.section`**: no sirven; el texto queda fijo todo el hilo (un cambio espera a un hilo nuevo o a una compactación, salvo `breakPromptCache`, que reescribe la caché).
- **`$.prompt.submit`**: lanza un turno nuevo; equivale a bloquear.

Límites conocidos del aviso al modelo (no corregidos):
- La detección de `git commit` mira el comando como texto: no ve formas con `||` o `|` antes del commit, una línea nueva, `git -c k=v commit` ni `-C "ruta con espacios"`. Sí ve `git commit`, `git -C ruta commit` y `a && git commit` / `a; git commit`.
- Siempre se revisa el `PROGRESS.md` (y `progress/`) de la raíz de la sesión, aunque lo editado sea otro archivo `PROGRESS.md` de otra carpeta.
- La marca «ya avisado en este turno» es una sola para el módulo: si un subagente hace la edición o el commit que dispara el aviso, es él quien lo recibe y el agente principal no lo vuelve a ver en ese turno.

## Qué no hace

- No escribe ni edita nada, no ejecuta comandos y no usa la red: solo `$.fs.read` y `$.fs.list` sobre `PROGRESS.md` y `progress/` de la raíz del proyecto de la sesión. Lo único que agrega fuera del panel es una línea de `context` al resultado de algunas herramientas (ver «Aviso de tamaño»); no cambia el resultado ni deniega.
- No muestra otras fuentes (`DECISIONS.md`, Git, tareas de la sesión).

## Comportamiento y límites

- **Se abre solo** al iniciar cada sesión, en cualquier proyecto (también `/tablero` lo abre de nuevo), y **relee los archivos cada 5 s**.
- **Lee solo la raíz del proyecto de la sesión** (`$.session.root()`: sigue `/cd` y los worktrees; un `cd` de la shell no la mueve). `root()` no sube a la raíz del repo: una sesión que arranca en una subcarpeta tiene esa subcarpeta como raíz, y una abierta en un worktree o subcarpeta sin `PROGRESS.md` muestra el estado vacío.
- **Modo paralelo:** como cada `progress/<id>.md` vive en el worktree de su trabajador, el panel de la carpeta principal no los ve mientras la tarea está abierta; cada trabajador ve solo el suyo. Se ven en la principal una vez fusionados.
- Reconoce los títulos de sección por su inicio (`Trabajo actual`, `Terminados`, `Pendientes`, `Pendiente del responsable`), sin importar tildes ni mayúsculas. Solo lee viñetas de primer nivel; no lee el detalle de la orden pegada.
- El redibujo cada 5 s usa `$.ui.invalidate('ui.render')`; ver «Qué se probó».

## Archivos

- `.claude-plugin/plugin.json`: manifiesto.
- `hooks/hooks.json` → `hooks/register.tsx`: el panel (`session.start`, `command.run`, `ui.render`) y el aviso al modelo (`turn.start`, `tool.call`).
- `hooks/board.ts`: la lógica pura (parseo y bloques); no toca el motor.
- `tests/tamano.test.tsx`: pruebas del aviso de tamaño (cada tope pasado, justo en el tope, sin «Terminados», sin archivo, modo paralelo, panel montado). 55 pruebas en total con `claude plugin test` (2026-11-19), con el archivo del historial, CRLF y el aviso al modelo (`tool.call`).
- `tests/formato.test.tsx`, `tests/creador-real.ts`: pruebas del aviso de formato y del estado vacío (73 en total con `claude plugin test`, 2026-11-23; incluye el aviso al modelo con `tool.call`); `creador-real.ts` es el `PROGRESS.md` real de Creador congelado.
- `tests/tablero.test.tsx`, `tests/fixtures.ts`: pruebas para `claude plugin test` (el fixture copia `PROGRESS.md` de Creador con CRE-TAB-1 abierto).
- `../.claude-plugin/marketplace.json`: marketplace local `creador`.

## Cómo probarlo

```bash
claude plugin validate mods/tablero
```

```bash
claude plugin test mods/tablero
```

Contra el motor real, solo en esa sesión y en un repo de prueba (con su propio `TEMP`, nunca una sesión anidada en la carpeta principal de Creador): `claude -p --plugin-dir <ruta>\mods\tablero "<pedido>"`.

### Qué se probó (2026-10-27, Claude Code 2.1.308; descripciones 2026-10-29, 2.1.309)

- Descripción por fila (CRE-TAB-2), `claude plugin test`: 29 pruebas (las 22 previas más 7 nuevas, incluida una con títulos repetidos cuya clave es la viñeta cruda más un sufijo de ocurrencia; en una previa, la búsqueda de la fila de HECHO pasó de `Text` a `Button`, porque ahora es clicable). Nuevas: `detail` (resto de la viñeta, limpio; título reescrito o cortado a media palabra; vacío si no hay más), `wrapLines` (máx. 2 líneas con «…»), filas con y sin clave y descripción solo si está abierta, ancho de la descripción, que `## Para la próxima orden` no se confunde con `## Pendientes` (sus viñetas no llegan a ningún bloque), y el panel montado en `terminal`, `desktop`, `vscode` y `mobile` donde `ui.press` despliega la descripción y otro `ui.press` la cierra.
- `claude plugin test`: 22 pruebas. Limpieza de markdown, títulos cortos de cada tipo (Terminados, pendientes, Pendiente del responsable) con un fixture con las formas del `PROGRESS.md` de Creador, orden y conteos de los cuatro bloques, etapas como lista (`✓ ▶ ○`), `Ciclo` y bloqueos, «ninguno» y sus variantes estrictas (con casos que solo empiezan igual), ajuste al ancho (títulos con wrap, una fila por etapa), modo paralelo, sin archivo, formato propio, cercos (``` / `~~~`, largo, sangrados) y «+N más»; el panel montado en `terminal`, `desktop`, `vscode` y `mobile` con archivos simulados, y una prueba de que no se escribe nada.
- `claude -p --plugin-dir mods/tablero --setting-sources project --model haiku --debug-file ...` en un repo de prueba del scratchpad con una copia de `PROGRESS.md`: el módulo carga (`hooks module tablero@inline loaded; events: session.start,command.run,ui.render`), `/tablero` queda registrado y `session.start` termina sin fallo propio.

- **Clic en la app de escritorio (el responsable, 2026-10-29, tras `/reload-plugins`):** el clic despliega la descripción y otro clic la cierra. Pero las filas clicables salían sin «•» y sin la fecha de HECHO: se les había puesto `label={row.text}` (solo el título) y según lo que vio el responsable y los tipos, el escritorio dibuja su botón nativo con el `label`, sin los hijos (inferencia, no cita). CRE-TAB-3 quitó el `label` (`hooks/register.tsx`); el `key` sigue dando la dirección. Prueba nueva en `claude plugin test` (30 en total): en las cuatro superficies la fila clicable de HECHO y la de TE TOCA A TI llevan «•» una sola vez, la fecha («29-10») una sola vez, el título una vez, la etiqueta que el motor toma de los hijos incluye marca y fecha, y `ui.press` despliega y cierra. Esa prueba solo ve lo que el módulo entrega al motor, no lo que pinta el escritorio.

### Qué no se pudo probar

- **Ver el panel y su actualización cada 5 s.** `claude -p` no tiene superficie (`ui.open: no-surface`), así que el panel no es observable ahí. No se afirma que se vea ni que se redibuje en una sesión interactiva; falta probarlo al instalarlo.
- **El aspecto de las filas clicables tras CRE-TAB-3.** No se vio en la app de escritorio. La corrección se apoya en los tipos (`ButtonProps.label`: con hijos, «the label then names the control; absent, it is the children's text»; `plain`: «a desktop draws its native button either way»), no en haber visto el resultado. Falta confirmar que «•» y la fecha aparecen (una sola vez) y que el clic sigue desplegando; la atenuación de la fecha en un botón nativo puede perderse.
- **Límites conocidos de las descripciones (no corregidos):** con un título «Tras X: acción. Más texto», la condición «Tras X» no aparece en la descripción; y las filas abiertas no se purgan, así que una viñeta nueva con la misma clave que una abierta antes aparece desplegada (hasta recargar el mod). Tampoco se corrigen: (a) editar el texto de una viñeta abierta la pliega en el siguiente redibujo, porque la clave es la viñeta cruda; (b) si el título perdió un paréntesis y además lo cortó el tope de 90, la descripción puede empezar a media palabra; (c) el sufijo `#n` de la clave puede chocar con una viñeta cuyo texto termine en `#n` (muy improbable).
- **Que `/tablero` abra el panel**: en `claude -p` el texto `/tablero` no se ejecutó como comando (lo trató el modelo); solo se probó en la prueba del motor que `command.run` existe.
- **Sesión abierta en un worktree o subcarpeta** (solo está documentado el comportamiento, no probado en vivo).

## Cómo instalarlo

Misma vía que `guardia` (ver su README y `DECISIONS.md`): marketplace local `creador`. Se instala **después de fusionar**, porque con fuente relativa se lee la carpeta principal de Creador en el lugar.

- Marketplace (si aún no está): `claude plugin marketplace add C:\repos\creador\mods`.
- Instalar: `claude plugin install tablero@creador`.
- Actualizar: fusionar el cambio en `main`; luego `/reload-plugins` o una sesión nueva.
- Desactivar / reactivar: `claude plugin disable tablero@creador` / `claude plugin enable tablero@creador`.
- Desinstalar: `claude plugin uninstall tablero@creador`.
