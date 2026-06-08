const STORAGE_KEY = "car-maintenance-records";
const VEHICLE_KEY = "car-maintenance-vehicle";

const form = document.querySelector("#maintenanceForm");
const recordId = document.querySelector("#recordId");
const vehicleName = document.querySelector("#vehicleName");
const dateInput = document.querySelector("#date");
const kilometersInput = document.querySelector("#kilometers");
const typeInput = document.querySelector("#type");
const placeInput = document.querySelector("#place");
const costInput = document.querySelector("#cost");
const nextDateInput = document.querySelector("#nextDate");
const notesInput = document.querySelector("#notes");
const tableBody = document.querySelector("#recordsTable");
const searchInput = document.querySelector("#search");
const typeFilter = document.querySelector("#typeFilter");
const clearFormButton = document.querySelector("#clearForm");
const exportDataButton = document.querySelector("#exportData");
const importDataButton = document.querySelector("#importData");
const importFileInput = document.querySelector("#importFile");

const totalCost = document.querySelector("#totalCost");
const lastService = document.querySelector("#lastService");
const nextReminder = document.querySelector("#nextReminder");
const recordCount = document.querySelector("#recordCount");
const emptyHint = document.querySelector("#emptyHint");

let records = loadRecords();

dateInput.valueAsDate = new Date();
vehicleName.value = localStorage.getItem(VEHICLE_KEY) || "";
render();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const record = {
    id: recordId.value || crypto.randomUUID(),
    date: dateInput.value,
    kilometers: Number(kilometersInput.value || 0),
    type: typeInput.value,
    place: placeInput.value.trim(),
    cost: Number(costInput.value || 0),
    nextDate: nextDateInput.value,
    notes: notesInput.value.trim(),
  };

  records = recordId.value
    ? records.map((item) => (item.id === record.id ? record : item))
    : [record, ...records];

  saveRecords();
  resetForm();
  render();
});

vehicleName.addEventListener("input", () => {
  localStorage.setItem(VEHICLE_KEY, vehicleName.value.trim());
});

searchInput.addEventListener("input", render);
typeFilter.addEventListener("change", render);
clearFormButton.addEventListener("click", resetForm);
exportDataButton.addEventListener("click", exportDataFile);
importDataButton.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", importDataFile);

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const item = records.find((record) => record.id === button.dataset.id);
  if (!item) return;

  if (button.dataset.action === "edit") {
    fillForm(item);
  }

  if (button.dataset.action === "delete") {
    records = records.filter((record) => record.id !== item.id);
    saveRecords();
    render();
  }
});

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function exportDataFile() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    vehicleName: vehicleName.value.trim(),
    records,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  const today = toInputDate(new Date());
  const cleanVehicleName = (data.vehicleName || "mi-coche").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  link.href = URL.createObjectURL(blob);
  link.download = `mantenimiento-${cleanVehicleName}-${today}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

async function importDataFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const data = JSON.parse(await readFileAsText(file));
    const importedRecords = Array.isArray(data.records) ? data.records.map(normalizeRecord).filter(Boolean) : null;

    if (!importedRecords) {
      throw new Error("El archivo no tiene el formato esperado.");
    }

    if (records.length && !confirm("Cargar este archivo reemplazará los datos guardados en este navegador.")) {
      importFileInput.value = "";
      return;
    }

    records = importedRecords;
    vehicleName.value = typeof data.vehicleName === "string" ? data.vehicleName : "";
    localStorage.setItem(VEHICLE_KEY, vehicleName.value.trim());
    saveRecords();
    resetForm();
    render();
    alert("Archivo cargado correctamente.");
  } catch (error) {
    alert(error.message || "No se pudo cargar el archivo.");
  } finally {
    importFileInput.value = "";
  }
}

function readFileAsText(file) {
  if (file.text) {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("No se pudo leer el archivo.")));
    reader.readAsText(file);
  });
}

function normalizeRecord(record) {
  if (!record || typeof record !== "object" || !record.date || !record.type) return null;

  return {
    id: typeof record.id === "string" ? record.id : crypto.randomUUID(),
    date: String(record.date),
    kilometers: Number(record.kilometers || 0),
    type: String(record.type),
    place: String(record.place || ""),
    cost: Number(record.cost || 0),
    nextDate: String(record.nextDate || ""),
    notes: String(record.notes || ""),
  };
}

function resetForm() {
  form.reset();
  recordId.value = "";
  dateInput.valueAsDate = new Date();
  document.querySelector("#formTitle").textContent = "Nuevo mantenimiento";
}

function fillForm(item) {
  recordId.value = item.id;
  dateInput.value = item.date;
  kilometersInput.value = item.kilometers;
  typeInput.value = item.type;
  placeInput.value = item.place;
  costInput.value = item.cost || "";
  nextDateInput.value = item.nextDate || "";
  notesInput.value = item.notes;
  document.querySelector("#formTitle").textContent = "Editar mantenimiento";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function render() {
  records.sort((a, b) => new Date(b.date) - new Date(a.date));
  renderTypeFilter();
  renderSummary();
  renderTable();
}

function renderTypeFilter() {
  const current = typeFilter.value;
  const types = ["Todos", ...new Set(records.map((record) => record.type))];
  typeFilter.innerHTML = types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("");
  typeFilter.value = types.includes(current) ? current : "Todos";
}

function renderSummary() {
  const total = records.reduce((sum, record) => sum + Number(record.cost || 0), 0);
  const latest = records[0];
  const upcoming = records
    .filter((record) => record.nextDate)
    .sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate))[0];

  totalCost.textContent = formatCurrency(total);
  lastService.textContent = latest ? formatDate(latest.date) : "Sin datos";
  nextReminder.textContent = upcoming ? formatDate(upcoming.nextDate) : "Sin datos";
  recordCount.textContent = records.length;
}

function renderTable() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedType = typeFilter.value;
  const filtered = records.filter((record) => {
    const searchable = [record.type, record.place, record.notes, record.kilometers].join(" ").toLowerCase();
    const matchesQuery = !query || searchable.includes(query);
    const matchesType = selectedType === "Todos" || record.type === selectedType;
    return matchesQuery && matchesType;
  });

  emptyHint.textContent = records.length
    ? `${filtered.length} mantenimiento${filtered.length === 1 ? "" : "s"} en pantalla.`
    : "Guarda tu primer mantenimiento para verlo aquí.";

  if (!filtered.length) {
    tableBody.innerHTML = `<tr><td class="empty-state" colspan="5">No hay registros que coincidan.</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map(rowTemplate).join("");
}

function rowTemplate(record) {
  return `
    <tr>
      <td>${formatDate(record.date)}</td>
      <td>
        <span class="type-pill">${escapeHtml(record.type)}</span>
      </td>
      <td>${formatNumber(record.kilometers)} km</td>
      <td>${formatCurrency(record.cost || 0)}</td>
      <td>
        <div class="row-actions">
          <button class="row-button" type="button" data-action="edit" data-id="${record.id}" title="Editar" aria-label="Editar">✎</button>
          <button class="row-button delete" type="button" data-action="delete" data-id="${record.id}" title="Borrar" aria-label="Borrar">×</button>
        </div>
      </td>
    </tr>
  `;
}

function formatDate(dateValue) {
  if (!dateValue) return "";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(`${dateValue}T00:00:00`),
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-ES").format(Number(value || 0));
}

function toInputDate(date) {
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
