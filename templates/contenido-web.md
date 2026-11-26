# Contenido de una landing

Guía para que el trabajador escriba las páginas de un sitio chico de servicios y el orquestador las audite contra `templates/checklist-web.md` (secciones 10 y 11). Escribe para personas; el buscador premia lo que ayuda a quien lee.

## Qué pide siempre al responsable y nunca inventa

Precios, teléfonos, correos, direcciones, horarios, credenciales y títulos, años de experiencia, casos, cifras, testimonios y reseñas, fotos de personas o del local. Si falta un dato, deja una marca visible `[FALTA: <dato>]`, no un reemplazo creíble, y pídelo en una sola solicitud. Lo legal, comercial o de marca (promesas, tono, qué servicios ofrecer, qué dice un aviso legal) lo decide el responsable: propón, no cierres.

## 1. Elegir la búsqueda objetivo de cada página

1. Anota qué teclearía una persona para encontrar esa página, con sus palabras y no las del oficio («abogado de familia en tu ciudad», no «servicios de derecho familiar»).
2. Una búsqueda por página y distinta en cada una. Si dos páginas responden la misma, fusiónalas o separa su propósito.
3. Incluye la zona si el negocio atiende un lugar (checklist 52–54).
4. Pídele al responsable que confirme las búsquedas antes de escribir: conoce a sus clientes.

Condición de terminado: tabla página → búsqueda → intención (informarse, comparar, contactar) guardada en `docs/`.

## 2. Estructura de la página

- Primero lo que la persona vino a buscar: qué es, para quién y dónde, y la llamada a la acción, sin rodeos.
- Luego secciones cortas con encabezados claros: el servicio, cómo se trabaja, por qué confiar (solo con datos reales), preguntas frecuentes si aplica, contacto.
- Párrafos cortos, lenguaje natural, sin faltas. Nada de texto oculto ni de párrafos pensados solo para el buscador.
- Enlaza con texto descriptivo a las páginas relacionadas (checklist 51); ninguna página importante queda sin un enlace desde otra.

## 3. Título, descripción, H1 y primer párrafo

- **Título:** único, descriptivo y conciso; la búsqueda objetivo más la marca, separada por un delimitador. No hay límite oficial, pero se recorta: lo importante primero. Sin «Inicio» ni palabras repetidas.
- **Descripción:** una o dos frases que resumen la página con exactitud; única por página. Google puede mostrar otro texto.
- **H1:** uno visible que nombra la página con la misma idea del título.
- **Primer párrafo:** responde la búsqueda en dos o tres frases. Dice lo mismo que título y H1, con otras palabras.

## 4. Llamadas a la acción

Un verbo y un resultado concreto: «Escríbenos por WhatsApp para una primera consulta», no «Haz clic aquí». Una acción principal por página, repetida al final. El medio de contacto debe coincidir con el real (checklist 35).

## 5. Preguntas frecuentes (solo si aplica)

Úsalas solo con preguntas que los clientes hacen de verdad, respondidas con datos que entregó el responsable. Sirven al lector; Google ya no muestra resultados enriquecidos de FAQ desde el 7 de mayo de 2026, así que no se marcan con JSON-LD buscando ese efecto.

## 6. Imágenes y datos del negocio

- `alt` que describe lo que se ve, en pocas palabras. Nombre de archivo descriptivo. La imagen va junto al texto que la explica. Si es decorativa, `alt=""` (práctica de accesibilidad del W3C, no de Google).
- Negocio con lugar o zona: datos y JSON-LD según los controles 53 y 54 (sin dirección pública si atiende en una zona; ahí `Organization` o `Person` es opcional). Para abogados usa `LegalService`: `Attorney` está obsoleto en schema.org. `Notary` sirve para notarías.

## 7. Cuidados

- No copies texto de otros sitios ni publiques texto generado sin revisar con los datos reales; revisar es verificar cada afirmación con el responsable o con su fuente.
- No llenes de palabras clave ni crees páginas casi iguales por ciudad o región solo para posicionar: Google lo trata como spam (doorway y contenido a escala). Una página por cada servicio o zona real, con texto propio.
- No cambies fechas para parecer «fresco».

Fuentes: developers.google.com/search/docs (creating-helpful-content, seo-starter-guide, title-link, snippet, google-images, links-crawlable, structured-data/local-business, structured-data/sd-policies, structured-data/faqpage, essentials/spam-policies); support.google.com/business/answer/7091 y /3038177; w3.org/WAI/tutorials/images/decorative; schema.org/LegalService y schema.org/Attorney.
