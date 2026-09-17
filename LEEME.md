# Botiquín Digital — versión app

Tu proyecto sigue siendo el mismo sitio web, pero ahora se instala en el celular
como una app: ícono propio, pantalla completa sin barra del navegador, barra de
pestañas abajo y funciona sin internet.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Tu página (antes `botiquin-plus.html`; GitHub Pages necesita este nombre), con las etiquetas de app y la barra de pestañas |
| `botiquin-plus.css` | Tu CSS original, sin cambios |
| `botiquin-app.css` | **Nuevo.** Barra de pestañas, botón flotante, formulario deslizante |
| `botiquin-plus.js` | Tu JS, con la navegación falsa de Android retirada |
| `botiquin-app.js` | **Nuevo.** Instalación, modo sin conexión, botón flotante |
| `botiquin-plus-data.js` | Sin cambios |
| `manifest.webmanifest` | **Nuevo.** Nombre, ícono y colores de la app |
| `sw.js` | **Nuevo.** Guarda la app para abrirla sin conexión |
| `icons/` | **Nuevo.** Íconos de 192, 512 y 180 px |

## Publicarlo

La instalación y el modo sin conexión **solo funcionan con HTTPS**. Abrir el
archivo con doble clic (`file://`) muestra el diseño, pero no permite instalar.

Sube la carpeta completa a cualquier hosting estático gratis:

- **GitHub Pages**: sube los archivos a un repositorio, entra a *Settings →
  Pages* y publica la rama `main`.
- **Netlify Drop**: arrastra la carpeta a `app.netlify.com/drop`.
- **Cloudflare Pages** o **Vercel**: igual de sencillos.

Para probar en tu computador antes de publicar, desde la carpeta:

```bash
python3 -m http.server 8080
```

y abre `http://localhost:8080` (localhost cuenta como sitio
seguro, así que ahí sí puedes probar la instalación).

## Instalarlo en el celular

- **Android / Chrome**: aparece el botón *Instalar app* en la barra superior, o
  usa el menú ⋮ → *Instalar aplicación*.
- **iPhone / Safari**: botón Compartir → *Agregar a pantalla de inicio*. La app
  muestra ese recordatorio una sola vez.
- **Escritorio**: Chrome y Edge muestran un ícono de instalación en la barra de
  direcciones.

## Al publicar cambios

Sube el número de versión en la primera línea de `sw.js`
(`const VERSION = 'botiquin-v1'`) cada vez que cambies algo. Si no, quienes ya
tengan la app instalada seguirán viendo la versión guardada.

## Detalle aparte

Tu CSS definía `.rx-form { display: flex }`, lo cual anulaba el atributo
`hidden`: el formulario de "Agregar producto" quedaba siempre visible al final
de la página aunque el código intentara cerrarlo. Quedó corregido con una regla
en `botiquin-app.css`.
