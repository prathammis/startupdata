const tableBody = document.getElementById("startupTableBody");
const searchInput = document.getElementById("searchInput");
const sectorFilter = document.getElementById("sectorFilter");
const stats = document.getElementById("stats");

let allItems = [];

function formatCurrency(amount) {
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
  const totalFunding = items.reduce((sum, item) => sum + item.amountUsd, 0);
  const uniqueCountries = new Set(items.map((item) => item.country)).size;

  stats.innerHTML = `
    <span class="stat-pill">Rounds: <strong>${items.length}</strong></span>
    <span class="stat-pill">Total tracked: <strong>${formatCurrency(totalFunding)}</strong></span>
    <span class="stat-pill">Countries: <strong>${uniqueCountries}</strong></span>
  `;
}

function renderTable(items) {
  if (!items.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7">No startups matched your filter.</td>
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
  } catch (error) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7">Could not load data. Please refresh.</td>
      </tr>
    `;
    console.error(error);
  }
}

searchInput.addEventListener("input", applyFilters);
sectorFilter.addEventListener("change", applyFilters);

init();
