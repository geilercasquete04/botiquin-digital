/* ============================================================
   DATOS DE REFERENCIA — Botiquín Digital
   ============================================================ */

const CHECKLIST_IDEAL = [
  { id:"analgesico",   nombre:"Analgésico / antipirético", clave:"paracetamol", motivo:"Para dolor y fiebre" },
  { id:"aines",        nombre:"Antiinflamatorio (AINE)", clave:"ibuprofeno", motivo:"Para dolor con inflamación" },
  { id:"antihist",     nombre:"Antihistamínico", clave:"loratadina", motivo:"Para reacciones alérgicas leves" },
  { id:"suero",        nombre:"Suero oral", clave:"suero", motivo:"Para deshidratación por diarrea o vómito" },
  { id:"antiacido",    nombre:"Antiácido", clave:"omeprazol", motivo:"Para acidez o indigestión" },
  { id:"antisept",     nombre:"Antiséptico (alcohol o clorhexidina)", clave:"alcohol", motivo:"Para limpiar heridas" },
  { id:"gasas",        nombre:"Gasas y curitas", clave:"gasa", motivo:"Para cubrir heridas menores" },
  { id:"termometro",   nombre:"Termómetro", clave:"termómetro", motivo:"Para medir fiebre" },
  { id:"tijeras",      nombre:"Tijeras y pinzas", clave:"tijeras", motivo:"Para curaciones" },
  { id:"guantes",      nombre:"Guantes desechables", clave:"guantes", motivo:"Para higiene al atender heridas" },
  { id:"antidiarreico",nombre:"Antidiarreico", clave:"loperamida", motivo:"Para episodios de diarrea" },
  { id:"vendas",       nombre:"Vendas elásticas", clave:"venda", motivo:"Para esguinces o torceduras" },
];

const UBICACIONES = ["Botiquín del baño", "Cocina", "Nevera", "Habitación", "Bolso de viaje", "Otro"];
const CATEGORIAS_USO = ["Crónico", "Emergencia", "General"];
const FORMAS = ["Tableta", "Cápsula", "Jarabe", "Gotas", "Inyección", "Inhalador", "Crema/pomada", "Otro"];
