const STORAGE_KEY = 'botiquin_plus_inventory_v1';
const CHECKS_KEY = 'botiquin_plus_checks_v1';
const HISTORY_KEY = 'botiquin_plus_history_v1';
const PREFERENCES_KEY = 'botiquin_plus_preferences_v1';
const byId = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function load(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
let inventory = load(STORAGE_KEY, []);
let manualChecks = load(CHECKS_KEY, {});
let history = load(HISTORY_KEY, []);
let preferences = {...{ads:true, plan:'free', weekly:false}, ...load(PREFERENCES_KEY, {})};
let activeTab = 'inventario';
let tabHistory = [];

function localDate(){ const d = new Date(); d.setHours(0,0,0,0); return d; }
function daysUntil(date){ if(!date) return null; const target = new Date(`${date}T00:00:00`); return Math.round((target - localDate()) / 86400000); }
function expiration(item){ const days = daysUntil(item.vencimiento); if(days === null) return 'none'; if(days < 0) return 'expired'; if(days <= 30) return 'soon'; return 'current'; }
function stock(item){ if(Number(item.cantidad) <= 0) return 'out'; if(Number(item.cantidad) <= Number(item.umbralBajo)) return 'low'; return 'available'; }
function addHistory(message){ history = [{message, at: Date.now()}, ...history].slice(0, 10); save(HISTORY_KEY, history); }
function options(items){ return items.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join(''); }
function dateText(date){ if(!date) return 'Sin fecha'; return new Intl.DateTimeFormat('es-CO',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${date}T00:00:00`)); }
function expiryTag(item){ const state = expiration(item), days = daysUntil(item.vencimiento); if(state === 'expired') return '<span class="tag tag--red">Vencido</span>'; if(state === 'soon') return `<span class="tag tag--yellow">${days === 0 ? 'Vence hoy' : `En ${days} días`}</span>`; if(state === 'none') return '<span class="tag tag--gray">Sin fecha</span>'; return '<span class="tag tag--green">Vigente</span>'; }
function stockTag(item){ const state = stock(item), quantity = `${item.cantidad} ${escapeHtml(item.unidad || 'unidades')}`; if(state === 'out') return '<span class="tag tag--red">Agotado</span>'; if(state === 'low') return `<span class="tag tag--yellow">${quantity}</span>`; return `<span class="tag tag--green">${quantity}</span>`; }

function showToast(message){ const toast = byId('toast'); toast.textContent = message; toast.hidden = false; clearTimeout(showToast.timer); showToast.timer = setTimeout(() => { toast.hidden = true; }, 3300); }
function savePreferences(){ save(PREFERENCES_KEY, preferences); }
function setSwitch(id, value){ const control = byId(id); control.classList.toggle('is-on', value); control.setAttribute('aria-checked', String(value)); }
function syncDemoUI(){
  document.body.classList.toggle('is-ad-free', !preferences.ads);
  byId('ads-mode-label').textContent = preferences.ads ? 'Con publicidad' : 'Sin publicidad';
  setSwitch('ads-toggle', preferences.ads);
  setSwitch('weekly-toggle', preferences.weekly);
  document.querySelectorAll('[data-plan]').forEach(card => card.classList.toggle('is-selected', card.dataset.plan === preferences.plan));
}
function selectPlan(plan){
  preferences.plan = plan;
  preferences.ads = plan === 'free';
  savePreferences(); syncDemoUI();
  const planLabel = plan === 'free' ? 'Gratis' : plan === 'plus' ? 'Plus' : 'Familiar';
  showToast(`Vista ${planLabel} activada para la demostración.`);
}
function clearForm(){ byId('inv-form').reset(); byId('f-id').value = ''; byId('f-umbral').value = 3; byId('form-heading').textContent = 'Agregar producto'; }
function closeForm(){ byId('inv-form').hidden = true; clearForm(); }
function openForm(item){ clearForm(); if(item){ byId('form-heading').textContent = 'Editar producto'; byId('f-id').value = item.id; byId('f-nombre').value = item.nombre; byId('f-forma').value = item.forma || FORMAS[0]; byId('f-categoria').value = item.categoria || CATEGORIAS[0]; byId('f-cantidad').value = item.cantidad; byId('f-unidad').value = item.unidad || 'unidades'; byId('f-umbral').value = item.umbralBajo ?? 3; byId('f-vencimiento').value = item.vencimiento || ''; byId('f-ubicacion').value = item.ubicacion || UBICACIONES[0]; byId('f-uso').value = item.uso || USOS[0]; byId('f-notas').value = item.notas || ''; } byId('inv-form').hidden = false; byId('inv-form').scrollIntoView({behavior:'smooth',block:'nearest'}); byId('f-nombre').focus(); }

// Un producto "requiere atención" una sola vez, aunque tenga varios
// problemas a la vez (vencido y escaso, por ejemplo).
function needsAttention(item){
  return ['expired','soon'].includes(expiration(item)) || ['low','out'].includes(stock(item));
}
// "Disponible" = lo que realmente puedes usar hoy: hay unidades y no está vencido.
function isAvailable(item){
  return Number(item.cantidad) > 0 && expiration(item) !== 'expired';
}
function animateCount(id, value){
  const node = byId(id); if(!node) return;
  const previous = node.textContent;
  node.textContent = value;
  if(String(previous) !== String(value)){
    node.classList.remove('count-pop');
    void node.offsetWidth;
    node.classList.add('count-pop');
  }
}
function updateSummary(){
  const expired = inventory.filter(i => expiration(i) === 'expired').length;
  const soon = inventory.filter(i => expiration(i) === 'soon').length;
  const low = inventory.filter(i => ['low','out'].includes(stock(i))).length;
  byId('count-expired').textContent = expired;
  byId('count-soon').textContent = soon;
  byId('count-low').textContent = low;
  animateCount('count-total', inventory.length);
  animateCount('count-available', inventory.filter(isAvailable).length);
  animateCount('count-attention', inventory.filter(needsAttention).length);
}
function matchStatus(item, filter){ if(!filter) return true; if(filter === 'expired' || filter === 'soon') return expiration(item) === filter; if(filter === 'low') return ['low','out'].includes(stock(item)); return stock(item) === 'available' && expiration(item) === 'current'; }
function renderInventory(){
  const query = byId('search-input').value.trim().toLocaleLowerCase(); const filter = byId('status-filter').value;
  const filtered = inventory.filter(item => { const searchable = [item.nombre,item.categoria,item.ubicacion,item.forma,item.uso].join(' ').toLocaleLowerCase(); return searchable.includes(query) && matchStatus(item, filter); }).sort((a,b) => (a.vencimiento || '9999-12-31').localeCompare(b.vencimiento || '9999-12-31'));
  const rows = byId('inv-rows');
  if(!filtered.length){
    rows.innerHTML = inventory.length
      ? '<div class="empty-state"><strong>No hay resultados</strong><p>Prueba cambiando la búsqueda o el filtro de estado.</p></div>'
      : '<div class="empty-state"><div class="empty-art"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.5"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></div><strong>Tu botiquín está listo para empezar</strong><p>Registra el primer producto y tendrás un control claro de cantidades y vencimientos.</p><button type="button" class="btn btn-primary" data-add-first>Agregar primer producto</button></div>';
    return;
  }
  rows.innerHTML = filtered.map(item => `<div class="data-row inv-cols"><div><span class="product-name">${escapeHtml(item.nombre)}</span><span class="product-detail">${escapeHtml(item.forma || 'Sin forma')}${item.notas ? ` · ${escapeHtml(item.notas)}` : ''}</span></div><div>${escapeHtml(item.ubicacion || 'Sin ubicación')}</div><div>${expiryTag(item)}<span class="product-detail">${dateText(item.vencimiento)}</span></div><div>${stockTag(item)}</div><div><span class="tag tag--gray">${escapeHtml(item.categoria || item.uso || 'General')}</span></div><div><button class="icon-button" type="button" data-edit="${item.id}" aria-label="Editar ${escapeHtml(item.nombre)}"><svg viewBox="0 0 24 24" fill="none"><path d="m4 16.5-.5 4 4-.5L18 9.5l-3.5-3.5L4 16.5ZM12.5 8l3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="icon-button" type="button" data-delete="${item.id}" aria-label="Eliminar ${escapeHtml(item.nombre)}"><svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5h6v2m-9 0 1 13h10l1-13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></div>`).join('');
}
function autoChecked(check){ return inventory.some(item => check.clave.some(key => item.nombre.toLocaleLowerCase().includes(key))); }
function renderChecklist(){
  let complete = 0; const rows = byId('checklist-rows');
  rows.innerHTML = CHECKLIST_IDEAL.map(item => { const automatic = autoChecked(item); const checked = automatic || Boolean(manualChecks[item.id]); if(checked) complete++; return `<div class="data-row checklist-cols"><div><button class="checklist-check ${checked ? 'is-checked' : ''} ${automatic ? 'is-auto' : ''}" type="button" ${automatic ? 'disabled' : ''} data-check="${item.id}" aria-label="Marcar ${escapeHtml(item.nombre)}"><svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4 10-10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><div>${escapeHtml(item.nombre)}${automatic ? '<span class="product-detail">Registrado en tu inventario</span>' : ''}</div><div class="muted">${escapeHtml(item.motivo)}</div></div>`; }).join('');
  const percent = Math.round(complete / CHECKLIST_IDEAL.length * 100); byId('checklist-label').textContent = `${complete} de ${CHECKLIST_IDEAL.length} elementos revisados`; byId('checklist-pct').textContent = `${percent}%`; byId('checklist-fill').style.width = `${percent}%`;
}
function renderPlus(){
  const attention = inventory.filter(i => ['expired','soon'].includes(expiration(i)) || ['low','out'].includes(stock(i))).length;
  byId('plus-insight').textContent = inventory.length ? `${attention} de ${inventory.length} producto${inventory.length === 1 ? '' : 's'} requiere${attention === 1 ? '' : 'n'} revisión por fecha o existencias.` : 'Agrega productos para conocer el estado general de tu botiquín.';
  const list = byId('history-list'); if(!history.length){ list.innerHTML = '<li>Aún no hay cambios registrados.</li>'; return; }
  list.innerHTML = history.slice(0,4).map(item => `<li>${escapeHtml(item.message)}<span class="history-time">${new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(item.at)}</span></li>`).join('');
}
function renderAll(){ updateSummary(); renderInventory(); renderChecklist(); renderPlus(); syncDemoUI(); document.dispatchEvent(new CustomEvent('botiquin:cambio')); }
function closeRecentPanel(){ const panel = byId('recent-panel'); if(!panel) return; panel.classList.remove('is-open'); panel.setAttribute('aria-hidden', 'true'); }
function activateTab(tab, remember = true){
  if(!byId(`panel-${tab}`)) return;
  if(tab !== activeTab && remember) tabHistory.push(activeTab);
  activeTab = tab;
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('is-active', item.dataset.tab === tab));
  document.querySelectorAll('.panel').forEach(item => item.classList.toggle('is-active', item.id === `panel-${tab}`));
  if(tab === 'checklist') renderChecklist();
  if(tab === 'plus') renderPlus();
  closeRecentPanel();
  window.scrollTo({top:0, behavior:'smooth'});
}
function exportCsv(){
  const heading = ['Producto','Forma','Categoría','Cantidad','Unidad','Vencimiento','Ubicación','Uso','Notas'];
  const lines = inventory.map(item => [item.nombre,item.forma,item.categoria,item.cantidad,item.unidad,item.vencimiento,item.ubicacion,item.uso,item.notas].map(value => `"${String(value ?? '').replaceAll('"','""')}"`).join(','));
  const csv = '\ufeff' + [heading.join(','),...lines].join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); link.download = 'inventario-botiquin-digital.csv'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(link.href); showToast('Se descargó una copia de tu inventario.');
}

document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => activateTab(button.dataset.tab)));
byId('f-forma').innerHTML = options(FORMAS); byId('f-categoria').innerHTML = options(CATEGORIAS); byId('f-ubicacion').innerHTML = options(UBICACIONES); byId('f-uso').innerHTML = options(USOS);
byId('toggle-form-btn').addEventListener('click', () => openForm()); byId('cancel-form-btn').addEventListener('click', closeForm); byId('discard-form-btn').addEventListener('click', closeForm); byId('search-input').addEventListener('input', renderInventory); byId('status-filter').addEventListener('change', renderInventory); byId('export-btn').addEventListener('click', exportCsv);
byId('ads-toggle').addEventListener('click', () => { preferences.ads = !preferences.ads; savePreferences(); syncDemoUI(); showToast(preferences.ads ? 'Vista con publicidad activada.' : 'Vista sin publicidad activada.'); });
byId('weekly-toggle').addEventListener('click', () => { preferences.weekly = !preferences.weekly; savePreferences(); syncDemoUI(); showToast(preferences.weekly ? 'Resumen semanal activado para la demo.' : 'Resumen semanal desactivado.'); });
document.querySelectorAll('[data-plan]').forEach(card => card.addEventListener('click', () => selectPlan(card.dataset.plan)));
document.querySelectorAll('[data-open-tab]').forEach(button => button.addEventListener('click', () => activateTab(button.dataset.openTab)));
byId('inv-form').addEventListener('submit', event => { event.preventDefault(); const id = byId('f-id').value; const item = {id: id || `m_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,nombre:byId('f-nombre').value.trim(),forma:byId('f-forma').value,categoria:byId('f-categoria').value,cantidad:Number(byId('f-cantidad').value),unidad:byId('f-unidad').value,umbralBajo:Number(byId('f-umbral').value || 0),vencimiento:byId('f-vencimiento').value,ubicacion:byId('f-ubicacion').value,uso:byId('f-uso').value,notas:byId('f-notas').value.trim()}; if(id){ inventory = inventory.map(old => old.id === id ? item : old); addHistory(`Actualizaste ${item.nombre}.`); } else { inventory.unshift(item); addHistory(`Agregaste ${item.nombre}.`); } save(STORAGE_KEY, inventory); closeForm(); renderAll(); showToast(`${item.nombre} se guardó en el botiquín.`); });
byId('inv-rows').addEventListener('click', event => { const add = event.target.closest('[data-add-first]'); const edit = event.target.closest('[data-edit]'); const remove = event.target.closest('[data-delete]'); if(add) openForm(); if(edit){ const item = inventory.find(i => i.id === edit.dataset.edit); if(item) openForm(item); } if(remove){ const item = inventory.find(i => i.id === remove.dataset.delete); if(item && confirm(`¿Eliminar “${item.nombre}” del inventario?`)){ inventory = inventory.filter(i => i.id !== item.id); save(STORAGE_KEY, inventory); addHistory(`Eliminaste ${item.nombre}.`); renderAll(); showToast(`${item.nombre} fue eliminado.`); } } });
byId('checklist-rows').addEventListener('click', event => { const button = event.target.closest('[data-check]'); if(!button) return; const id = button.dataset.check; manualChecks[id] = !manualChecks[id]; save(CHECKS_KEY, manualChecks); renderChecklist(); });
renderAll();
