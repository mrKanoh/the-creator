---
name: sin-relleno
description: Quita de un texto en español las marcas de escritura de IA. Se invoca solo con /sin-relleno.
disable-model-invocation: true
---

# /sin-relleno

Reescribe un texto en español para que suene a una persona que sabe del tema. La lista de marcas con su antes y después está en `referencias.md` (en esta carpeta): léela al empezar.

## Cuándo usarla

- Solo en contenido para personas (landings, marketing, publicaciones) y cuando la orden o el responsable lo pidan.
- Nunca en código, informes, órdenes ni textos legales: ahí la precisión pesa más que el estilo.

## Reglas

1. **Empieza por el dato.** Una frase de apertura que anuncia lo que sigue se borra entera; la que sigue ya es la primera.
2. **Pon el sujeto que actúa.** «Se recomienda» pasa a «recomendamos» solo cuando hay un sujeto real. La pasiva con «se» es normal en español: déjala si no importa quién actúa.
3. **Concreto sobre abstracto.** Cambia «soluciones innovadoras» por lo que hace el producto, con el dato que el texto o la orden den; si falta, deja `[dato: …]`.
4. **Di cada cosa una vez.** Si la segunda frase repite la primera con otras palabras, borra una.
5. **Dos o cuatro elementos** cuando el contenido los tiene. Una lista de tres solo si hay tres cosas.
6. **Varía el largo** de las frases. Termina los párrafos de maneras distintas.
7. **Un adverbio en -mente se queda si cambia el sentido.** Borra los que solo intensifican («realmente», «verdaderamente»).
8. **Raya y negrita con tope.** Máximo una raya de inciso por texto y negrita solo para un término que el lector busca.
9. **Cierra con la acción o el último dato**, no con un eslogan.
10. **Prefiere la palabra española** al calco del inglés cuando existe y suena natural.

## Límite duro

No inventes datos, cifras, nombres ni testimonios para dar concreción. Distingue dos casos:
- Una afirmación con contenido que se puede comprobar se queda con su sentido; si le falta el respaldo, pasa a `[dato: …]`.
- El relleno sin contenido (eslogan, «tranquilidad», «tu éxito es nuestro éxito», «rápido, seguro y confiable» sin respaldo) se borra y se anota en la lista final.

## Antes de entregar

- [ ] Ninguna muletilla de `referencias.md` queda en el texto.
- [ ] Cada párrafo empieza por su punto.
- [ ] Hay a lo sumo un inciso con raya y ningún cierre de eslogan.
- [ ] Cada afirmación con contenido sigue en el texto o en un `[dato: …]`, y cada relleno borrado está en la lista final.
- [ ] Una persona lo diría en voz alta sin rodeos.
- [ ] Entregas el texto limpio y una sola lista final con lo que cambiaste y los datos que faltan.
