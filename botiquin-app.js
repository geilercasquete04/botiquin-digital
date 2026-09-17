/* ============================================================
   Botiquín Digital — capa "app"
   Instalación, uso sin conexión, botón flotante y formulario
   tipo hoja. Se carga después de botiquin-plus.js.
   ============================================================ */
(function () {
  'use strict';

  const el = id => document.getElementById(id);
  const esMovil = () => window.matchMedia('(max-width: 800px)').matches;
  const instalada = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (instalada()) document.body.classList.add('is-standalone');

  /* ---------- 1. Funciona sin conexión ---------- */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        /* Sin HTTPS no se registra; la app igual funciona online. */
      });
    });
  }

  /* ---------- 2. Instalar en el celular ---------- */
  let promptGuardado = null;
  const botonInstalar = el('install-btn');

  window.addEventListener('beforeinstallprompt', evento => {
    evento.preventDefault();
    promptGuardado = evento;
    if (botonInstalar) botonInstalar.hidden = false;
  });

  if (botonInstalar) {
    botonInstalar.addEventListener('click', async () => {
      if (!promptGuardado) return;
      promptGuardado.prompt();
      const { outcome } = await promptGuardado.userChoice;
      promptGuardado = null;
      botonInstalar.hidden = true;
      if (outcome === 'accepted' && typeof showToast === 'function') {
        showToast('Botiquín Digital se está instalando en tu dispositivo.');
      }
    });
  }

  window.addEventListener('appinstalled', () => {
    if (botonInstalar) botonInstalar.hidden = true;
    if (typeof showToast === 'function') showToast('Listo: ya tienes Botiquín Digital como app.');
  });

  /* iPhone no ofrece instalación automática: se explica una vez. */
  const CLAVE_TIP = 'botiquin_ios_tip_v1';
  const avisoIos = el('ios-tip');
  const esIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (avisoIos && esIos && !instalada() && !localStorage.getItem(CLAVE_TIP)) {
    setTimeout(() => { avisoIos.hidden = false; }, 1600);
    el('ios-tip-close').addEventListener('click', () => {
      avisoIos.hidden = true;
      localStorage.setItem(CLAVE_TIP, '1');
    });
  }

  /* ---------- 3. Botón flotante para agregar ---------- */
  const fab = el('fab-add');
  const formulario = el('inv-form');

  function pestanaActiva() {
    const activa = document.querySelector('.panel.is-active');
    return activa ? activa.id.replace('panel-', '') : 'inventario';
  }

  function sincronizarFab() {
    if (!fab) return;
    // Se oculta si el inventario vacío ya ofrece su propio botón.
    const pestana = pestanaActiva();
    const ctaVacio = document.querySelector('#inv-rows [data-add-first], #dose-agenda [data-nuevo-tx]');
    const txAbierto = document.getElementById('tx-form') && !document.getElementById('tx-form').hidden;
    fab.hidden = pestana !== 'inventario' || !formulario.hidden || txAbierto ||
      Boolean(ctaVacio);
  }

  if (fab) {
    fab.addEventListener('click', () => {
      if (typeof openForm === 'function') openForm();
      const nombre = el('f-nombre');
      if (nombre) setTimeout(() => nombre.focus(), 120);
    });
  }
  document.querySelectorAll('.nav-item').forEach(boton =>
    boton.addEventListener('click', sincronizarFab)
  );
  const filas = el('inv-rows');
  if (filas) new MutationObserver(sincronizarFab).observe(filas, { childList: true });

  /* ---------- 4. Formulario como hoja deslizante ---------- */
  const sombra = document.createElement('div');
  sombra.className = 'form-shade';
  sombra.hidden = true;
  document.body.appendChild(sombra);

  function cerrarFormulario() {
    if (typeof closeForm === 'function') closeForm();
    else formulario.hidden = true;
  }

  sombra.addEventListener('click', cerrarFormulario);

  function sincronizarHoja() {
    const abierto = !formulario.hidden;
    sombra.hidden = !(abierto && esMovil());
    document.body.style.overflow = abierto && esMovil() ? 'hidden' : '';
    if (abierto && esMovil()) {
      formulario.scrollTop = 0;
      if (!window.history.state || !window.history.state.hojaBotiquin) {
        window.history.pushState({ hojaBotiquin: true }, "");
      }
    }
    sincronizarFab();
  }

  new MutationObserver(sincronizarHoja).observe(formulario, {
    attributes: true,
    attributeFilter: ['hidden']
  });

  /* Nota: botiquin-plus.js declara una variable global `history`,
     por eso aquí se usa window.history explícitamente. */
  /* El botón "atrás" del celular cierra la hoja en vez de salir. */
  window.addEventListener('popstate', () => {
    if (!formulario.hidden) cerrarFormulario();
  });

  document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && !formulario.hidden) cerrarFormulario();
  });

  window.addEventListener('resize', () => {
    sincronizarHoja();
    sincronizarFab();
  });

  /* ---------- 5. Accesos directos del ícono ---------- */
  const parametros = new URLSearchParams(location.search);
  const pestanaPedida = parametros.get('tab');
  if (pestanaPedida && typeof activateTab === 'function') {
    activateTab(pestanaPedida, false);
  }
  if (parametros.get('accion') === 'agregar' && typeof openForm === 'function') {
    openForm();
  }

  sincronizarHoja();
  sincronizarFab();
})();
