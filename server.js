const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const Parser = require("rss-parser");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "data", "startups.json");
const parser = new Parser({ timeout: 12000 });
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const FEEDS = [
  { name: "FinSMEs", url: "https://www.finsmes.com/feed" },
  { name: "TechCrunch", url: "https://techcrunch.com/tag/funding/feed" }
];

let liveCache = {
  items: [],
  count: 0,
  source: "fallback",
  feedsUsed: [],
  updatedAt: null,
  errors: []
};

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function loadStartups() {
  const raw = await fs.readFile(DATA_PATH, "utf-8");
  const startups = JSON.parse(raw);

  return startups.sort((a, b) => new Date(b.fundedAt) - new Date(a.fundedAt));
}

function inferAmountUsd(text) {
  if (!text) {
    return null;
  }

  const cleaned = text.replace(/,/g, "");
  const pattern = /(\$|USD\s*)(\d+(?:\.\d+)?)\s*(million|billion|m|bn)?/i;
  const match = cleaned.match(pattern);
  if (!match) {
    return null;
  }

  const base = Number(match[2]);
  const unit = (match[3] || "").toLowerCase();
  if (!Number.isFinite(base)) {
    return null;
  }

  if (unit === "million" || unit === "m") {
    return Math.round(base * 1000000);
  }

  if (unit === "billion" || unit === "bn") {
    return Math.round(base * 1000000000);
  }

  return Math.round(base);
}

function inferStage(text) {
  if (!text) {
    return "Unknown";
  }

  const match = text.match(/(pre-seed|seed|series\s+[a-z]|series\s+[0-9]+|venture\s+round)/i);
  return match ? match[1].replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Unknown";
}

function inferName(title) {
  if (!title) {
    return "Unknown Startup";
  }

  const splitMarkers = [" raises ", " raised ", " secures ", " bags ", " closes "];
  const lower = title.toLowerCase();
  for (const marker of splitMarkers) {
    const idx = lower.indexOf(marker);
    if (idx > 0) {
      return title.slice(0, idx).trim();
    }
  }

  return title.trim();
}

function sanitizeText(text) {
  return (text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeFeedItem(item, feedName) {
  const title = item.title || "";
  const summary = sanitizeText(item.contentSnippet || item.content || "");
  const searchableText = `${title} ${summary}`;

  return {
    name: inferName(title),
    country: "Unknown",
    sector: item.categories?.[0] || "Funding News",
    stage: inferStage(searchableText),
    amountUsd: inferAmountUsd(searchableText),
    fundedAt: item.isoDate || item.pubDate || new Date().toISOString(),
    source: item.link || "",
    sourceName: feedName,
    headline: title
  };
}

function isLikelyFundingPost(item) {
  const text = `${item.title || ""} ${item.contentSnippet || ""}`.toLowerCase();
  return /(raise|raised|funding|funded|series\s+[a-z0-9]|seed|pre-seed|financing|investment|invests)/.test(text);
}

async function fetchLiveStartups() {
  const feedResults = await Promise.all(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      const candidates = (parsed.items || []).filter(isLikelyFundingPost).slice(0, 35);
      return {
        feed: feed.name,
        items: candidates.map((item) => normalizeFeedItem(item, feed.name))
      };
    })
  );

  const merged = feedResults.flatMap((result) => result.items);
  const dedupedMap = new Map();
  for (const item of merged) {
    const key = item.source || `${item.name}-${item.fundedAt}`;
    if (!dedupedMap.has(key)) {
      dedupedMap.set(key, item);
    }
  }

  return {
    items: [...dedupedMap.values()].sort((a, b) => new Date(b.fundedAt) - new Date(a.fundedAt)).slice(0, 120),
    feedsUsed: FEEDS.map((f) => f.name)
  };
}

async function refreshLiveCache() {
  try {
    const result = await fetchLiveStartups();
    liveCache = {
      items: result.items,
      count: result.items.length,
      source: "live",
      feedsUsed: result.feedsUsed,
      updatedAt: new Date().toISOString(),
      errors: []
    };
    console.log(`Live startup data refreshed: ${liveCache.count} records`);
  } catch (error) {
    console.error("Live data refresh failed:", error.message);
    const fallback = await loadStartups();
    liveCache = {
      items: fallback,
      count: fallback.length,
      source: "fallback",
      feedsUsed: [],
      updatedAt: new Date().toISOString(),
      errors: [error.message]
    };
  }
}

app.get("/api/startups", async (_req, res) => {
  res.json(liveCache);
});

app.post("/api/startups/refresh", async (_req, res) => {
  await refreshLiveCache();
  res.json({ message: "Refresh complete", ...liveCache });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

refreshLiveCache()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Startup funding app is running at http://localhost:${PORT}`);
      setInterval(refreshLiveCache, REFRESH_INTERVAL_MS);
    });
  })
  .catch((error) => {
    console.error("Server startup failed:", error);
    process.exit(1);
  });
