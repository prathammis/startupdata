const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "data", "startups.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function loadStartups() {
  const raw = await fs.readFile(DATA_PATH, "utf-8");
  const startups = JSON.parse(raw);

  return startups.sort((a, b) => new Date(b.fundedAt) - new Date(a.fundedAt));
}

app.get("/api/startups", async (_req, res) => {
  try {
    const startups = await loadStartups();
    res.json({ items: startups, count: startups.length });
  } catch (error) {
    console.error("Failed to load startup data:", error);
    res.status(500).json({ message: "Could not load startup data." });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Startup funding app is running at http://localhost:${PORT}`);
});
