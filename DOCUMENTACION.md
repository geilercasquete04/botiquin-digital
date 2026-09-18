# Botiquín Digital — Documentación completa

Aplicación web instalable (PWA) para llevar el inventario del botiquín de
casa: qué hay, dónde está, cuándo vence y cuándo hay que reponerlo. Incluye
recordatorios de toma con alarmas, un diccionario de medicamentos y un
panel de funciones "Plus" protegido con contraseña.

Todo funciona sin conexión y sin servidor: los datos se guardan en el
propio navegador del dispositivo (`localStorage`). No hay backend, ni
nube, ni cuentas de usuario.

---

## 1. Índice

1. Resumen del proyecto
2. Estructura de archivos
3. Cómo se arma la página (orden de carga)
4. Funciones por pestaña
5. El candado de Botiquín Plus
6. Cómo funciona el buscador
7. Instalación como app (PWA) y modo sin conexión
8. Dónde vive cada dato (almacenamiento)
9. Cómo personalizar el proyecto
10. Publicar en GitHub Pages
11. Limitaciones conocidas
12. Solución de problemas
13. Historial de cambios de esta conversación

---

## 2. Estructura de archivos

```
botiquin-app/
├── index.html                 Página única de toda la app
├── botiquin-plus.css          Estilos base (capa original del proyecto)
├── botiquin-app.css           Estilos de la capa "app" (PWA, barra inferior, FAB)
├── botiquin-pro.css           Estilos de Tomas, Diccionario, candado y modo oscuro
├── botiquin-plus-data.js      Checklist ideal, ubicaciones, categorías, formas
├── botiquin-plus.js           Lógica base: inventario, checklist, planes demo
├── botiquin-pro-data.js       Los 40 medicamentos del diccionario
├── botiquin-pro.js            Tomas/alarmas, diccionario, candado, respaldo, buscador
├── botiquin-app.js            Instalación PWA, botón flotante, hoja del formulario
├── manifest.webmanifest       Nombre, ícono y colores de la app instalada
├── sw.js                      Service worker (funcionamiento sin conexión)
├── icons/                     Íconos en varios tamaños
├── LEEME.md                   Guía rápida de publicación en GitHub Pages
└── DOCUMENTACION.md           Este documento
```

**Por qué está dividido así:** los archivos `botiquin-plus.*` son la base
original de tu proyecto. Los archivos `botiquin-pro.*` y `botiquin-app.*`
son capas que se agregaron encima sin reescribir la base, para que en
cualquier momento se pueda quitar una capa (por ejemplo, si algún día no
quieres el candado) borrando su archivo y su línea de carga en
`index.html`, sin tener que tocar el resto.

---

## 3. Cómo se arma la página

Al final de `index.html` los scripts se cargan en este orden, y el orden
importa:

```html
<script src="botiquin-plus-data.js"></script>   1. Datos base (checklist)
<script src="botiquin-pro-data.js"></script>    2. Datos del diccionario
<script src="botiquin-plus.js"></script>        3. Lógica base (define funciones)
<script src="botiquin-pro.js"></script>         4. Sobrescribe/extiende esas funciones
<script src="botiquin-app.js"></script>         5. Capa de instalación y móvil
```

`botiquin-pro.js` toma varias funciones que ya existían (`renderInventory`,
`activateTab`) y las **reemplaza por una versión mejorada** que llama a la
original por dentro. Esto es intencional: así la base no se toca, pero el
comportamiento final es el nuevo. Si alguna vez agregas código nuevo que
también necesite enganchar el buscador o la navegación, tiene que hacerse
*después* de que `botiquin-pro.js` cargue, o el enganche se perderá (así
ocurrió con un bug que se corrigió esta sesión, ver el punto 13).

---

## 4. Funciones por pestaña

### Inventario
- Alta, edición y borrado de productos (nombre, forma, categoría, cantidad,
  unidad, umbral de aviso, vencimiento, ubicación, uso, notas).
- Botones **−/+** en cada fila para ajustar cantidades sin abrir el formulario.
- Chips de filtro rápido: Todos, En orden, Por vencer, Vencidos, Escasos.
- Buscador por nombre, categoría, ubicación, forma, uso o notas.
- Atajos de fecha (+6 meses, +1 año, +2 años) al agregar un producto.
- Autocompletar: si escribes un nombre que existe en el diccionario, la
  forma farmacéutica se sugiere sola.
- Las tarjetas resumen (**Productos registrados**, **Disponibles**,
  **Requieren atención**) se recalculan en cada cambio, sin recargar.

### Checklist ideal
- Lista fija de 12 elementos básicos que todo botiquín debería tener
  (definida en `botiquin-plus-data.js`, variable `CHECKLIST_IDEAL`).
- Se marca solo si detecta en el inventario un producto cuyo nombre
  contiene alguna de las palabras clave de ese elemento.
- También se puede marcar a mano (por si tienes el producto pero con otro
  nombre).

### Tomas y alarmas *(Plus)*
- Recordatorios con hora(s), días de la semana, fecha de inicio y fin
  opcional, dosis y nota.
- Si vinculas el recordatorio a un producto del inventario, al marcar la
  toma como "Tomada" se descuenta la cantidad indicada automáticamente.
- Notificaciones del navegador a la hora programada (ver limitaciones,
  punto 11).
- Resumen de adherencia de los últimos 7 días.

### Diccionario *(Plus)*
- 40 medicamentos y elementos de botiquín con: nombres comerciales, para
  qué sirve, presentaciones y precauciones.
- **A propósito no incluye dosis**: dependen de edad, peso y otros
  medicamentos, y no queríamos que la app diera esa indicación.
- Desde cada ficha, un botón para agregarlo directo al inventario.

### Botiquín Plus
- Panel de "planes demostrativos" (Gratis / Plus) que es solo una
  demostración visual, no cambia funcionalidad real.
- Tarjeta para desbloquear las funciones Plus (ver punto 5).
- Lista de compras automática (agotado, vencido, escaso o falta del
  checklist ideal), con botón para copiarla.
- Exportar el inventario a CSV.
- Respaldo: descargar/restaurar todos los datos en un archivo `.json`.
- Selector de tema: Automático / Claro / Oscuro.

---

## 5. El candado de Botiquín Plus

Las pestañas **Tomas y alarmas** y **Diccionario** están protegidas.

- **Contraseña de demostración: `1234`**
- Se activa desde el interruptor "Funciones Plus" en el menú lateral
  (escritorio) o desde la tarjeta morada del panel Plus (visible también
  en el celular).
- Si alguien intenta entrar a una pestaña bloqueada, la app lo manda al
  panel Plus con un aviso, en vez de mostrar la función.
- El desbloqueo queda guardado en el dispositivo (`localStorage`) hasta
  que alguien lo bloquee de nuevo con el mismo interruptor. Bloquear no
  pide contraseña; solo desbloquear la pide.

**Para cambiar la contraseña:** abre `botiquin-pro.js` y edita esta línea,
cerca del inicio del archivo:

```js
const CLAVE_PLUS = '1234';
```

Importante: esto **no es seguridad real**. La contraseña queda visible en
el código fuente de la página (cualquiera puede abrir las herramientas de
desarrollador del navegador y leerla, o simplemente editar `localStorage`
a mano). Sirve para separar visualmente "lo gratis" de "lo Plus" en una
demostración, no para proteger datos sensibles.

---

## 6. Cómo funciona el buscador

El buscador (tanto del inventario como del diccionario) usa una función
llamada `coincideBusqueda` (en `botiquin-pro.js`) con dos reglas:

1. **Ignora tildes y mayúsculas.** "Acido" encuentra "Ácido
   acetilsalicílico".
2. **Solo coincide con el inicio de una palabra.** Buscar "tos" encuentra
   "Tos" o "tosferina", pero no "adultos" ni "productos" — antes de este
   ajuste, cualquier coincidencia parcial contaba, y eso generaba
   resultados irrelevantes.

Si escribes varias palabras ("dolor cabeza"), deben aparecer todas en
alguna parte del texto (no necesariamente juntas ni en orden).

---

## 7. Instalación como app (PWA) y modo sin conexión

- `manifest.webmanifest` define el nombre, ícono, color y accesos
  directos de la app instalada.
- `sw.js` (service worker) guarda una copia de todos los archivos la
  primera vez que se visita la página, para que funcione sin conexión
  después.
- **Todo esto solo funciona con HTTPS** (o `localhost`). Abrir el archivo
  con doble clic (`file://`) muestra el diseño, pero no se puede instalar.
- **Android/Chrome:** botón "Instalar app" en la barra superior, o menú
  ⋮ → Instalar aplicación.
- **iPhone/Safari:** botón Compartir → Agregar a pantalla de inicio.
- **Cada vez que subas cambios**, sube el número de versión en la primera
  línea de `sw.js` (`const VERSION = 'botiquin-v4'` → `v5`, etc.). Si no lo
  haces, quien ya tenga la app instalada seguirá viendo la versión vieja
  guardada en su dispositivo.

---

## 8. Dónde vive cada dato

Todo se guarda en el `localStorage` del navegador, por dispositivo (no se
sincroniza entre celular y computador). Estas son las claves usadas:

| Clave | Contenido | Definida en |
|---|---|---|
| `botiquin_plus_inventory_v1` | Productos del inventario | botiquin-plus.js |
| `botiquin_plus_checks_v1` | Marcas manuales del checklist | botiquin-plus.js |
| `botiquin_plus_preferences_v1` | Publicidad, plan demo, resumen semanal | botiquin-plus.js |
| `botiquin_tratamientos_v1` | Recordatorios de tomas creados | botiquin-pro.js |
| `botiquin_tomas_v1` | Registro de tomas marcadas/omitidas | botiquin-pro.js |
| `botiquin_pro_prefs_v1` | Tema, notificaciones, candado Plus | botiquin-pro.js |
| `botiquin_ios_tip_v1` | Si ya se mostró el aviso de instalación en iPhone | botiquin-app.js |

El botón **Respaldo → Descargar copia** (panel Plus) exporta todas estas
claves relevantes en un solo archivo `.json`, y **Restaurar copia** las
vuelve a cargar.

---

## 9. Cómo personalizar el proyecto

**Agregar un medicamento al diccionario** — edita `botiquin-pro-data.js` y
agrega un objeto siguiendo el mismo patrón que los demás (nombre, otros
nombres, categoría, si necesita receta, para qué sirve, presentaciones,
precauciones).

**Agregar un elemento al checklist ideal** — edita `botiquin-plus-data.js`,
arreglo `CHECKLIST_IDEAL`.

**Cambiar colores** — las variables de color están al inicio de
`botiquin-plus.css` (busca `:root`). El modo oscuro redefine las mismas
variables dentro de `body.tema-oscuro` en `botiquin-pro.css`.

**Cambiar la contraseña de Plus** — ver punto 5.

**Quitar el candado por completo** — en `botiquin-pro.js`, borra el bloque
que empieza en el comentario `Candado de Botiquín Plus` y reemplaza
`plusDesbloqueado()` por algo que siempre retorne `true`. También puedes
quitar el interruptor y la tarjeta del `index.html`.

---

## 10. Publicar en GitHub Pages

1. Crea un repositorio público en GitHub.
2. Sube **el contenido** de la carpeta `botiquin-app` (no la carpeta en
   sí) a la raíz del repositorio — `index.html` debe quedar suelto en la
   raíz, no dentro de una subcarpeta.
3. Ve a **Settings → Pages**, elige la rama `main`, carpeta `/ (root)`, y
   guarda.
4. Espera uno o dos minutos y abre el enlace que aparece:
   `https://tuusuario.github.io/nombre-del-repo/`.

El archivo `LEEME.md` incluido tiene el paso a paso más detallado, con
capturas descritas para quien nunca ha usado GitHub.

---

## 11. Limitaciones conocidas

- **Las alarmas necesitan la app abierta o en segundo plano.** Si el
  sistema operativo cierra la app por completo, la notificación no suena;
  al volver a abrirla, verás las tomas atrasadas marcadas en rojo.
  Alarmas garantizadas con la app cerrada requieren un servidor de
  notificaciones push o una app nativa — esto no es posible con una PWA
  simple sin backend.
- **No hay sincronización entre dispositivos.** Cada celular u ordenador
  tiene su propio inventario. El respaldo en JSON es la forma de pasar
  datos de uno a otro.
- **El candado no es seguridad real** (ver punto 5).
- **El diccionario es información general**, no reemplaza una consulta
  médica ni farmacéutica, y no incluye dosis a propósito.

---

## 12. Solución de problemas

**"No veo el botón de agregar producto en el celular"** — corregido en
esta sesión (ver punto 13). Actualiza a la versión más reciente.

**"Instalé la app pero no veo los cambios que acabo de subir"** — el
service worker guarda una copia local. Sube el número de `VERSION` en
`sw.js` cada vez que publiques cambios (punto 7), o borra y reinstala la
app para forzar la actualización.

**"El diccionario o las tomas no abren"** — están protegidas por el
candado de Plus. Desbloquéalas con la contraseña `1234` desde el menú
lateral o la tarjeta del panel Plus.

**"Busco algo y no aparece"** — el buscador solo encuentra palabras que
*empiezan* con lo que escribiste (sin tildes). Prueba con menos letras o
con el nombre genérico en vez de la marca comercial.

---

## 13. Historial de cambios de esta conversación

**Ronda 1 — De sitio web a app instalable**
- Se agregó `manifest.webmanifest`, `sw.js` e íconos para que el proyecto
  se pueda instalar como PWA.
- Barra de pestañas inferior y botón flotante para reemplazar la
  navegación falsa de Android que tenía el diseño original.
- El archivo principal se renombró de `botiquin-plus.html` a `index.html`
  para que funcione directo en GitHub Pages.
- *Bug encontrado y corregido:* el CSS original tenía
  `.rx-form { display: flex }`, lo que anulaba el atributo `hidden` y
  dejaba el formulario de "Agregar producto" siempre visible al final de
  la página.

**Ronda 2 — Funciones Plus**
- Nuevas pestañas: **Tomas y alarmas** y **Diccionario de medicamentos**
  (40 entradas).
- Lista de compras automática, respaldo en JSON, modo oscuro, ajuste
  rápido de cantidades con botones −/+, atajos de fecha.
- *Bug encontrado y corregido:* las tarjetas "Productos registrados",
  "Disponibles" y "Requieren atención" contaban mal — un producto con dos
  problemas a la vez (por ejemplo vencido y escaso) se contaba dos veces,
  y "Disponibles" excluía productos que sí estaban disponibles.

**Ronda 3 — Candado, planes y buscador**
- Candado de contraseña (`1234`) para Tomas y Diccionario, con interruptor
  tipo el de publicidad.
- Se quitó el plan "Familiar" de los planes demostrativos.
- Buscador mejorado: sin tildes, sin coincidencias parciales dentro de
  otras palabras.
- *Bugs encontrados y corregidos:*
  - El campo de búsqueda del inventario estaba conectado por referencia
    directa a la función original (más vieja), así que la mejora del
    buscador no se aplicaba ahí hasta que se reconectó explícitamente.
  - El chip de filtro "En orden" usaba un valor (`ok`) que no existía en
    la lista real de estados (`available`), así que el filtro quedaba
    vacío en silencio y mostraba todo sin filtrar.
  - Una tarjeta del panel Plus ("Recordatorios de tomas") tenía un fondo
    blanco fijo que no se adaptaba al modo oscuro, dejando el texto casi
    invisible ahí.
  - La pestaña Diccionario no aparecía en la barra inferior del celular:
    nunca se había agregado.

**Ronda 4 — Botón de agregar oculto en móvil**
- *Bug encontrado y corregido:* el botón flotante "+" se ocultaba en
  cuanto existía al menos un recordatorio de tomas pendiente de crear,
  incluso estando en la pestaña Inventario. La causa: el código que
  decide si mostrar el botón revisaba toda la página buscando el botón
  vacío "Crear recordatorio" de la pestaña Tomas, en vez de mirar
  solamente la pestaña que está activa en pantalla — y como esa pestaña
  vive escondida pero no borrada del documento, su botón vacío se seguía
  detectando aunque no se estuviera viendo. Se corrigió para que el
  chequeo solo mire dentro de la pestaña activa.

Cada corrección subió el número de versión del service worker
(actualmente `botiquin-v4`), así que quien tenga la app instalada recibe
las mejoras solas la próxima vez que abra con conexión.
