# Lista de publicación web

Para sitios web (perfiles S y A del diagnóstico). Se usa en dos momentos: **en el diagnóstico**, para medir el estado, y **antes de publicar por primera vez** (o al migrar de hosting o dominio), como compuerta: con un **Mínimo** pendiente, el sitio no está listo. Inspirada en la checklist de TUXDI que compartió el responsable; redactada para este método.

**Quién:** `T` lo implementa y verifica el trabajador en el código, con verificaciones rápidas por etapa (p. ej. la revisión a 320/390/1440 px, si la orden la pide); corregir un problema siempre es `T`. `O` lo mide el orquestador una vez al cierre (suite lenta): Lighthouse sobre el sitio compilado, o PageSpeed sobre la URL pública; `lychee` y navegadores sobre el sitio compilado. `T/O`: `T` corrige en el código y `O` verifica al cierre. En el diagnóstico (solo lectura, sin cierre) las `O` las corre el orquestador o su subagente de exploración solo si ya existe el sitio compilado o la URL pública; si no, se marcan `?` con el motivo: nadie compila en un diagnóstico. `A` lo hace el responsable en una cuenta (Google, Cloudflare, DNS, correo): el orquestador le envía una solicitud con los pasos exactos y verifica el resultado después. Nunca se inventan IDs de medición, propiedades ni claves: los entrega el responsable.

**Cómo marcar:** igual que el diagnóstico (`✅ ⚠️ ❌ — ?`), cada marca con evidencia (archivo, comando, URL o captura). Lo que no aplica se marca `—` con el motivo.

## 1. Dominio y publicación
| # | Control | Nivel | Quién |
|---|---|---|---|
| 1 | HTTPS en todo el sitio, con redirección desde http, y sin contenido mixto (nada cargado por `http://` en una página `https`) | Mínimo | T/A |
| 2 | Una sola versión del dominio (con o sin www) y redirección 301 de la otra | Mínimo | A |
| 3 | DNS sin registros viejos o duplicados; los del correo intactos | Mínimo | A |
| 4 | Página 404 propia, sin datos internos, que devuelva el código HTTP 404 y no 200 (con 200, Google la trata como «soft 404») | Mínimo | T |
| 5 | Redirecciones 301 desde las URLs del sitio anterior, si se reemplaza uno | Mínimo | T |
| 6 | Cómo volver a la versión anterior, escrito antes de publicar | Mínimo | T |

## 2. Google y SEO
| # | Control | Nivel | Quién |
|---|---|---|---|
| 7 | `robots.txt` no bloquea el sitio y declara el sitemap | Mínimo | T |
| 8 | `sitemap.xml` generado con las páginas que deben indexarse | Mínimo | T |
| 9 | Propiedad verificada en Google Search Console | Mínimo | A |
| 10 | Sitemap enviado en Search Console y sin errores | Mínimo | A |
| 11 | Sin `noindex` accidental en páginas que deben aparecer | Mínimo | T |
| 12 | Título único y descripción propia por página; la descripción resume la página con lo importante al inicio (Google no fija límite y recorta según el ancho) | Mínimo | T |
| 13 | Un H1 visible que nombra la página y encabezados ordenados (por lectura y accesibilidad; Google no exige un orden) | Recomendado | T |
| 14 | URL canónica por página | Recomendado | T |
| 15 | Open Graph y tarjeta social con imagen | Recomendado | T |
| 16 | Datos estructurados válidos (JSON-LD), si aplica. Validar con la Prueba de resultados enriquecidos de Google y el validador de schema.org. Errores típicos: fechas que no están en ISO 8601, URL que no son absolutas, datos que no coinciden con lo visible | Opcional | T |
| 55 | URL legibles: en minúsculas, con guiones y sin parámetros innecesarios; la barra final coherente con la canónica (en Astro, `trailingSlash`) | Recomendado | T |

## 3. Medición
| # | Control | Nivel | Quién |
|---|---|---|---|
| 17 | Decidir si el sitio mide visitas y con qué | Mínimo | A |
| 18 | Propiedad de Google Analytics 4 a nombre del dueño del sitio | Recomendado | A |
| 19 | Una sola etiqueta: GA4 directo, o Tag Manager si habrá varias etiquetas; nunca ambos duplicados | Recomendado | T |
| 20 | Eventos clave: clic en WhatsApp, teléfono, correo y envío de formulario | Recomendado | T |
| 21 | Medición comprobada en tiempo real (Realtime o DebugView) | Recomendado | A |
| 22 | Tráfico interno y de pruebas excluido | Opcional | A |
| 23 | Pixel de Meta, Clarity u otras solo si hay campañas u objetivo claro | Opcional | A |

## 4. Privacidad
| # | Control | Nivel | Quién |
|---|---|---|---|
| 24 | Si hay medición o cookies no esenciales: aviso de consentimiento y bloqueo hasta aceptar (Consent Mode v2 si es Google). Qué exige la ley es **decisión del responsable** | Mínimo si hay medición | T/A |
| 25 | Política de privacidad publicada si el sitio recoge datos (formularios, medición) | Mínimo si recoge datos | A/T |

## 5. Rendimiento
| # | Control | Nivel | Quién |
|---|---|---|---|
| 26 | PageSpeed o Lighthouse en móvil y escritorio, con puntajes registrados | Recomendado | O |
| 27 | Core Web Vitals (LCP, INP, CLS) sin problemas graves | Recomendado | T/O |
| 28 | Imágenes en formato eficiente, con tamaño adecuado, `srcset` (tamaños adaptables) y carga diferida (`loading="lazy"`), salvo la imagen principal (LCP), que no se difiere; fuentes livianas | Recomendado | T |
| 29 | Scripts de terceros medidos: cada etiqueta nueva no empeora la carga | Recomendado | T |

## 6. Experiencia y accesibilidad
| # | Control | Nivel | Quién |
|---|---|---|---|
| 30 | Revisado a 320, 390 y 1440 px, sin desbordes ni cortes | Mínimo | T |
| 31 | Contraste, foco visible y teclado (skill WCAG del responsable si existe); los textos alternativos, en el control 50 | Mínimo | T |
| 32 | Navegadores acordados probados | Recomendado | O |

## 7. Formularios y contacto
| # | Control | Nivel | Quién |
|---|---|---|---|
| 33 | Cada formulario probado con un envío real de punta a punta | Mínimo | T |
| 34 | El correo de ese envío llega a la bandeja correcta | Mínimo | A |
| 35 | Enlaces de WhatsApp, teléfono y correo correctos | Mínimo | T |
| 36 | Sin textos de prueba ni enlaces rotos (`lychee`) | Mínimo | T/O |
| 37 | Protección contra spam en formularios | Recomendado | T |
| 38 | SPF, DKIM y DMARC si el dominio envía correo | Recomendado | A |

## 8. Seguridad
| # | Control | Nivel | Quién |
|---|---|---|---|
| 39 | Sin secretos en código ni assets (`gitleaks`) | Mínimo | T |
| 40 | Dependencias sin vulnerabilidades altas (`npm audit` o equivalente) | Recomendado | T |
| 41 | Cabeceras de seguridad HTTP | Recomendado | T |

## 9. Después de publicar
| # | Control | Nivel | Quién |
|---|---|---|---|
| 42 | Recorrido en producción de lo crítico: portada, contacto, formulario | Mínimo | T |
| 43 | Aviso si el sitio se cae (uptime) | Recomendado | A |
| 44 | Alertas de vencimiento de dominio y certificado | Recomendado | A |
| 45 | Accesos del dueño del sitio a todas las cuentas (Google, Cloudflare, dominio) | Recomendado | A |
| 46 | Conformidad final del cliente, si es un sitio para un tercero | Mínimo para terceros | A |
| 56 | Las páginas que deben aparecer quedan indexadas, comprobado con la inspección de URL o el informe de páginas de Search Console | Recomendado | A |

## 10. Contenido (SEO de contenido)
Cómo se escribe cada página (y qué datos pide el trabajador al responsable sin inventarlos): `C:\repos\creador\templates\contenido-web.md`; léela al escribir o auditar el contenido de una landing.
| # | Control | Nivel | Quién |
|---|---|---|---|
| 47 | Cada página tiene una búsqueda objetivo escrita (lo que una persona teclearía), distinta a la de las otras páginas | Recomendado | T |
| 48 | Título, H1 y primer párrafo dicen lo mismo que esa búsqueda, en lenguaje natural y sin repetir palabras clave | Recomendado | T |
| 49 | Texto original y útil: sin relleno, sin copiar de otros sitios y sin texto generado que nadie revisó; los datos del negocio los entregó el responsable | Mínimo | T |
| 50 | `alt` descriptivo en cada imagen con contenido (vacío en las decorativas) y nombre de archivo descriptivo | Mínimo | T |
| 51 | Enlaces internos entre páginas relacionadas, con texto que se entiende solo (no «haz clic aquí»); ninguna página importante sin enlace desde otra | Recomendado | T |

## 11. SEO local (solo si el negocio tiene lugar o zona de atención; si no, `—` con el motivo)
| # | Control | Nivel | Quién |
|---|---|---|---|
| 52 | Perfil de Google Business verificado, a nombre del dueño, con datos completos y exactos | Recomendado | A |
| 53 | Nombre, teléfono y, si hay local abierto al público, dirección coherentes entre el sitio y los perfiles. Si atiende en una zona sin local abierto, **no se publica la dirección** (Google pide ocultarla en el perfil de Google Business; en el sitio tampoco se publica, por privacidad); El responsable decide qué zona declarar | Recomendado | T/A |
| 54 | JSON-LD `LocalBusiness` o su subtipo más específico (p. ej. `LegalService`) con datos reales del responsable, nunca inventados, y coincidentes con lo visible. Google exige `name` y `address` para ser elegible al resultado enriquecido (no dice que marcar sin ella sea inválido); por método, sin dirección pública no se marca y va `—` con ese motivo. No marcar reseñas propias («self-serving») en `LocalBusiness` ni en `Organization` | Recomendado | T |

## Entrega

Guarda el resultado en `docs/PUBLICACION-CHECKLIST.md` del proyecto (lo escribe el trabajador; reemplaza el anterior, con fecha). El orquestador le pasa los resultados `O` (comando y resultado) y el trabajador los registra ahí en un commit de la rama antes de dar el PR por listo. Arriba, el resumen: cuántos Mínimos faltan y cuáles son del responsable. Los pasos `A` van en **una sola solicitud** al responsable, agrupados por cuenta, con instrucciones paso a paso.
