# Afinar un pedido

Fase de la skill del orquestador: la lees cuando el pedido es ambiguo según los criterios de `SKILL.md` («Fases») o el responsable dice «afina»; en el orquestador siguen rigiendo las reglas de `SKILL.md`. También la usa el chat de Creador sin rol, que sigue el `CLAUDE.md` de Creador. No ejecutas nada del proyecto: solo preguntas y, al final, una orden.

## Cómo trabajar

1. **Árbol de decisiones.** Cada decisión abre otras que cuelgan de ella. Trabaja el árbol por rondas.
2. **Una ronda** trae todas las preguntas que ya se pueden responder sin adivinar respuestas que faltan. Una pregunta que depende de otra aún abierta va en una ronda posterior.
3. **Formato de pregunta:** numerada, con su respuesta recomendada, redactada para que «sí» la acepte. Espera las respuestas antes de la siguiente ronda; lo que el responsable contesta mueve el árbol y destraba preguntas nuevas.
4. **Los datos los buscas tú**, nunca se los preguntas al responsable: léelos en el repo o en los documentos, o encárgalos a un subagente de exploración. No frenes por eso: pregunta ya lo que no depende del dato. **Las decisiones son del responsable.**
5. **Tope de 3 rondas.** Al llegar, lo que siga abierto se lista como suposición marcada con **«Estoy suponiendo»** o como duda para el responsable.
6. **Fin:** no quedan preguntas o se alcanzó el tope. Antes de redactar, resume el entendimiento en 5 campos y pide al responsable que lo confirme: **problema**, **resultado esperado**, **a quién o qué afecta**, **restricciones**, **preguntas abiertas**. Alimentan la orden: problema → Contexto; resultado esperado → Objetivo; a quién o qué afecta → Alcance; restricciones → Restricciones; preguntas abiertas → las suposiciones y dudas del remate.
7. **Remate.** Con el resumen confirmado, redacta la orden según `C:\repos\creador\templates\orden.md`, con las suposiciones y dudas debajo. En el orquestador, lee `C:\repos\creador\skills\orquestador\redactar-orden.md` y lánzala como siempre: la confirmación del resumen es el permiso. Una duda que sea de «Decide el responsable» va en una solicitud de decisión, no en la orden. En el chat de Creador sin rol, entrégala en un bloque para pegar.

## Ejemplo de una ronda

```
❓ **P1 - Alcance**: ¿La mejora toca solo la página de contacto y deja fuera el formulario del pie?

➡️ Solo la página de contacto; el pie queda fuera de alcance.

---

❓ **P2 - Verificación**: ¿Se prueba con captura de pantalla en móvil y escritorio?

➡️ Sí, en 375 px y 1280 px.
```

Adaptado de mattpocock/skills (MIT), commit 59db609
