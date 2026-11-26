# Escribir para agentes

Lista de comprobación para quien edita una skill, una plantilla o un `CLAUDE.md`/`AGENTS.md`. Léela antes de editar y repásala antes de entregar.

## Qué se carga y cuándo

- [ ] **La remisión decide cuándo se lee.** La línea que nombra otro documento (o la `description` de una skill) es lo que el agente ve; su redacción decide si llega al material. Ponla concreta: qué es, y una condición por cada caso distinto que dispara la lectura. Sinónimos de un mismo caso son un solo caso escrito dos veces. Si un material imprescindible no se lee, afina la remisión antes de pegarlo en el archivo.
- [ ] **Lo que se carga siempre cuesta en cada turno** (`CLAUDE.md`, `AGENTS.md`, una `description`). Poda sus palabras más que las del cuerpo.
- [ ] **Pasos frente a referencia.** Los pasos (lo que se hace, en orden) van en el archivo; la referencia (reglas, datos) que solo usan algunos casos va a un archivo aparte con su remisión. Referencia larga mezclada con pasos entierra los pasos.
- [ ] **Junto lo que va junto.** Define, regula y advierte cada concepto bajo un mismo encabezado, no repartido por el archivo.
- [ ] **Skills solo del responsable.** Si solo la invoca él, `disable-model-invocation: true` y una `description` de una línea para personas: no carga contexto. Una skill sin esa marca paga contexto permanente a cambio de que el agente la encuentre; hazlo solo si el agente debe alcanzarla solo.

## Cómo redactar

- [ ] **Cada paso termina en una condición de terminado** que se pueda comprobar y que exija de verdad («cada archivo modificado revisado», no «hacer una lista»). Una condición vaga invita a darlo por cerrado antes de tiempo.
- [ ] **Una palabra clave conocida vale más que la frase que la explica** (por ejemplo «rojo» para una prueba que falla por este error). Úsala como palabra suelta y repetida. Busca tríadas o frases largas que una sola palabra ya existente reemplace.
- [ ] **Escribe en positivo.** Una prohibición sola deja en mente justo lo prohibido. Di qué hacer («escribe comentarios de una línea»). Reserva la prohibición para un límite duro que no puedas decir en positivo y acompáñala de lo que sí hacer.

## Qué podar

- [ ] **Una sola fuente por dato.** No copies lo que ya dicen `package.json`, la configuración, la estructura de carpetas o `--help`; esa copia se desactualiza. Escribe lo que el entorno no dice: la convención no escrita, la razón de una decisión, la trampa.
- [ ] **Borra lo que no cambia lo que el modelo ya hace por defecto.** Si una frase no altera su conducta, bórrala entera, no la recortes. Ante la duda, ejecuta el documento con y sin esa frase.
- [ ] **Evita capas viejas.** Agregar parece seguro y quitar parece riesgoso, y así se acumulan restos. Al editar, quita o actualiza lo que dejó de ser cierto.
- [ ] **Largo.** Un archivo muy largo diluye la atención aunque cada línea sea útil: divide por caso o por secuencia, y respeta los topes de `C:\repos\creador\tools\check-caps.ps1`.

Adaptado de mattpocock/skills (MIT), commit 59db609
