# ComePayá — Especificación del proyecto

> Documento de partida para el desarrollo. Recoge la visión, las decisiones tomadas, las propuestas pendientes de confirmar y el plan por fases. Cualquier agente que trabaje en el repositorio debe leerlo antes de empezar.

---

## 1. Visión

Web/app de uso doméstico (una pareja al principio, ampliable a otros familiares, cada uno con su propio hogar), desplegada en servicios gratuitos, para gestionar en un solo sitio:

1. **Despensa**: inventario de lo que hay en casa (nevera, congelador, despensa), con caducidades.
2. **Lista de la compra**: generada automáticamente a partir del menú y del stock, más entradas manuales.
3. **Menú semanal**: planificación de **comidas y cenas** (14 franjas por semana) a partir de un recetario propio.
4. **Salud**: saber cómo de sano es cada producto, cada plato y el conjunto de la semana.

Debe usarse cómodamente desde el móvil, incluido escanear códigos de barras con la cámara para no meter productos a mano. Es una PWA: la misma app sirve como web en el ordenador y como app instalada en el móvil (los usuarios actuales usan Android).

---

## 2. Estado de las decisiones

### Decidido

- La app cubre despensa + lista de la compra + menú semanal (comidas y cenas).
- **Escaneo de códigos de barras** con la cámara del móvil, estilo Yuka, pero cada escaneo **añade el producto al inventario**.
- Al escanear aparece un **diálogo para indicar la caducidad** (ver §7).
- Se muestra **información nutricional y valoración de salud** de los productos (ver §8).
- **Las recetas las crea el usuario a mano**, con ingredientes, cantidades y tiempos. No se generan recetas con IA como base del sistema.
- **Stack y despliegue gratuitos** (ver §10): PWA con React en Vercel + Supabase (Postgres, Auth, Realtime, Storage). Decidido el 2026-11-01.
- **Login con Google** (SSO) mediante Supabase Auth.
- **Multi-hogar**: cada usuario pertenece a uno o varios hogares; los datos de despensa, recetas, menú y lista son del hogar. Se entra en un hogar existente con un código de invitación.

### Propuesto, pendiente de confirmar

- Procesado del ticket de compra para cargar la despensa (ver §7.4).

> Regla para el agente: no tomar como definitivo nada de esta sección sin confirmarlo con el usuario.

---

## 3. Flujo central

Los módulos se alimentan entre sí:

1. El usuario planifica la semana asignando recetas a las franjas (comida/cena).
2. La app calcula los ingredientes necesarios (escalados a las raciones de cada franja), **resta lo que hay en la despensa** y genera la lista de la compra con lo que falta.
3. Los ingredientes con **stock mínimo** que estén por debajo del umbral se añaden solos a la lista.
4. Tras la compra, lo marcado como comprado pasa a la despensa.
5. Al marcar un plato como cocinado, se descuentan sus ingredientes de la despensa (opcional y corregible: en la práctica nadie pesa lo que usa).
6. Las sobras de una receta pueden cubrir otra franja (p. ej., cena del lunes → comida del martes) o congelarse como ración.

---

## 4. Funcionalidades por módulo

### 4.1 Despensa
- Alta por escaneo (principal) o manual.
- Ubicación: nevera, congelador, despensa.
- Cantidad y caducidad por lote (un mismo producto puede tener varios lotes con fechas distintas).
- Avisos de caducidad próxima.
- **Ingredientes básicos "siempre disponibles"** (sal, aceite, especias, ajo…): no se inventarían al gramo y nunca cuentan como faltantes.
- **Raciones congeladas** de comida ya cocinada como elementos del inventario, con fecha.
- Al retirar algo: distinguir **consumido** vs **tirado** (registro de desperdicio).
- **Alta rápida de frescos** (sin código de barras): cuadrícula de ingredientes por sección (fruta y verdura, carnicería, pescadería, panadería, charcutería), cantidades rápidas (unidades o 250 g–2 kg), ubicación y caducidad propuestas. Cada ingrediente usa un producto "a granel" sin marca ni código.
- **Repartir un lote**: mover parte de las unidades a otra ubicación ("2 de los 6 yogures a la nevera"); si en el destino hay un lote igual (misma caducidad y estado), se suman.
- Caducidades rápidas: +3 días, +1 semana, +15 días, +1 mes, +2 meses, +3 meses, +6 meses, sin caducidad o "ya caducado". La fecha exacta admite año opcional para fechas pasadas.
- **Empezados**: en un lote se marca cuánto queda (¼, ½, ¾). Si estaba cerrado se abre un envase (separado del resto, con la caducidad tras abrir) y lo gastado cuenta como consumido. La despensa y la ficha muestran "empezado, queda ½".
- Ordenar la despensa por caducidad, por nombre o por tipo de alimento (sección, en el orden de la tienda) y filtrarla por tipo.
- **Cambiar cuánto hay**: en el panel de un lote, el contador «Cuántos hay» (en envases, o en unidades si el ingrediente va por unidades) con «Guardar»; queda como ajuste y se ve al momento en los móviles del resto. Con 0, el lote se quita.
- **Deshacer**: consumir, tirar, guardar la cantidad, mover, abrir, marcar empezado, cambiar la caducidad, cocinar un plato, vaciar una franja, usar o tirar una ración congelada, quitar de la lista y borrar un ingrediente muestran un aviso con «Deshacer» (8 s). En la despensa, deshacer compara los lotes de antes, de justo después y de ahora (`planDeshacer` en `src/dominio/deshacer.ts`): solo revierte lo que hizo esa acción, sin pisar lo que otro móvil haya hecho entretanto, y borra los movimientos apuntados para que no cuenten en las estadísticas. «Guardar compra» también se puede deshacer.

### 4.2 Lista de la compra
- Entradas automáticas (desde el menú y el stock mínimo) y manuales (texto libre).
- **Agrupada por secciones del súper**, en el orden de recorrido de la tienda; orden configurable por tienda.
- **Funciona sin conexión** (PWA) y sincroniza después.
- Compartida en tiempo real entre los miembros del hogar (Supabase Realtime).
- Lo comprado pasa a la despensa.
- Lo que ya está pendiente no se duplica al añadirlo otra vez (aviso con «Añadir otro»). Desde una receta, «Añadir lo que falta a la lista» apunta lo que no llega para las raciones elegidas, con deshacer.
- La cantidad escrita ("2 kg", "x6", "1,5 l") se guarda también como número en la unidad del ingrediente (`cantidadEnBase`), y es lo que entra en la despensa al guardar la compra. Editar la cantidad de un elemento automático lo pasa a manual.

### 4.2.1 Reglas de la lista generada (implementadas en la fase 2)
- Se calcula con las franjas desde hoy y los 7 días siguientes, bajo demanda («Completar desde el menú»).
- Faltante por ingrediente = lo que pide el menú − stock, más lo necesario para que **después de cocinar** quede el stock mínimo. Origen "menú" si el menú no queda cubierto; si no, "mínimo".
- Los ingredientes opcionales de las recetas no cuentan; los básicos "siempre disponibles" nunca faltan.
- Solo se regeneran los elementos automáticos pendientes. Los manuales no se tocan, lo ya marcado como comprado cuenta como disponible y no se duplica lo que alguien apuntó a mano.
- "Guardar compra" pasa lo marcado a la despensa: elige el producto más reciente del ingrediente (o crea uno genérico), envases para cubrir la cantidad, ubicación según la sección (congelados → congelador; frescos y lácteos → nevera; resto → despensa) y la caducidad habitual del producto.

### 4.3 Recetario
- Recetas creadas por el usuario: nombre, raciones, ingredientes con cantidad y unidad, pasos, tiempo de preparación y de cocción, etiquetas.
- Campo de **preparación previa** (p. ej., "sacar del congelador 12 h antes", "remojo 12 h").
- Pasos con **temporizador opcional** asociado (duración y nombre).
- **Escalado de raciones**.
- **Notas** libres por receta ("la próxima vez menos sal").
- Valoración del usuario.
- Exportar/importar recetas en **Markdown con frontmatter** (legible y versionable en Git).
- En la receta, cada ingrediente se marca si hay suficiente en casa (o si es básico). Al tocarlo se ve cuánto hay, se puede marcar como básico ("siempre hay en casa") y **unir con un producto** de la despensa, de ahora o comprado antes, cuando es lo mismo con otro nombre ("Gnochi" de la receta y "Ñoquis" de la despensa). Unir dos ingredientes pasa recetas, productos con sus lotes y lista al ingrediente del producto, convirtiendo cantidades (g y ml se toman iguales; entre unidades y peso se pregunta cuánto es una unidad), y borra el otro, todo en una transacción (función SQL `unir_ingredientes`). También desde la ficha del ingrediente.

### 4.4 Menú semanal
- Vista semanal con 14 franjas (comida y cena de lunes a domingo).
- Franjas marcables como "fuera de casa" (no se planifican).
- Raciones por franja (por defecto, los comensales del hogar); soporte de sobras: una franja de sobras no cocina y sus raciones se suman a las de la franja origen.
- Al marcar un plato como cocinado se descuentan sus ingredientes de la despensa (opcional), gastando primero lo que antes caduca. Desmarcarlo no los devuelve.
- Sugerencias de recetas (ver §9).
- Vista de **equilibrio semanal** (ver §8.3).
- Opcional: publicar el menú como feed iCal.
- **Menú de bebé** (Ajustes → Bebé, con su nombre): cada día tiene además la comida y la cena del bebé (1 ración por defecto). Para él se proponen las recetas con la etiqueta «bebé» (si no hay ninguna, todas) y las de bebé no se proponen para la casa; la planificación automática y el equilibrio semanal son solo de la casa. Sus platos cuentan para la lista y se descuentan de la despensa como el resto. Se lleva qué alimentos ha probado ya (`ingrediente.bebe_introducido`): al elegir un plato se avisa de lo que sería la primera vez (con sus alérgenos) y al marcarlo cocinado queda apuntado; también se marca a mano en Ajustes → Lo que ha probado o en la ficha del ingrediente. Hoy y el feed iCal muestran también sus comidas.

### 4.5 Modo cocina
- Pantalla que no se apaga (Wake Lock API).
- Texto grande, un paso cada vez, avance con un toque.
- Temporizadores con nombre lanzados desde los pasos; varios simultáneos.
- Desde una comida de Hoy, «Terminar y apuntar» lleva a esa comida del menú para marcarla como cocinada (y descontar la despensa).

### 4.6 Recordatorios
- La noche anterior (o con la antelación indicada en la receta): avisos de preparación previa del menú del día siguiente.
- Caducidades próximas.
- Canal: notificaciones push de la PWA, disparadas cada hora por `pg_cron` en Supabase (el cron de Vercel Hobby solo permite una ejecución diaria); opcionalmente bot de Telegram (fase posterior).

### 4.7 Estadísticas (fase posterior)
- Gasto mensual y coste por ración (si se guardan precios).
- Desperdicio: qué se tira y por qué.
- Platos más cocinados.
- Cumplimiento de las reglas de equilibrio a lo largo del tiempo.

### 4.8 Navegación y búsqueda
- Sin sesión: landing pública (`/bienvenida`, también accesible con sesión) y login con Google en `/entrar`.
- Escritorio: barra lateral (selector de hogar, secciones con contadores de lista y caducidades, herramientas, ajustes) y barra superior (buscador, escanear, campana de caducidades, menú de cuenta). Móvil: barra superior compacta y navegación inferior.
- Buscador global (Ctrl/⌘+K o la lupa): recetas, productos (con cuántos hay en casa), ingredientes, pantallas y acciones; sin tildes ni mayúsculas y exigiendo todas las palabras. Lo que no encuentra se puede añadir a la lista con ↵.
- Recorrido guiado la primera vez que se entra (se puede repetir desde el menú de cuenta) y tarjeta de "Primeros pasos" en Hoy: añadir a la despensa, guardar una receta, planificar, hacer la lista, invitar a la familia y activar avisos. Lo hecho se recuerda por hogar y la tarjeta se puede cerrar.

- Móvil con aspecto de app nativa: cada pantalla tiene su barra de app (título grande que pasa a la barra al desplazar, flecha de volver, acciones con icono), la navegación inferior solo en las cinco pantallas principales, listas agrupadas con separadores, botón flotante para la acción principal (Despensa, Recetas), campo de añadir de la lista abajo y botón de cocinar fijo en la receta. Transiciones al abrir pantallas y desplazamiento recordado al volver.

### 4.9 Caché y sincronización
- Los datos del hogar se guardan en el dispositivo (IndexedDB) durante 7 días: la app abre al instante y funciona sin conexión.
- Una sola suscripción de Supabase Realtime por hogar refresca, en cualquier pantalla, lo que cambia otro miembro (lista, despensa, menú, raciones, recetas e ingredientes). Por eso los datos se consideran frescos 5 minutos; al reconectar o al volver tras más de un minuto en segundo plano se vuelve a pedir todo.
- El service worker guarda las fotos de productos, recetas y avatares (hasta 400, 60 días) para verlas sin conexión.
- **Varios móviles a la vez**: también llegan al momento los cambios de hogar (comensales, bebé, alérgenos), miembros, productos, tiendas, reglas y "no me apetece". `aplicar_cambios_despensa` no deja guardar dos veces la misma compra ni cocinar dos veces la misma franja, y falla si un lote o una ración ya no existe (en vez de guardar sobre nada); las raciones congeladas cambian con deltas. El panel de un lote sigue al lote real y avisa si otro móvil lo ha quitado. Los errores se muestran en español (sin conexión, sesión caducada, permisos…).
- **No perder lo escrito**: las hojas con cambios sin guardar no se cierran al deslizar ni al tocar fuera (aparece «Descartar», que pregunta). El editor de recetas guarda un borrador en el móvil y lo ofrece al volver; al salir con cambios, pregunta. Los botones de guardar no se desactivan: al pulsarlos dicen qué falta.
- **Sin red o con mala cobertura**: si el token caducó (dura una hora) y no hay red, la app abre igualmente con la sesión guardada y lo que hay en el móvil, y la renueva al volver la red. Toda petición a Supabase tiene un tiempo límite (15 s; 60 s al subir fotos) y lo de la lista se reintenta con espera creciente, así que con mala señal no se pierde ni se queda colgado. Fuera de la lista se avisa «Sin conexión: ves lo guardado en este móvil». El motor del escáner de iPhone (WebAssembly) se sirve desde la app y se guarda la primera vez que se usa.
- **Funciones de servidor**: sesión obligatoria (en producción, sin Supabase configurado no se abren) y límite por usuario y hora (`uso_api`: importar 30, producto 300, Mercadona 120). La comprobación de direcciones del importador entiende IPv6 con IPv4 dentro (`::ffff:…`, NAT64, 6to4) para no llegar a la red interna.
- **Arranque**: solo Hoy va en el JavaScript inicial; el resto de pantallas se descarga al abrirla y las pestañas principales se precargan en reposo. Las animaciones (Motion) cargan su motor después (`LazyMotion`).

---

## 5. Modelo de datos

### Principio clave: ingrediente ≠ producto
- **Ingrediente**: concepto genérico que usan las recetas ("leche", "tomate triturado").
- **Producto**: artículo concreto con código de barras ("Leche semidesnatada Hacendado 1 L").
- Cada producto apunta a un ingrediente. La despensa guarda productos; las recetas piden ingredientes. Así dos marcas de leche cubren la misma necesidad.

### Unidades
- Cada ingrediente tiene una **unidad base**: gramos, mililitros o unidades.
- Cada producto declara cuánto contiene en esa unidad base (p. ej., lata = 400 g).
- Lo que en casa se cuenta por piezas (patata, cebolla, tomate, zanahoria, pimientos, calabacín, berenjena, brócoli, coliflor, melón, y la fruta que ya lo estaba) va **por unidades**, con su peso medio para la nutrición; lo suelto o en bandeja (espinacas, judías verdes, champiñones, fresas…) sigue en peso. Si un hogar los tiene en gramos, Despensa y Ajustes → Ingredientes ofrecen pasarlos a unidades de una vez. La unidad de un ingrediente en uso se puede cambiar desde su ficha: se convierten recetas, lotes, envases, lista, stock mínimo y medidas caseras (entre unidades y peso, con el peso de una pieza), en una transacción (función SQL `cambiar_unidad_ingrediente`).
- Todas las cantidades internas se guardan en unidad base. No implementar conversiones "mágicas" (cucharadas, tazas) en las primeras fases.

### Hogar (multi-cuenta)
- Un **hogar** junta los datos de dos o más cuentas (p. ej., una pareja). Todos sus miembros ven y editan lo mismo: despensa, ingredientes, productos, recetas, menú, lista y tiendas.
- Al entrar por primera vez, el usuario **crea un hogar** o **se une a uno** con su código de invitación (visible en Ajustes para compartirlo).
- Un usuario puede pertenecer a varios hogares (p. ej., el suyo y el de sus padres) y elegir el activo.
- Todas las tablas de datos llevan `hogar_id` y se protegen con Row Level Security: solo los miembros del hogar pueden leer o escribir sus filas.
- Lo único compartido entre hogares es `CatalogoEan`: la caché de datos externos por código de barras (Open Food Facts, Mercadona). Así un producto escaneado por un hogar ya no se vuelve a consultar fuera.

### Entidades (borrador)

| Entidad | Campos principales |
|---|---|
| `Hogar` | id, nombre, codigo_invitacion (único), comensales (raciones por defecto de cada franja), aditivos_vigilados, ical_token, bebe_nombre (menú de bebé; null si no hay), creado_por, fecha_alta |
| `Miembro` | hogar_id, user_id (Supabase Auth), nombre, email, rol (admin / miembro), fecha_alta |
| `CatalogoEan` (global) | ean, nombre, marca, cantidad_texto, foto_url, nutrientes_100, nutriscore, nova, niveles_nutrientes, aditivos, completitud_datos, fuente, actualizado |
| `Ingrediente` | id, hogar_id, nombre, unidad_base, seccion_super, grupo_alimento (legumbre, pescado, carne_roja, carne_blanca, verdura, fruta, cereal, lacteo, ultraprocesado…), siempre_disponible (bool), stock_minimo (opcional), emoji, peso_unidad_g (para nutrientes de lo que va por unidades), nutrientes_100 (de BEDCA o media de sus productos), caducidad_defecto_dias (opcional), bebe_introducido (fecha en que el bebé lo probó) |
| `Producto` | id, hogar_id, ean (único por hogar, nullable), nombre, marca, cantidad_envase (en unidad base), ingrediente_id, nutrientes_100, nutriscore, nova, niveles_nutrientes, aditivos, completitud_datos, fuente (openfoodfacts / mercadona / manual), foto, caducidad_habitual_dias (aprendida) |
| `LoteDespensa` | id, producto_id, cantidad, ubicacion (nevera / congelador / despensa), fecha_caducidad (nullable), fecha_alta |
| `RacionCongelada` | id, receta_id (nullable), descripcion, raciones, fecha_congelacion |
| `RechazoSugerencia` | receta_id, fecha ("no me apetece": no se sugiere durante 3 días) |
| `SuscripcionPush` / `AvisoEnviado` | dispositivos con avisos activados; avisos ya mandados (solo servidor) |
| `MovimientoDespensa` | id, producto_id, cantidad, tipo (alta / consumo / tirado / ajuste), motivo, fecha |
| `Receta` | id, nombre, raciones, tiempo_prep_min, tiempo_coccion_min, preparacion_previa, preparacion_previa_horas, etiquetas, valoracion, notas, foto_url, fuente_url |
| `RecetaIngrediente` | receta_id, ingrediente_id, cantidad (unidad base), opcional (bool), orden |
| `PasoReceta` | receta_id, orden, texto, temporizador_seg (nullable), temporizador_nombre |
| `FranjaMenu` | id, fecha, tipo (comida / cena), para (casa / bebe; única por fecha, tipo y para), receta_id (nullable), raciones, fuera_de_casa (bool), es_sobra_de (franja_id, nullable), cocinado (bool) |
| `ItemLista` | id, ingrediente_id (nullable), texto, cantidad (texto para mostrar, p. ej. "2 kg"), cantidad_base (numérica, solo en los automáticos), seccion_super, marcado, origen (manual / menu / stock_minimo) |
| `ReglaSemanal` | id, grupo_alimento, minimo_semana, maximo_semana (sin filas, se usan las de referencia AESAN) |
| `Tienda` | id, nombre, orden_secciones |

Salvo `Hogar`, `Miembro` y `CatalogoEan`, todas las entidades llevan `hogar_id`. En `LoteDespensa` la cantidad se guarda en unidad base del ingrediente; la interfaz la muestra también en envases cuando el producto declara `cantidad_envase`.

El modelo es orientativo; ajustarlo durante la implementación y mantener esta tabla actualizada. El esquema real vive en `supabase/migrations/`.

---

## 6. Fuentes de datos externas

### Open Food Facts (fuente principal para productos envasados)
- API abierta y gratuita, búsqueda por EAN: `GET https://world.openfoodfacts.org/api/v2/product/{ean}.json`
- Enviar un `User-Agent` identificativo propio, como pide el proyecto.
- Campos útiles: nombre, marca, cantidad, ingredientes, alérgenos, `nutriments`, `nutriscore_grade`, `nova_group`, `nutrient_levels`, `additives_tags`.
- Datos colaborativos: algunas fichas están incompletas. Guardar un indicador de completitud y no inventar valoraciones cuando falten datos.
- Cubre productos de cualquier supermercado (incluido Carrefour).

### Mercadona (complemento, API no oficial)
- La tienda online expone una API REST interna sin autenticación, usada por varios proyectos de la comunidad:
  - `GET https://tienda.mercadona.es/api/categories/` — categorías
  - `GET https://tienda.mercadona.es/api/categories/{id}/` — productos de una categoría
  - `GET https://tienda.mercadona.es/api/products/{id}/` — detalle
- La búsqueda por texto usa Algolia con credenciales públicas de solo lectura. Referencias: proyectos `mercapy` (Python) y `mercadona-cli`.
- Incluye EAN, por lo que sirve para marcas propias (Hacendado, Deliplus…) que falten en Open Food Facts, y para precios.
- Precios y surtido varían según el almacén/región: se consulta en varios a la vez (`MERCADONA_ALMACENES`, por defecto `vlc1,mad1,bcn1`) y la ficha se pide en el primero que la tenga.
- Su buscador no permite buscar por EAN. Para resolver un código: los de marca propia (`8480000` + id de 5 cifras + control) llevan dentro el id de Mercadona; los de otros fabricantes se apuntan en `CODIGOS_CONOCIDOS` (`api/_lib/mercadona.ts`). En ambos casos se acepta solo si la ficha trae exactamente ese EAN.
- **No es oficial y puede cambiar sin aviso**: aislarla tras un adaptador, cachear resultados y tolerar fallos.

### Carrefour
- Sin API pública de catálogo; la web está protegida contra bots. **No integrar.** Sus productos se cubren vía Open Food Facts por EAN.

### BEDCA (alimentos frescos)
- Base de Datos Española de Composición de Alimentos. Para fruta, verdura, carne y pescado sin código de barras: asociar sus valores a los `Ingrediente` genéricos.

### Orden de resolución al escanear un EAN
1. Productos del hogar (tabla `Producto`).
2. Catálogo compartido (`CatalogoEan`).
3. Open Food Facts.
4. Mercadona (id dentro del código Hacendado o lista de códigos conocidos).
5. Alta manual (nombre + foto, buscando en Mercadona por nombre o tecleando el código si la cámara no lo lee), guardada para siempre.

Las consultas a Open Food Facts y Mercadona se hacen desde funciones de servidor (`/api` en Vercel): el navegador no puede fijar el `User-Agent` y Mercadona no admite CORS.

---

## 7. Escaneo

### 7.1 Escaneo continuo
- Cámara abierta; se pasan productos uno tras otro sin pulsar nada entre medias. Confirmación con sonido y vibración.
- Escanear dos veces el mismo producto suma una unidad.
- Al empezar la sesión se elige la **ubicación** (nevera / congelador / despensa); todo lo escaneado va ahí.
- Al terminar, revisión de lo escaneado y confirmación.
- Librería: `barcode-detector`. Usa la API nativa `BarcodeDetector` de Chrome en Android y, donde no existe (Safari/iOS), cae a zxing en WebAssembly.
- En Android: vibración al confirmar y botón de linterna. En iOS ni la vibración ni la linterna están disponibles desde la web.

### 7.2 Diálogo de caducidad
- **Panel inferior (bottom sheet)**, no modal a pantalla completa: la cámara sigue visible y activa.
- Muestra nombre, foto y Nutri-Score del producto.
- **Chips rápidos**: "+3 días", "+1 semana", "+1 mes", "+6 meses", "Sin caducidad".
- Fecha exacta mediante campo numérico día/mes (año deducido), no calendario.
- **Valor preseleccionado**: la caducidad usada la última vez para ese producto; si no existe, la de su categoría/ingrediente.
- **Selector de cantidad** (+/−) en el mismo panel, con opción de dividir en lotes con fechas distintas.
- **Solo para perecederos** (configurable): los no perecederos se añaden directamente con un aviso breve "Añadido · Deshacer".

### 7.3 Limitaciones conocidas
- El EAN-13 no contiene caducidad ni lote. Los códigos GS1 DataMatrix / Digital Link sí, pero son minoría: soportarlos si aparecen es un extra.
- OCR de la fecha impresa: poco fiable. Si se añade, solo como sugerencia prellenada en el campo, nunca bloqueante.

### 7.4 Ticket de compra (propuesto, fase posterior)
- Cargar compras desde el ticket digital (apps de Mercadona/Carrefour) o una foto del ticket, extrayendo líneas con un modelo de visión.
- Las líneas usan nombres abreviados sin EAN: la primera vez se emparejan manualmente con productos y la app **aprende el emparejamiento**.
- Efectos secundarios: histórico de precios y tachado automático de la lista de la compra.

---

## 8. Salud y nutrición

### 8.1 Producto
Mostrar varios indicadores, porque miden cosas distintas:
- **Nutri-Score (A–E)**: composición nutricional. Limitación: compara dentro de la misma categoría (aceite de oliva o queso puntúan mal aunque sean parte de una dieta sana). Mostrar este matiz en la interfaz.
- **NOVA (1–4)**: grado de procesamiento, independiente del Nutri-Score.
- **Niveles de nutrientes** (grasa, saturadas, azúcares, sal: bajo / moderado / alto por 100 g) como semáforo.
- **Aditivos** (E-números), con posibilidad de marcar los que preocupan al usuario.
- Si faltan datos, indicarlo en lugar de dar una nota.

### 8.2 Receta
- Valores por ración calculados sumando los nutrientes por 100 g de sus ingredientes: calorías, proteína, fibra, azúcares, sal.
- **No aplicar Nutri-Score a platos caseros** (no está diseñado para eso).

### 8.3 Semana
- La vista más útil: **equilibrio del plan**, no la nota de cada plato.
- Contar apariciones por `grupo_alimento` (legumbres, pescado, carne roja, verdura, ultraprocesados…) y compararlas con las `ReglaSemanal` configurables (tomar como referencia las recomendaciones de la AESAN).
- Avisos tipo "esta semana no hay pescado" o "tres cenas con precocinados".

---

## 9. Sugerencias de platos

### 9.1 Puntuación de recetas propias
Suma ponderada, con pesos configurables, de:
- **Disponibilidad**: % de ingredientes en despensa (ponderando más los principales que los opcionales; los "siempre disponibles" no cuentan).
- **Caducidad**: bonus fuerte si usa productos que caducan pronto.
- **Equilibrio semanal**: bonus si cubre un grupo que falta, penalización si supera un máximo.
- **Variedad**: penalización si se cocinó recientemente.
- **Contexto**: tiempo de preparación según el día (rápido entre semana, elaborado en fin de semana).
- **Valoración** del usuario.

Las sugerencias deben ser **explicables**: mostrar el motivo ("tienes chorizo que caduca el jueves y esta semana no hay legumbre").

### 9.2 Aprendizaje
- Guardar valoraciones y rechazos ("no me apetece") desde el principio para ajustar sugerencias en el futuro.

### 9.3 Planificación semanal automática (propuesto, fase posterior)
- Algoritmo voraz: rellenar franja a franja con la mejor receta y recalcular tras cada elección (ingredientes consumidos, grupos cubiertos).
- Alternativa: programación lineal entera (OR-Tools o PuLP) con las reglas como restricciones.
- Tener en cuenta sobras y franjas fuera de casa.

### Fuera de alcance por ahora
- Generación de recetas con IA (decidido por el usuario: las recetas las crea él).

---

## 10. Stack técnico (decidido el 2026-11-01)

Todo en planes gratuitos.

- **Frontend**: PWA con React + TypeScript + Vite, `vite-plugin-pwa`, Tailwind CSS, componentes estilo shadcn/ui (Radix), Vaul para paneles inferiores, Sonner para avisos, Motion para animaciones, iconos Lucide. Diseño responsive: navegación inferior en móvil y lateral en escritorio.
- **Datos y acceso**: TanStack Query; el cliente habla directamente con Supabase (`supabase-js`) y la seguridad la pone Row Level Security por hogar.
- **Supabase** (plan gratuito): Postgres, Auth con Google, Realtime (lista compartida), Storage (fotos de productos manuales), `pg_cron` para recordatorios.
- **Funciones de servidor**: carpeta `/api` desplegada como Vercel Functions (Node). Conectores de Open Food Facts y Mercadona y envío de notificaciones push.
- **Hosting**: Vercel (plan Hobby, uso personal no comercial).
- **Lógica de dominio** en TypeScript puro (`src/dominio/`), sin dependencias de React ni Supabase, con tests en Vitest.
- **Escaneo**: `barcode-detector` (ver §7.1).
- **Mantenimiento**: GitHub Actions semanal que hace una consulta a Supabase (el plan gratuito pausa el proyecto tras 7 días sin actividad) y un `pg_dump` como copia de seguridad (el plan gratuito no tiene copias automáticas).
- **Migraciones**: al subir a `main` una migración nueva, GitHub Actions (`migraciones.yml`) aplica las pendientes con `scripts/aplicar-migracion.mjs`, cada una en una transacción, y las apunta en `control.migracion` (esquema que la API no expone). Vercel despliega a la vez, así que cada migración debe ser compatible con el código anterior. Ambos workflows usan el secreto `SUPABASE_DB_URL`.
- **Integraciones externas** detrás de adaptadores con caché y tolerancia a fallos.
- **Límites a vigilar**: 500 MB de base de datos y 1 GB de Storage en Supabase; el cron de Vercel Hobby es diario como mucho.

---

## 11. Plan por fases

0. **Base**: proyecto, login con Google, hogares con código de invitación, despliegue en Vercel + Supabase, PWA instalable y una página de prueba de escaneo (cámara + Open Food Facts) para validar el escaneo en los móviles reales antes de la fase 3.
1. **MVP**: despensa con alta manual (ingredientes, productos, lotes, ubicaciones, caducidades) y lista de la compra manual agrupada por secciones.
2. **Recetario y menú**: recetas propias, menú semanal (comidas y cenas), generación de la lista restando la despensa, stock mínimo, básicos siempre disponibles.
3. **Escaneo**: escaneo continuo, diálogo de caducidad, Open Food Facts y Mercadona, alta manual de desconocidos.
4. **Salud**: indicadores por producto, nutrientes por receta, BEDCA para frescos, equilibrio semanal y reglas.
5. **Cocina y recordatorios**: modo cocina, temporizadores, escalado de raciones, preparación previa, avisos de caducidad, offline de la lista.
6. **Sugerencias**: puntuación explicable de recetas.
7. **Extras**: ticket de compra, raciones congeladas, desperdicio, estadísticas, planificación automática, lista compartida, feed iCal, bot de Telegram, exportación Markdown.

**Estado (2026-11-01)**: fases 0 a 6 implementadas y la fase 7 salvo lo indicado abajo. Pendiente de desplegar y probar con Supabase real (la interfaz se ha revisado con datos simulados; el escáner y las notificaciones push solo pueden probarse en un móvil).

Decisiones tomadas durante la implementación:
- **Mercadona** no permite buscar por EAN (la búsqueda pública no lo indexa y los listados no lo incluyen). Se usa como búsqueda por nombre dentro del alta manual de un código desconocido; el emparejamiento código → producto se guarda en `CatalogoEan` para todos los hogares.
- **BEDCA** no tiene una API sencilla: los nutrientes de los frescos se introducen a mano por ingrediente (la interfaz enlaza a bedca.net) o salen de la media de sus productos escaneados.
- **Fotos** de productos manuales: se usan las de Open Food Facts o Mercadona; subir fotos propias queda pendiente.
- **Escaneo**: cada producto se añade al confirmar su panel (o directamente, si no necesita caducidad), con "Deshacer" en la lista de la sesión, en lugar de una revisión final.
- **Temporizadores**: siguen la hora real, pero el aviso solo suena con la app abierta (la pantalla no se apaga en modo cocina).

Mejoras posteriores (2026-11-01):
- **Pantalla «Hoy»** como inicio: comida y cena de hoy, preparación previa, lo que caduca y la lista.
- **Fichas** de producto (lotes, salud, historial, edición), de ingrediente (stock, productos, recetas, nutrientes) y catálogo de productos; los lotes se pueden corregir (caducidad y cantidad, registrado como ajuste).
- **Ingredientes habituales precargados** al crear el hogar (unos 120, con sección, grupo, caducidad orientativa, peso por unidad e icono; sin nutrientes inventados). Un ingrediente nuevo con nombre conocido hereda esos datos.
- **Despensa agrupada por producto**, con iconos por ingrediente en despensa, lista, menú y recetas.
- **Fotos de recetas** (Supabase Storage, reducidas en el móvil) e **importación desde una web** que publique schema.org/Recipe. No contradice "las recetas las crea el usuario": no se genera nada, se copia lo que publica la web y se revisa en el editor (las medidas caseras se convierten de forma aproximada y se marcan para revisar).
- Tipografía propia (Inter y Fraunces, incluidas en la app), esqueletos de carga, diálogos de confirmación propios y carga diferida de las pantallas menos usadas.

Calidad y mejoras (2026-11-01, segunda tanda):
- Revisión de código independiente: 20 fallos arreglados (SSRF en la importación, catálogo compartido sobrescribible, lista sin conexión desordenada, operaciones de despensa no atómicas, duplicados al reintentar, etc.).
- Los cambios de despensa que tocan varias filas (cocinar, guardar la compra, escanear, retirar, abrir) van en una sola transacción: función SQL `aplicar_cambios_despensa`, con cambios relativos para no pisar a otro miembro.
- **Modo demo** (`npm run dev:demo`): Supabase simulada en memoria con datos de ejemplo. Base de los **tests de pantalla** (Playwright). **CI** en GitHub Actions: tipos, tests, compilación y tests de pantalla.
- Errores del navegador guardados en `error_cliente`; botón «Reportar un problema» que abre un issue en GitHub con los datos del móvil.
- **Alérgenos** (14 de la UE): del hogar, por ingrediente (manual + productos de Open Food Facts), avisos en productos y recetas; las sugerencias y la planificación excluyen lo que afecta al hogar.
- **Producto abierto**: "Lo he abierto" acorta la caducidad según `dias_tras_abrir` del ingrediente, separa el envase abierto del resto y lo pasa a la nevera.
- **Escáner en modo sacar**: retira un envase por pasada, empezando por lo que antes caduca.
- **Lista**: habituales con un toque, deslizar para quitar, compartir (WhatsApp), dictado por voz.
- **Medidas caseras** en recetas (cucharada, cucharadita, vaso, taza, pizca) con equivalencias por ingrediente.
- Accesos directos al mantener pulsado el icono y contador de caducidades sobre él.
- Funciones de servidor con sesión obligatoria en producción.
- **Planificación automática (§9.3), confirmada**: algoritmo voraz sobre la puntuación de sugerencias; no repite plato en la semana, descuenta lo que gasta cada elección y cubre los grupos que faltan. Botón ✨ en el menú.

Pendiente de la fase 7:
- **Ticket de compra** (§7.4): sin confirmar; con fotos necesitaría un modelo de visión de pago. Alternativa gratuita a estudiar: leer el PDF del ticket digital de Mercadona (hace falta un ticket de ejemplo).
- **Bot de Telegram**: necesita crear el bot y su token.
- **Gasto y coste por ración**: requiere guardar precios.

Prioridad de extras según el usuario se confirme; las tres de más impacto previstas son: recordatorios de preparación previa, modo cocina con temporizadores y lista por secciones con offline.

---

## 12. Indicaciones para el agente

- Leer este documento completo antes de empezar y **mantenerlo actualizado** cuando cambien decisiones o el modelo de datos.
- Confirmar con el usuario lo marcado como "propuesto" antes de implementarlo.
- Avanzar **fase a fase**; cada fase debe dejar la app usable.
- Interfaz en **español**. Uso principal desde el móvil: diseñar mobile-first.
- Priorizar la rapidez de uso en escaneo y lista de la compra (mínimo de toques).
- Tests para la lógica de dominio crítica: cálculo de la lista (necesidades − despensa), unidades, escalado de raciones y puntuación de recetas.
- No integrar Carrefour por scraping. Aislar la API no oficial de Mercadona.
- No inventar valoraciones de salud con datos incompletos.
