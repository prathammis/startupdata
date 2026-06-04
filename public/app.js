const tableBody = document.getElementById("startupTableBody");
const searchInput = document.getElementById("searchInput");
const sectorFilter = document.getElementById("sectorFilter");
const stats = document.getElementById("stats");
const liveMeta = document.getElementById("liveMeta");
const refreshButton = document.getElementById("refreshButton");

const CLIENT_REFRESH_INTERVAL_MS = 2 * 60 * 1000;

let allItems = [];

function formatCurrency(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function renderStats(items) {
  const totalFunding = items.reduce((sum, item) => sum + (Number(item.amountUsd) || 0), 0);
  const uniqueCountries = new Set(items.map((item) => item.country)).size;

  stats.innerHTML = `
    <span class="stat-pill">Rounds: <strong>${items.length}</strong></span>
    <span class="stat-pill">Total tracked: <strong>${formatCurrency(totalFunding)}</strong></span>
    <span class="stat-pill">Countries: <strong>${uniqueCountries}</strong></span>
  `;
}

function renderMeta(payload) {
  const updatedAt = payload.updatedAt ? formatDate(payload.updatedAt) : "Unknown";
  const source = payload.source === "live" ? "Live feeds" : "Fallback local data";
  const feeds = payload.feedsUsed?.length ? payload.feedsUsed.join(", ") : "None";
  const errors = payload.errors?.length ? payload.errors.join(" | ") : "None";
  const windowDays = payload.windowDays || 30;
  const sourceCounts = payload.sourceCounts?.length
    ? payload.sourceCounts.map((item) => `${item.name} (${item.count})`).join(", ")
    : "None";

  liveMeta.innerHTML = `
    <span class="meta-pill">Window: <strong>Last ${windowDays} days</strong></span>
    <span class="meta-pill">Data source: <strong>${source}</strong></span>
    <span class="meta-pill">Feeds: <strong>${feeds}</strong></span>
    <span class="meta-pill">Source mix: <strong>${sourceCounts}</strong></span>
    <span class="meta-pill">Last refresh: <strong>${updatedAt}</strong></span>
    <span class="meta-pill">Feed errors: <strong>${errors}</strong></span>
  `;
}

function renderTable(items) {
  if (!items.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8">No startups matched your filter.</td>
      </tr>
    `;
    renderStats(items);
    return;
  }

  tableBody.innerHTML = items
    .map(
      (item) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.headline || "-"}</td>
        <td>${item.sector}</td>
        <td>${item.country}</td>
        <td>${item.stage}</td>
        <td>${formatCurrency(item.amountUsd)}</td>
        <td>${formatDate(item.fundedAt)}</td>
        <td><a href="${item.source}" target="_blank" rel="noopener noreferrer">View</a></td>
      </tr>
    `
    )
    .join("");

  renderStats(items);
}

function applyFilters() {
  const search = searchInput.value.trim().toLowerCase();
  const sector = sectorFilter.value;

  const filtered = allItems.filter((item) => {
    const matchesSector = !sector || item.sector === sector;
    const haystack = `${item.name} ${item.sector} ${item.country} ${item.stage}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    return matchesSector && matchesSearch;
  });

  renderTable(filtered);
}

function fillSectorFilter(items) {
  const sectors = [...new Set(items.map((item) => item.sector))].sort((a, b) => a.localeCompare(b));
  sectorFilter.innerHTML = `<option value="">All sectors</option>${sectors
    .map((sector) => `<option value="${sector}">${sector}</option>`)
    .join("")}`;
}

async function init() {
  try {
    const response = await fetch("/api/startups");
    if (!response.ok) {
      throw new Error("Failed to load startup data");
    }

    const payload = await response.json();
    allItems = payload.items || [];
    fillSectorFilter(allItems);
    renderTable(allItems);
    renderMeta(payload);
  } catch (error) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8">Could not load data. Please refresh.</td>
      </tr>
    `;
    console.error(error);
  }
}

async function triggerServerRefresh() {
  refreshButton.disabled = true;
  refreshButton.textContent = "Refreshing...";

  try {
    const response = await fetch("/api/startups/refresh", { method: "POST" });
    if (!response.ok) {
      throw new Error("Refresh failed");
    }
    await init();
  } catch (error) {
    console.error(error);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Refresh Live Data";
  }
}

searchInput.addEventListener("input", applyFilters);
sectorFilter.addEventListener("change", applyFilters);
refreshButton.addEventListener("click", triggerServerRefresh);

init();
setInterval(init, CLIENT_REFRESH_INTERVAL_MS);
