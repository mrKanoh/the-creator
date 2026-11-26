# Diagnóstico de un error

Procedimiento para órdenes que piden encontrar la causa de un error (algo roto, que falla o que va lento). Para revisar un proyecto completo usa `C:\repos\creador\templates\diagnostico-proyecto.md`.

**Alcance según el tipo de orden.** En una orden de tipo *diagnóstico* llegas solo hasta la causa, con evidencia, y no corriges nada: te detienes tras la fase 4 (y la limpieza de la fase 6 si creaste archivos temporales). La fase 5 y la corrección aplican solo si la orden es de *implementación*.

En diagnóstico, editar el repo no está autorizado. Crea archivos temporales de reproducción o de instrumentación (pruebas, registros `[DEBUG-…]`, configuración reducida) solo si la orden lo autoriza de forma explícita, y, antes de informar, reviértelos: `grep` del prefijo sin resultados y `git status` igual al inicial. Sin esa autorización, usa solo formas que no editan el repo (`curl`, CLI, navegador headless, bisección, comparación) o pide permiso.

## Secretos

Todo lo que muestres (comandos, salidas, capturas) va sin secretos: escribe `<REDACTED>` donde haya un token, una clave o una cabecera de autenticación. Pasa las credenciales por variables de entorno para que no queden en lo que muestras, y cita solo las líneas que traen la señal. Si con lo redactado no alcanza para diagnosticar, dilo y pídelo.

## Fase 1: construye un comando de reproducción

Es el centro del procedimiento. Con un comando que falle por este error, encontrarás la causa; sin él, no. Dedícale más esfuerzo que a todo lo demás.

Formas de construirlo, en este orden:
1. Una prueba que falla, en el punto más cercano al error (unitaria, de integración o e2e).
2. Un script con `curl` contra el servidor de desarrollo.
3. Una invocación de CLI con una entrada fija, comparando la salida con una buena conocida.
4. Un navegador headless (Playwright o similar) que recorre la interfaz y comprueba DOM, consola y red.
5. Una traza real guardada y repetida en el camino de código aislado.
6. Una bisección (`git bisect run`) si el error apareció entre dos estados conocidos.
7. Una comparación de la misma entrada entre versión vieja y nueva, o entre dos configuraciones.
8. Si es intermitente, repetir el disparador cientos de veces hasta tener una tasa de fallo alta y estable.

**Terminado cuando** puedes nombrar **un solo comando**, ya ejecutado una vez con su salida a la vista (redactada), que:
- falla por el **síntoma exacto** que reportó el responsable, no por uno cercano;
- es rápido (segundos);
- da el mismo resultado en cada ejecución;
- corre sin nadie delante.

Sin ese comando no hay hipótesis: no armes teorías leyendo código antes de tenerlo. Si no puedes construirlo, detente e informa qué intentaste, y pide acceso al entorno, evidencia redactada (logs, HAR, captura con horas) o permiso para instrumentar.

## Fase 2: reproduce y reduce

Corre el comando, confirma que falla como lo describió el responsable y anota el síntoma textual (mensaje, salida errónea, tiempo). Luego quita entradas, pasos, configuración y datos uno por uno, corriendo el comando tras cada recorte. Terminas cuando todo lo que queda es necesario: quitar cualquier cosa lo hace pasar.

## Fase 3: hipótesis

Escribe de 3 a 5 hipótesis ordenadas, antes de probar ninguna. Cada una con su predicción: «si X es la causa, cambiar Y hace desaparecer el error». Sin predicción, descártala o afínala. Entrega la lista al orquestador (o al responsable en modo manual), DETENTE y espera su respuesta antes de probarlas (puede reordenarlas o descartar alguna).

## Fase 4: instrumenta

Cada sonda responde a una predicción; cambia una sola variable a la vez. Prefiere un depurador o puntos de registro en los límites que distinguen hipótesis; nunca «registrar todo y filtrar». Marca cada registro con un prefijo único (por ejemplo `[DEBUG-a4f2]`) para encontrarlos todos después. En problemas de rendimiento mide primero (línea base, perfilador, plan de consulta) y corrige después.

Cierra la fase con la causa y la evidencia que la sostiene (comando, salida, líneas de código). En una orden de diagnóstico, termina aquí.

## Fase 5: prueba de regresión y corrección (solo implementación)

Antes de corregir, convierte la reproducción mínima en una prueba que falla, pero solo si hay un punto donde reproduce el patrón real del error. Si no existe, anótalo como hallazgo: la estructura del código impide fijar el error. Luego corrige y comprueba que la prueba pasa.

## Fase 6: limpieza (implementación; en diagnóstico, si creaste archivos temporales)

- Implementación: vuelve a correr el comando de la fase 1 (ya no falla) y escribe en el mensaje del commit la hipótesis que resultó correcta.
- Siempre que hayas creado algo temporal: borra los registros marcados (`grep` del prefijo sin resultados) y los prototipos descartables, y comprueba `git status`.

Adaptado de mattpocock/skills (MIT), commit 59db609
