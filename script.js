/* ============================================================
   ESTADO Y PERSISTENCIA
   ============================================================ */
const STORAGE_KEY = "botiquin_inventario_v1";
const CHECKLIST_KEY = "botiquin_checklist_manual_v1";

function loadInventory(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch{ return []; } }
function saveInventory(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
function loadChecklistManual(){ try{ return JSON.parse(localStorage.getItem(CHECKLIST_KEY)) || {}; } catch{ return {}; } }
function saveChecklistManual(obj){ localStorage.setItem(CHECKLIST_KEY, JSON.stringify(obj)); }

let inventory = loadInventory();
let checklistManual = loadChecklistManual(); // { checklistItemId: true }

function todayStr(){ return new Date().toISOString().slice(0,10); }
function daysUntil(dateStr){
  const d1 = new Date(todayStr());
  const d2 = new Date(dateStr);
  return Math.round((d2 - d1) / 86400000);
}

/* ============================================================
   NAVEGACIÓN
   ============================================================ */
document.querySelectorAll(".nav-item").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.remove("is-active"));
    btn.classList.add("is-active");
    document.querySelectorAll(".panel").forEach(p=>p.classList.remove("is-active"));
    document.getElementById("panel-"+btn.dataset.tab).classList.add("is-active");
    if(btn.dataset.tab === "checklist") renderChecklist();
  });
});

/* ============================================================
   FORMULARIO — mostrar / ocultar + selects
   ============================================================ */
function fillSelect(el, options){
  el.innerHTML = options.map(o=>`<option>${o}</option>`).join("");
}
fillSelect(document.getElementById("f-forma"), FORMAS);
fillSelect(document.getElementById("f-ubicacion"), UBICACIONES);
fillSelect(document.getElementById("f-uso"), CATEGORIAS_USO);

const invForm = document.getElementById("inv-form");
document.getElementById("toggle-form-btn").addEventListener("click", ()=>{
  invForm.hidden = false;
  invForm.scrollIntoView({behavior:"smooth", block:"start"});
});
document.getElementById("cancel-form-btn").addEventListener("click", ()=>{
  invForm.hidden = true;
  invForm.reset();
});

invForm.addEventListener("submit", e=>{
  e.preventDefault();
  const umbral = document.getElementById("f-umbral").value;
  const item = {
    id: "m_" + Date.now(),
    nombre: document.getElementById("f-nombre").value.trim(),
    forma: document.getElementById("f-forma").value,
    cantidad: parseInt(document.getElementById("f-cantidad").value, 10),
    unidad: document.getElementById("f-unidad").value,
    umbralBajo: umbral === "" ? 3 : parseInt(umbral, 10),
    vencimiento: document.getElementById("f-vencimiento").value,
    ubicacion: document.getElementById("f-ubicacion").value,
    categoriaUso: document.getElementById("f-uso").value,
    notas: document.getElementById("f-notas").value.trim(),
  };
  inventory.push(item);
  saveInventory(inventory);
  invForm.reset();
  invForm.hidden = true;
  renderAll();
  showToast(`${item.nombre} agregado al botiquín.`);
});

/* ============================================================
   ESTADOS CALCULADOS
   ============================================================ */
function vencimientoEstado(item){
  const d = daysUntil(item.vencimiento);
  if(d < 0) return "vencido";
  if(d <= 30) return "porvencer";
  return "vigente";
}
function existenciaEstado(item){
  if(item.cantidad <= 0) return "agotado";
  if(item.cantidad <= item.umbralBajo) return "bajo";
  return "bien";
}

/* ============================================================
   RENDER: INVENTARIO
   ============================================================ */
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
searchInput.addEventListener("input", renderInventory);
statusFilter.addEventListener("change", renderInventory);

function renderInventory(){
  const q = searchInput.value.trim().toLowerCase();
  const statusF = statusFilter.value;
  const rows = document.getElementById("inv-rows");

  const filtered = inventory.filter(item=>{
    const matchesQ = !q || item.nombre.toLowerCase().includes(q) || item.ubicacion.toLowerCase().includes(q);
    const matchesStatus = !statusF || vencimientoEstado(item) === statusF;
    return matchesQ && matchesStatus;
  });

  rows.innerHTML = "";
  if(filtered.length === 0){
    rows.innerHTML = `<div class="empty-state">${inventory.length === 0 ? "Tu botiquín está vacío. Agrega tu primer medicamento." : "Sin resultados para ese filtro."}</div>`;
    return;
  }

  filtered
    .slice()
    .sort((a,b)=> daysUntil(a.vencimiento) - daysUntil(b.vencimiento))
    .forEach(item=>{
      const vEstado = vencimientoEstado(item);
      const eEstado = existenciaEstado(item);
      const vTagClass = vEstado === "vencido" ? "tag--red" : vEstado === "porvencer" ? "tag--yellow" : "tag--green";
      const vTagText = vEstado === "vencido" ? "Vencido" : vEstado === "porvencer" ? `En ${daysUntil(item.vencimiento)} días` : "Vigente";
      const eTagClass = eEstado === "agotado" ? "tag--red" : eEstado === "bajo" ? "tag--yellow" : "tag--green";
      const eTagText = eEstado === "agotado" ? "Agotado" : `${item.cantidad} ${item.unidad}`;

      const row = document.createElement("div");
      row.className = "data-row inv-cols";
      row.innerHTML = `
        <div data-label="Nombre"><strong>${item.nombre}</strong><br><span class="muted" style="font-size:.72rem">${item.forma}${item.notas ? " · " + item.notas : ""}</span></div>
        <div data-label="Ubicación">${item.ubicacion}</div>
        <div data-label="Vence"><span class="tag ${vTagClass}">${vTagText}</span></div>
        <div data-label="Existencias"><span class="tag ${eTagClass}">${eTagText}</span></div>
        <div data-label="Uso"><span class="tag tag--gray">${item.categoriaUso}</span></div>
        <div data-label=""><button class="icon-btn" data-id="${item.id}" aria-label="Eliminar">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button></div>
      `;
      row.querySelector(".icon-btn").addEventListener("click", ()=>{
        inventory = inventory.filter(x=>x.id !== item.id);
        saveInventory(inventory);
        renderAll();
      });
      rows.appendChild(row);
    });
}

/* ============================================================
   RESUMEN — panel fijo en la barra lateral
   ============================================================ */
function renderSummary(){
  const vencidos = inventory.filter(i=>vencimientoEstado(i)==="vencido").length;
  const porVencer = inventory.filter(i=>vencimientoEstado(i)==="porvencer").length;
  const bajos = inventory.filter(i=>existenciaEstado(i)!=="bien").length;
  document.getElementById("count-vencidos").textContent = vencidos;
  document.getElementById("count-porvencer").textContent = porVencer;
  document.getElementById("count-bajos").textContent = bajos;
}

/* ============================================================
   CHECKLIST DE BOTIQUÍN IDEAL
   ============================================================ */
function renderChecklist(){
  const rows = document.getElementById("checklist-rows");
  rows.innerHTML = "";
  let covered = 0;

  CHECKLIST_IDEAL.forEach(ci=>{
    const autoMatch = inventory.some(item => item.nombre.toLowerCase().includes(ci.clave.toLowerCase()));
    const manual = !!checklistManual[ci.id];
    const isChecked = autoMatch || manual;
    if(isChecked) covered++;

    const row = document.createElement("div");
    row.className = "data-row checklist-cols";
    row.innerHTML = `
      <div data-label=""><button class="checklist-check ${isChecked ? 'is-checked' : ''} ${autoMatch ? 'is-auto' : ''}">
        <svg viewBox="0 0 24 24" fill="none"><path d="m5 12 5 5 9-10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button></div>
      <div data-label="Elemento">${ci.nombre}${autoMatch ? '<br><span class="muted" style="font-size:.7rem">ya está en tu inventario</span>' : ''}</div>
      <div class="muted" data-label="Para qué sirve">${ci.motivo}</div>
    `;
    if(!autoMatch){
      row.querySelector(".checklist-check").addEventListener("click", ()=>{
        checklistManual[ci.id] = !checklistManual[ci.id];
        saveChecklistManual(checklistManual);
        renderChecklist();
      });
    }
    rows.appendChild(row);
  });

  const pct = Math.round((covered / CHECKLIST_IDEAL.length) * 100);
  document.getElementById("checklist-fill").style.width = pct + "%";
  document.getElementById("checklist-pct").textContent = pct + "%";
}

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg){
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> toast.hidden = true, 3500);
}

/* ============================================================
   INIT
   ============================================================ */
function renderAll(){
  renderInventory();
  renderSummary();
}
renderAll();
document.getElementById("f-vencimiento").valueAsDate = new Date();
