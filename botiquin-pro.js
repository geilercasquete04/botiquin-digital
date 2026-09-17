/* ============================================================
   Botiquín Digital — funciones Plus
   Tomas programadas con alarmas, diccionario de medicamentos,
   lista de compras, respaldo y mejoras del inventario.
   Se carga después de botiquin-plus.js y usa sus datos.
   Nota: botiquin-plus.js declara una variable global `history`,
   por eso aquí siempre se escribe window.history.
   ============================================================ */
(function () {
  'use strict';

  const TX_KEY = 'botiquin_tratamientos_v1';
  const LOG_KEY = 'botiquin_tomas_v1';
  const PREFS_KEY = 'botiquin_pro_prefs_v1';

  const cargar = (clave, porDefecto) => {
    try { return JSON.parse(localStorage.getItem(clave)) ?? porDefecto; } catch { return porDefecto; }
  };
  const guardar = (clave, valor) => localStorage.setItem(clave, JSON.stringify(valor));

  let tratamientos = cargar(TX_KEY, []);
  let registro = cargar(LOG_KEY, {});
  let prefs = { tema: 'auto', notificaciones: false, ...cargar(PREFS_KEY, {}) };

  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const temporizadores = [];

  /* =========================================================
     Utilidades de fecha
     ========================================================= */
  function isoDe(fecha) {
    const f = new Date(fecha);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  }
  const hoyIso = () => isoDe(new Date());

  function fechaHora(iso, hora) {
    const [a, m, d] = iso.split('-').map(Number);
    const [h, min] = hora.split(':').map(Number);
    return new Date(a, m - 1, d, h, min, 0, 0);
  }

  function horaLegible(hora) {
    const [h, m] = hora.split(':').map(Number);
    const sufijo = h < 12 ? 'a. m.' : 'p. m.';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
  }

  /* =========================================================
     Agenda de tomas
     ========================================================= */
  function aplicaEn(tx, iso) {
    if (tx.activo === false) return false;
    if (tx.inicio && iso < tx.inicio) return false;
    if (tx.fin && iso > tx.fin) return false;
    const dia = fechaHora(iso, '00:00').getDay();
    return !tx.dias || !tx.dias.length || tx.dias.includes(dia);
  }

  function agendaDe(iso) {
    const filas = [];
    tratamientos.forEach(tx => {
      if (!aplicaEn(tx, iso)) return;
      (tx.horas || []).forEach(hora => {
        const clave = `${iso}|${tx.id}|${hora}`;
        filas.push({
          tx, hora, clave,
          cuando: fechaHora(iso, hora),
          estado: registro[clave] ? registro[clave].estado : 'pendiente'
        });
      });
    });
    return filas.sort((a, b) => a.cuando - b.cuando);
  }

  function atrasadas() {
    const ahora = Date.now();
    return agendaDe(hoyIso()).filter(f => f.estado === 'pendiente' && f.cuando.getTime() < ahora - 60000);
  }

  function adherencia(dias = 7) {
    let programadas = 0, tomadas = 0;
    const ahora = Date.now();
    for (let i = 0; i < dias; i++) {
      const fecha = new Date(); fecha.setDate(fecha.getDate() - i);
      agendaDe(isoDe(fecha)).forEach(f => {
        if (f.cuando.getTime() > ahora) return;
        programadas++;
        if (f.estado === 'tomada') tomadas++;
      });
    }
    return { programadas, tomadas, pct: programadas ? Math.round(tomadas / programadas * 100) : null };
  }

  function marcarToma(clave, estado) {
    const [iso, txId, hora] = clave.split('|');
    const tx = tratamientos.find(t => t.id === txId);
    const previo = registro[clave] ? registro[clave].estado : 'pendiente';
    if (previo === estado) { delete registro[clave]; }
    else { registro[clave] = { estado, at: Date.now() }; }
    guardar(LOG_KEY, registro);

    // Descontar del inventario solo al pasar de pendiente a tomada.
    if (tx && tx.descontar && tx.itemId && previo !== 'tomada' && registro[clave] && estado === 'tomada') {
      const producto = inventory.find(i => i.id === tx.itemId);
      if (producto) {
        producto.cantidad = Math.max(0, Number(producto.cantidad) - Number(tx.unidades || 1));
        save(STORAGE_KEY, inventory);
        renderAll();
        if (Number(producto.cantidad) <= Number(producto.umbralBajo || 0)) {
          showToast(`Te quedan ${producto.cantidad} ${producto.unidad || 'unidades'} de ${producto.nombre}.`);
        }
      }
    }
    renderTomas();
    renderExtras();
    programarAlarmas();
    if (estado === 'tomada' && registro[clave]) showToast(`Toma de ${tx ? tx.nombre : 'medicamento'} registrada.`);
  }

  /* =========================================================
     Alarmas y notificaciones
     ========================================================= */
  function permisoNotificaciones() {
    return typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  }

  async function pedirPermiso() {
    if (typeof Notification === 'undefined') {
      showToast('Este navegador no permite notificaciones.');
      return;
    }
    const resultado = await Notification.requestPermission();
    prefs.notificaciones = resultado === 'granted';
    guardar(PREFS_KEY, prefs);
    renderTomas();
    programarAlarmas();
    showToast(prefs.notificaciones
      ? 'Listo, te avisaremos a la hora de cada toma.'
      : 'Sin permiso de notificaciones solo verás los recordatorios dentro de la app.');
  }

  function lanzarAviso(fila) {
    const cuerpo = `${fila.tx.dosis || 'Es hora de tu dosis'}${fila.tx.nota ? ` · ${fila.tx.nota}` : ''}`;
    try {
      const aviso = new Notification(`Hora de ${fila.tx.nombre}`, {
        body: cuerpo,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: fila.clave,
        requireInteraction: true
      });
      aviso.onclick = () => { window.focus(); activateTab('tomas'); aviso.close(); };
    } catch {
      showToast(`Hora de ${fila.tx.nombre}.`);
    }
  }

  function programarAlarmas() {
    while (temporizadores.length) clearTimeout(temporizadores.pop());
    if (permisoNotificaciones() !== 'granted') return;
    const ahora = Date.now();
    agendaDe(hoyIso()).forEach(fila => {
      if (fila.estado !== 'pendiente') return;
      const espera = fila.cuando.getTime() - ahora;
      if (espera <= 0 || espera > 86400000) return;
      temporizadores.push(setTimeout(() => { lanzarAviso(fila); renderTomas(); }, espera));
    });
  }

  /* =========================================================
     Panel de tomas
     ========================================================= */
  function tarjetaToma(fila) {
    const clases = ['dose-card', `is-${fila.estado}`];
    const vencida = fila.estado === 'pendiente' && fila.cuando.getTime() < Date.now() - 60000;
    if (vencida) clases.push('is-late');
    const etiqueta = fila.estado === 'tomada' ? 'Tomada'
      : fila.estado === 'omitida' ? 'Omitida'
      : vencida ? 'Atrasada' : 'Pendiente';
    return `<article class="${clases.join(' ')}">
      <div class="dose-card__time"><strong>${horaLegible(fila.hora)}</strong><span>${etiqueta}</span></div>
      <div class="dose-card__body">
        <span class="product-name">${escapeHtml(fila.tx.nombre)}</span>
        <span class="product-detail">${escapeHtml(fila.tx.dosis || 'Sin dosis anotada')}${fila.tx.nota ? ` · ${escapeHtml(fila.tx.nota)}` : ''}</span>
      </div>
      <div class="dose-card__actions">
        <button class="btn btn-primary btn-sm" type="button" data-toma="${fila.clave}">${fila.estado === 'tomada' ? 'Deshacer' : 'Tomada'}</button>
        <button class="btn btn-ghost btn-sm" type="button" data-omitir="${fila.clave}">${fila.estado === 'omitida' ? 'Deshacer' : 'Omitir'}</button>
      </div>
    </article>`;
  }

  function renderTomas() {
    const agenda = byId('dose-agenda');
    if (!agenda) return;
    const filas = agendaDe(hoyIso());
    const tomadas = filas.filter(f => f.estado === 'tomada').length;
    const pendientes = filas.filter(f => f.estado === 'pendiente').length;
    const tarde = atrasadas().length;
    const stats = adherencia(7);

    byId('dose-summary').innerHTML = `
      <article><span>Tomas de hoy</span><strong>${filas.length}</strong></article>
      <article><span>Ya tomadas</span><strong>${tomadas}</strong></article>
      <article><span>Adherencia 7 días</span><strong>${stats.pct === null ? '—' : stats.pct + '%'}</strong></article>`;

    const banner = byId('notif-banner');
    const permiso = permisoNotificaciones();
    if (permiso === 'granted') {
      banner.hidden = tarde === 0;
      if (tarde) banner.innerHTML = `<span>Tienes ${tarde} toma${tarde === 1 ? '' : 's'} sin marcar de hoy.</span>`;
    } else if (permiso === 'unsupported') {
      banner.hidden = true;
    } else {
      banner.hidden = tratamientos.length === 0;
      banner.innerHTML = `<span>Activa las notificaciones para que el celular te avise a la hora de cada toma.</span><button class="btn btn-primary btn-sm" type="button" id="ask-notif">Activar avisos</button>`;
    }

    agenda.innerHTML = filas.length
      ? filas.map(tarjetaToma).join('')
      : `<div class="empty-state"><div class="empty-art"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M12 9v4l2.5 1.5M9 3h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></div><strong>No tienes tomas programadas para hoy</strong><p>Crea un recordatorio para los tratamientos que alguien en casa esté siguiendo.</p><button class="btn btn-primary" type="button" data-nuevo-tx>Crear recordatorio</button></div>`;

    byId('tx-list').innerHTML = tratamientos.length
      ? tratamientos.map(tx => `<div class="data-row tx-row">
          <div><span class="product-name">${escapeHtml(tx.nombre)}</span><span class="product-detail">${escapeHtml(tx.dosis || 'Sin dosis')} · ${(tx.horas || []).map(horaLegible).join(', ')}</span></div>
          <div class="muted">${!tx.dias || tx.dias.length === 7 ? 'Todos los días' : tx.dias.map(d => DIAS[d]).join(', ')}${tx.fin ? ` · hasta ${tx.fin}` : ''}</div>
          <div><span class="tag ${tx.activo === false ? 'tag--gray' : 'tag--green'}">${tx.activo === false ? 'Pausado' : 'Activo'}</span></div>
          <div>
            <button class="icon-button" type="button" data-tx-toggle="${tx.id}" aria-label="Pausar o reanudar"><svg viewBox="0 0 24 24" fill="none">${tx.activo === false ? '<path d="M8 5v14l11-7L8 5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' : '<path d="M9 5v14M15 5v14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'}</svg></button>
            <button class="icon-button" type="button" data-tx-edit="${tx.id}" aria-label="Editar"><svg viewBox="0 0 24 24" fill="none"><path d="m4 16.5-.5 4 4-.5L18 9.5l-3.5-3.5L4 16.5ZM12.5 8l3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <button class="icon-button" type="button" data-tx-del="${tx.id}" aria-label="Eliminar"><svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5h6v2m-9 0 1 13h10l1-13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          </div>
        </div>`).join('')
      : '<div class="empty-state"><p>Aún no has creado tratamientos.</p></div>';

    const badge = document.querySelector('.app-tab[data-tab="tomas"] .tab-badge, .nav-item[data-tab="tomas"] .tab-badge');
    document.querySelectorAll('[data-tab="tomas"] .tab-badge').forEach(b => {
      b.textContent = pendientes || '';
      b.hidden = !pendientes;
    });
    void badge;
  }

  /* =========================================================
     Formulario de tratamiento
     ========================================================= */
  function horasDelForm() {
    return [...document.querySelectorAll('#tx-horas input[type="time"]')]
      .map(i => i.value).filter(Boolean).sort();
  }

  function pintarHoras(horas) {
    const caja = byId('tx-horas');
    caja.innerHTML = (horas.length ? horas : ['08:00']).map(h =>
      `<span class="hour-chip"><input type="time" value="${h}"><button type="button" data-quitar-hora aria-label="Quitar hora">×</button></span>`
    ).join('');
  }

  function pintarDias(dias) {
    byId('tx-dias').innerHTML = DIAS.map((nombre, i) =>
      `<button type="button" class="day-chip ${dias.includes(i) ? 'is-on' : ''}" data-dia="${i}">${nombre}</button>`
    ).join('');
  }

  function llenarSelectProductos(seleccion) {
    byId('tx-item').innerHTML = '<option value="">Sin vincular al inventario</option>' +
      inventory.map(i => `<option value="${escapeHtml(i.id)}" ${i.id === seleccion ? 'selected' : ''}>${escapeHtml(i.nombre)}</option>`).join('');
  }

  function abrirTx(tx) {
    const form = byId('tx-form');
    byId('tx-heading').textContent = tx ? 'Editar recordatorio' : 'Nuevo recordatorio';
    byId('tx-id').value = tx ? tx.id : '';
    byId('tx-nombre').value = tx ? tx.nombre : '';
    byId('tx-dosis').value = tx ? tx.dosis || '' : '1 tableta';
    byId('tx-unidades').value = tx ? tx.unidades ?? 1 : 1;
    byId('tx-inicio').value = tx ? tx.inicio || hoyIso() : hoyIso();
    byId('tx-fin').value = tx ? tx.fin || '' : '';
    byId('tx-nota').value = tx ? tx.nota || '' : '';
    byId('tx-descontar').checked = tx ? tx.descontar !== false : true;
    llenarSelectProductos(tx ? tx.itemId : '');
    pintarHoras(tx ? tx.horas || [] : ['08:00']);
    pintarDias(tx && tx.dias && tx.dias.length ? tx.dias : [0, 1, 2, 3, 4, 5, 6]);
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    byId('tx-nombre').focus();
  }

  function cerrarTx() { byId('tx-form').hidden = true; }

  function guardarTx(evento) {
    evento.preventDefault();
    const horas = horasDelForm();
    if (!horas.length) { showToast('Agrega al menos una hora de toma.'); return; }
    const dias = [...document.querySelectorAll('#tx-dias .day-chip.is-on')].map(b => Number(b.dataset.dia));
    if (!dias.length) { showToast('Selecciona al menos un día de la semana.'); return; }

    const id = byId('tx-id').value;
    const itemId = byId('tx-item').value;
    const producto = inventory.find(i => i.id === itemId);
    const tx = {
      id: id || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      nombre: byId('tx-nombre').value.trim() || (producto ? producto.nombre : 'Medicamento'),
      itemId: itemId || null,
      dosis: byId('tx-dosis').value.trim(),
      unidades: Number(byId('tx-unidades').value || 1),
      horas, dias,
      inicio: byId('tx-inicio').value || hoyIso(),
      fin: byId('tx-fin').value || '',
      nota: byId('tx-nota').value.trim(),
      descontar: byId('tx-descontar').checked,
      activo: id ? (tratamientos.find(t => t.id === id) || {}).activo !== false : true
    };
    tratamientos = id ? tratamientos.map(t => t.id === id ? tx : t) : [...tratamientos, tx];
    guardar(TX_KEY, tratamientos);
    if (typeof addHistory === 'function') addHistory(`${id ? 'Actualizaste' : 'Programaste'} el recordatorio de ${tx.nombre}.`);
    cerrarTx(); renderTomas(); renderExtras(); programarAlarmas();
    showToast(`Recordatorio de ${tx.nombre} guardado.`);
  }

  /* =========================================================
     Diccionario de medicamentos
     ========================================================= */
  function tarjetaDiccionario(med) {
    return `<article class="dic-card">
      <header>
        <div><h2>${escapeHtml(med.n)}</h2><p class="product-detail">${escapeHtml(med.otros.join(' · '))}</p></div>
        <span class="tag ${med.receta ? 'tag--yellow' : 'tag--green'}">${med.receta ? 'Con fórmula médica' : 'Venta libre'}</span>
      </header>
      <p class="dic-card__cat">${escapeHtml(med.cat)}</p>
      <p><strong>Para qué se usa.</strong> ${escapeHtml(med.para)}</p>
      <p><strong>Presentaciones.</strong> ${escapeHtml(med.pres.join(', '))}</p>
      <p class="dic-card__warn"><strong>Ten en cuenta.</strong> ${escapeHtml(med.ojo)}</p>
      <button class="btn btn-ghost btn-sm" type="button" data-dic-add="${escapeHtml(med.n)}">Agregar al inventario</button>
    </article>`;
  }

  function renderDiccionario() {
    const caja = byId('dic-results');
    if (!caja) return;
    const q = byId('dic-search').value.trim().toLocaleLowerCase();
    const lista = DICCIONARIO.filter(m =>
      !q || [m.n, m.cat, m.para, ...m.otros].join(' ').toLocaleLowerCase().includes(q)
    );
    byId('dic-count').textContent = `${lista.length} de ${DICCIONARIO.length}`;
    caja.innerHTML = lista.length
      ? lista.map(tarjetaDiccionario).join('')
      : '<div class="empty-state"><strong>Sin resultados</strong><p>Prueba con el nombre genérico, por ejemplo “ibuprofeno” en vez de la marca.</p></div>';
  }

  /* =========================================================
     Lista de compras y respaldo (pestaña Plus)
     ========================================================= */
  function listaCompras() {
    const items = [];
    inventory.forEach(i => {
      const venc = expiration(i), exis = stock(i);
      if (venc === 'expired') items.push({ q: i.nombre, por: 'Vencido, hay que reemplazarlo' });
      else if (exis === 'out') items.push({ q: i.nombre, por: 'Agotado' });
      else if (exis === 'low') items.push({ q: i.nombre, por: `Quedan ${i.cantidad} ${i.unidad || 'unidades'}` });
      else if (venc === 'soon') items.push({ q: i.nombre, por: `Vence el ${dateText(i.vencimiento)}` });
    });
    if (typeof CHECKLIST_IDEAL !== 'undefined') {
      CHECKLIST_IDEAL.forEach(c => {
        const tiene = inventory.some(i => c.clave.some(k => i.nombre.toLocaleLowerCase().includes(k)));
        if (!tiene && !manualChecks[c.id]) items.push({ q: c.nombre, por: 'Falta en el botiquín ideal' });
      });
    }
    return items;
  }

  function renderExtras() {
    const caja = byId('plus-extras');
    if (!caja) return;
    const compras = listaCompras();
    const stats = adherencia(7);

    caja.innerHTML = `
      <article class="plus-card plus-card--wide">
        <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M4 5h2l2 11h10l2-8H7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="19.5" r="1.4" fill="currentColor"/><circle cx="17" cy="19.5" r="1.4" fill="currentColor"/></svg></div>
        <h2>Lista de compras</h2>
        <p>Se arma sola con lo agotado, lo vencido, lo que está por acabarse y lo que falta del botiquín ideal.</p>
        ${compras.length
          ? `<ul class="shop-list">${compras.slice(0, 12).map(c => `<li><strong>${escapeHtml(c.q)}</strong><span>${escapeHtml(c.por)}</span></li>`).join('')}</ul>
             ${compras.length > 12 ? `<p class="muted">Y ${compras.length - 12} más.</p>` : ''}
             <button class="btn btn-ghost btn-sm" type="button" id="copy-shop">Copiar lista</button>`
          : '<p class="muted">Nada pendiente por comprar. Tu botiquín está al día.</p>'}
      </article>

      <article class="plus-card">
        <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v4l3 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></div>
        <h2>Adherencia</h2>
        <p>${stats.programadas
          ? `Cumpliste ${stats.tomadas} de ${stats.programadas} tomas programadas en los últimos 7 días.`
          : 'Programa recordatorios en la pestaña Tomas para ver aquí qué tanto se cumplen los tratamientos.'}</p>
        ${stats.pct !== null ? `<div class="checklist-progress__bar" style="margin-top:12px"><div class="checklist-progress__fill" style="width:${stats.pct}%"></div></div><p class="muted" style="margin-top:8px">${stats.pct}% de cumplimiento</p>` : ''}
      </article>

      <article class="plus-card">
        <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <h2>Respaldo de tus datos</h2>
        <p>Todo se guarda solo en este dispositivo. Descarga una copia para pasarla a otro celular o recuperarla si borras la app.</p>
        <div class="card-actions">
          <button class="btn btn-ghost btn-sm" type="button" id="backup-out">Descargar copia</button>
          <button class="btn btn-ghost btn-sm" type="button" id="backup-in">Restaurar copia</button>
        </div>
      </article>

      <article class="plus-card">
        <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M20 13.5A8 8 0 0 1 10.5 4a8 8 0 1 0 9.5 9.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></div>
        <h2>Apariencia</h2>
        <p>Elige cómo se ve la app. El modo automático sigue la configuración de tu celular.</p>
        <div class="theme-picker">
          ${[['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']].map(([v, t]) =>
            `<button type="button" class="day-chip ${prefs.tema === v ? 'is-on' : ''}" data-tema="${v}">${t}</button>`).join('')}
        </div>
      </article>`;
  }

  function copiarCompras() {
    const texto = listaCompras().map(c => `- ${c.q} (${c.por})`).join('\n');
    navigator.clipboard?.writeText(`Lista de compras del botiquín\n\n${texto}`)
      .then(() => showToast('Lista copiada, ya puedes pegarla donde quieras.'))
      .catch(() => showToast('No se pudo copiar en este navegador.'));
  }

  function descargarRespaldo() {
    const datos = {
      version: 1, fecha: new Date().toISOString(),
      inventario: inventory, checks: manualChecks,
      tratamientos, registro, preferencias: preferences, prefsPro: prefs
    };
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }));
    enlace.download = `botiquin-respaldo-${hoyIso()}.json`;
    document.body.appendChild(enlace); enlace.click(); enlace.remove();
    URL.revokeObjectURL(enlace.href);
    showToast('Copia descargada.');
  }

  function restaurarRespaldo() {
    const entrada = document.createElement('input');
    entrada.type = 'file'; entrada.accept = 'application/json,.json';
    entrada.addEventListener('change', () => {
      const archivo = entrada.files[0];
      if (!archivo) return;
      const lector = new FileReader();
      lector.onload = () => {
        try {
          const datos = JSON.parse(lector.result);
          if (!Array.isArray(datos.inventario)) throw new Error('formato');
          if (!confirm('Esto reemplaza los datos actuales de este dispositivo. ¿Continuar?')) return;
          inventory = datos.inventario;
          manualChecks = datos.checks || {};
          tratamientos = datos.tratamientos || [];
          registro = datos.registro || {};
          if (datos.prefsPro) prefs = { ...prefs, ...datos.prefsPro };
          save(STORAGE_KEY, inventory); save(CHECKS_KEY, manualChecks);
          guardar(TX_KEY, tratamientos); guardar(LOG_KEY, registro); guardar(PREFS_KEY, prefs);
          aplicarTema(); renderAll(); renderTomas(); programarAlarmas();
          showToast('Copia restaurada.');
        } catch {
          showToast('Ese archivo no es un respaldo válido.');
        }
      };
      lector.readAsText(archivo);
    });
    entrada.click();
  }

  /* =========================================================
     Tema claro / oscuro
     ========================================================= */
  function aplicarTema() {
    const oscuro = prefs.tema === 'oscuro' ||
      (prefs.tema === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.body.classList.toggle('tema-oscuro', oscuro);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', oscuro ? '#0b1418' : '#0b222c');
  }

  /* =========================================================
     Inventario: fila mejorada con ajuste rápido de cantidad
     ========================================================= */
  const renderInventarioOriginal = renderInventory;
  renderInventory = function () {
    const rows = byId('inv-rows');
    const query = byId('search-input').value.trim().toLocaleLowerCase();
    const filtro = byId('status-filter').value;
    const lista = inventory
      .filter(item => {
        const texto = [item.nombre, item.categoria, item.ubicacion, item.forma, item.uso].join(' ').toLocaleLowerCase();
        return texto.includes(query) && matchStatus(item, filtro);
      })
      .sort((a, b) => (a.vencimiento || '9999-12-31').localeCompare(b.vencimiento || '9999-12-31'));

    if (!lista.length) { renderInventarioOriginal(); sincronizarChips(); return; }

    rows.innerHTML = lista.map(item => `<div class="data-row inv-cols">
      <div><span class="product-name">${escapeHtml(item.nombre)}</span><span class="product-detail">${escapeHtml(item.forma || 'Sin forma')}${item.notas ? ` · ${escapeHtml(item.notas)}` : ''}</span></div>
      <div data-col="Ubicación">${escapeHtml(item.ubicacion || 'Sin ubicación')}</div>
      <div data-col="Vencimiento">${expiryTag(item)}<span class="product-detail">${dateText(item.vencimiento)}</span></div>
      <div data-col="Existencias">
        <div class="stepper">
          <button class="stepper__btn" type="button" data-dec="${item.id}" aria-label="Quitar una unidad de ${escapeHtml(item.nombre)}">−</button>
          <span class="stepper__value">${item.cantidad}</span>
          <button class="stepper__btn" type="button" data-inc="${item.id}" aria-label="Agregar una unidad de ${escapeHtml(item.nombre)}">+</button>
        </div>
        ${stockTag(item)}
      </div>
      <div data-col="Categoría"><span class="tag tag--gray">${escapeHtml(item.categoria || item.uso || 'General')}</span></div>
      <div class="row-actions">
        <button class="icon-button" type="button" data-edit="${item.id}" aria-label="Editar ${escapeHtml(item.nombre)}"><svg viewBox="0 0 24 24" fill="none"><path d="m4 16.5-.5 4 4-.5L18 9.5l-3.5-3.5L4 16.5ZM12.5 8l3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="icon-button" type="button" data-delete="${item.id}" aria-label="Eliminar ${escapeHtml(item.nombre)}"><svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5h6v2m-9 0 1 13h10l1-13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
    </div>`).join('');
    sincronizarChips();
  };

  function ajustarCantidad(id, delta) {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    const nueva = Math.max(0, Number(item.cantidad) + delta);
    if (nueva === Number(item.cantidad)) return;
    item.cantidad = nueva;
    save(STORAGE_KEY, inventory);
    renderAll();
  }

  function sincronizarChips() {
    const valor = byId('status-filter').value;
    document.querySelectorAll('[data-chip]').forEach(c =>
      c.classList.toggle('is-on', c.dataset.chip === valor));
  }

  /* =========================================================
     Mejoras del formulario de producto
     ========================================================= */
  function prepararFormulario() {
    const lista = document.createElement('datalist');
    lista.id = 'lista-medicamentos';
    lista.innerHTML = DICCIONARIO.map(m => `<option value="${escapeHtml(m.n)}">${escapeHtml(m.cat)}</option>`).join('');
    document.body.appendChild(lista);
    const nombre = byId('f-nombre');
    nombre.setAttribute('list', 'lista-medicamentos');
    nombre.addEventListener('change', () => {
      const med = DICCIONARIO.find(m => m.n.toLocaleLowerCase() === nombre.value.trim().toLocaleLowerCase());
      if (!med) return;
      const forma = byId('f-forma');
      const opcion = [...forma.options].find(o => med.pres.some(p => p.toLocaleLowerCase().includes(o.value.toLocaleLowerCase())));
      if (opcion) forma.value = opcion.value;
    });
  }

  function fechaRelativa(meses) {
    const f = new Date(); f.setMonth(f.getMonth() + meses);
    byId('f-vencimiento').value = isoDe(f);
  }

  /* =========================================================
     Recalcular cuando cambia el día o se vuelve a la app
     ========================================================= */
  let diaVisible = hoyIso();
  function revisarCambioDeDia() {
    if (hoyIso() !== diaVisible) {
      diaVisible = hoyIso();
      renderAll();
    }
    renderTomas();
    programarAlarmas();
  }

  /* =========================================================
     Eventos
     ========================================================= */
  function conectar() {
    byId('tx-form').addEventListener('submit', guardarTx);
    byId('tx-cancel').addEventListener('click', cerrarTx);
    byId('add-tx-btn').addEventListener('click', () => abrirTx());
    byId('add-hour').addEventListener('click', () => pintarHoras([...horasDelForm(), '20:00']));

    byId('tx-horas').addEventListener('click', e => {
      if (!e.target.closest('[data-quitar-hora]')) return;
      const horas = horasDelForm();
      const chip = e.target.closest('.hour-chip');
      const valor = chip.querySelector('input').value;
      pintarHoras(horas.filter(h => h !== valor));
    });

    byId('tx-dias').addEventListener('click', e => {
      const chip = e.target.closest('[data-dia]');
      if (chip) chip.classList.toggle('is-on');
    });

    byId('dose-agenda').addEventListener('click', e => {
      const nuevo = e.target.closest('[data-nuevo-tx]');
      const toma = e.target.closest('[data-toma]');
      const omitir = e.target.closest('[data-omitir]');
      if (nuevo) abrirTx();
      if (toma) marcarToma(toma.dataset.toma, 'tomada');
      if (omitir) marcarToma(omitir.dataset.omitir, 'omitida');
    });

    byId('notif-banner').addEventListener('click', e => {
      if (e.target.closest('#ask-notif')) pedirPermiso();
    });

    byId('tx-list').addEventListener('click', e => {
      const pausa = e.target.closest('[data-tx-toggle]');
      const editar = e.target.closest('[data-tx-edit]');
      const borrar = e.target.closest('[data-tx-del]');
      if (pausa) {
        tratamientos = tratamientos.map(t => t.id === pausa.dataset.txToggle ? { ...t, activo: t.activo === false } : t);
        guardar(TX_KEY, tratamientos); renderTomas(); programarAlarmas();
      }
      if (editar) { const tx = tratamientos.find(t => t.id === editar.dataset.txEdit); if (tx) abrirTx(tx); }
      if (borrar) {
        const tx = tratamientos.find(t => t.id === borrar.dataset.txDel);
        if (tx && confirm(`¿Eliminar el recordatorio de “${tx.nombre}”?`)) {
          tratamientos = tratamientos.filter(t => t.id !== tx.id);
          guardar(TX_KEY, tratamientos); renderTomas(); renderExtras(); programarAlarmas();
          showToast('Recordatorio eliminado.');
        }
      }
    });

    byId('dic-search').addEventListener('input', renderDiccionario);
    byId('dic-results').addEventListener('click', e => {
      const boton = e.target.closest('[data-dic-add]');
      if (!boton) return;
      activateTab('inventario');
      openForm();
      byId('f-nombre').value = boton.dataset.dicAdd;
      byId('f-nombre').dispatchEvent(new Event('change'));
    });

    byId('inv-rows').addEventListener('click', e => {
      const mas = e.target.closest('[data-inc]');
      const menos = e.target.closest('[data-dec]');
      if (mas) ajustarCantidad(mas.dataset.inc, 1);
      if (menos) ajustarCantidad(menos.dataset.dec, -1);
    });

    document.querySelector('.filter-chips').addEventListener('click', e => {
      const chip = e.target.closest('[data-chip]');
      if (!chip) return;
      byId('status-filter').value = chip.dataset.chip;
      renderInventory();
    });
    byId('status-filter').addEventListener('change', sincronizarChips);

    document.querySelector('.date-shortcuts').addEventListener('click', e => {
      const boton = e.target.closest('[data-meses]');
      if (boton) fechaRelativa(Number(boton.dataset.meses));
    });

    document.body.addEventListener('click', e => {
      if (e.target.closest('#copy-shop')) copiarCompras();
      if (e.target.closest('#backup-out')) descargarRespaldo();
      if (e.target.closest('#backup-in')) restaurarRespaldo();
      const tema = e.target.closest('[data-tema]');
      if (tema) {
        prefs.tema = tema.dataset.tema;
        guardar(PREFS_KEY, prefs);
        aplicarTema(); renderExtras();
      }
    });

    document.addEventListener('botiquin:cambio', () => { renderExtras(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) revisarCambioDeDia(); });
    window.addEventListener('focus', revisarCambioDeDia);
    setInterval(revisarCambioDeDia, 60000);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', aplicarTema);
  }

  /* =========================================================
     Arranque
     ========================================================= */
  aplicarTema();
  prepararFormulario();
  conectar();
  renderInventory();
  renderTomas();
  renderDiccionario();
  renderExtras();
  programarAlarmas();

  // Aviso de tomas atrasadas al abrir la app.
  setTimeout(() => {
    const tarde = atrasadas();
    if (tarde.length) showToast(`Tienes ${tarde.length} toma${tarde.length === 1 ? '' : 's'} sin marcar hoy.`);
  }, 1200);
})();
