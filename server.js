const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 7000;

// ─── PROVIDER REGISTRY ───────────────────────────────────────────
const PROVIDERS = [
  { id: "test-4khdhub",       file: "./providers/test-4khdhub.js",       tier: "4K",    label: "4KHDHub" },
  { id: "cinemm",             file: "./providers/cinemm.js",             tier: "4K",    label: "CineMM" },
  { id: "ray-dahmermovies",   file: "./providers/ray-dahmermovies.js",   tier: "4K",    label: "Dahmer 4K" },
  { id: "notorrent",          file: "./providers/notorrent.js",          tier: "1080p", label: "NoTorrent" },
  { id: "test-dahmermovies",  file: "./providers/test-dahmermovies.js",  tier: "1080p", label: "Dahmer" },
  { id: "allinone-dahmermovies", file: "./providers/allinone-dahmermovies.js", tier: "1080p", label: "Dahmer+" },
  { id: "ray-movieblast",     file: "./providers/ray-movieblast.js",     tier: "1080p", label: "MovieBlast" },
  { id: "ray-vidlink",        file: "./providers/ray-vidlink.js",        tier: "1080p", label: "VidLink" },
  { id: "netmirror",          file: "./providers/netmirror.js",          tier: "1080p", label: "NetMirror" },
  { id: "huhu",               file: "./providers/test-huhu.js",          tier: "1080p", label: "Huhu" },
  { id: "castle",             file: "./providers/castle.js",             tier: "1080p", label: "Castle" },
  { id: "videasy",            file: "./providers/videasy.js",            tier: "1080p", label: "VidEasy" },
  { id: "ray-vidfast",        file: "./providers/ray-vidfast.js",        tier: "1080p", label: "VidFast" },
];

// ─── LOAD PROVIDERS ──────────────────────────────────────────────
const loadedProviders = [];
for (const p of PROVIDERS) {
  try {
    const mod = require(p.file);
    if (mod.getStreams) {
      loadedProviders.push({ ...p, mod });
      console.log(`  ✅ Loaded: ${p.label} (${p.id})`);
    } else {
      console.log(`  ⚠️  No getStreams: ${p.id}`);
    }
  } catch (err) {
    console.log(`  ❌ Failed: ${p.id} — ${err.message?.substring(0, 60)}`);
  }
}
console.log(`\n  ${loadedProviders.length}/${PROVIDERS.length} providers loaded\n`);

// ─── HELPERS ─────────────────────────────────────────────────────
function classifyQuality(q) {
  if (!q) return "unknown";
  const s = String(q).toLowerCase();
  if (s.includes("4k") || s.includes("2160") || s.includes("uhd")) return "4K";
  if (s.includes("1440") || s.includes("2k")) return "2K";
  if (s.includes("1080") || s.includes("fhd")) return "1080p";
  if (s.includes("720") || s.includes("hd")) return "720p";
  const m = s.match(/(\d{3,4})p?/);
  if (m) {
    const n = parseInt(m[1]);
    if (n >= 2160) return "4K";
    if (n >= 1440) return "2K";
    if (n >= 1080) return "1080p";
    if (n >= 720) return "720p";
  }
  return "unknown";
}

function isTorrent(url) {
  if (!url) return false;
  return url.startsWith("magnet:") || url.includes(".torrent") || url.startsWith("torrent://");
}

function getQualityRank(tier) {
  return { "4K": 0, "2K": 1, "1080p": 2 }[tier] ?? 9;
}

function formatStreamForStremio(stream, providerLabel) {
  const quality = stream.quality || stream.title || stream.description || "";
  const tier = classifyQuality(quality);
  const isMkv = stream.url?.includes(".mkv");
  const isM3u8 = stream.url?.includes(".m3u8");
  const isMp4 = stream.url?.includes(".mp4");
  const format = isMkv ? "MKV" : isM3u8 ? "HLS" : isMp4 ? "MP4" : "Stream";

  // Stremio stream object
  const result = {
    name: `🎬 ${providerLabel}`,
    title: `${tier} • ${format}`,
    url: stream.url,
  };

  // Add headers if present
  if (stream.headers && Object.keys(stream.headers).length > 0) {
    result.behaviorHints = {
      notWebReady: false,
      proxyHeaders: { request: stream.headers },
    };
  }

  // Add subtitles if present
  if (stream.subtitles && stream.subtitles.length > 0) {
    result.subtitles = stream.subtitles.map((s) => ({
      url: s.url,
      lang: s.language || s.lang || "eng",
    }));
  }

  // Add behaviorHints from provider
  if (stream.behaviorHints) {
    result.behaviorHints = {
      ...result.behaviorHints,
      ...stream.behaviorHints,
    };
  }

  return { result, tier, quality };
}

// ─── STREMIO MANIFEST ────────────────────────────────────────────
const MANIFEST = {
  id: "community.nuvio-aggregator",
  version: "1.0.0",
  name: "Nuvio Aggregator",
  description:
    "Multi-source streaming aggregator. 10 providers, 4K+1080p, no torrents. Tested and benchmarked.",
  logo: "https://i.imgur.com/your-logo.png",
  background: "https://i.imgur.com/your-bg.png",
  types: ["movie", "series"],
  catalogs: [],
  resources: ["stream"],
};

// ─── ROUTES ──────────────────────────────────────────────────────

// Stremio manifest
app.get("/manifest.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(MANIFEST);
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    providers: loadedProviders.map((p) => ({
      id: p.id,
      label: p.label,
      tier: p.tier,
    })),
  });
});

// Stream endpoint — movie
app.get("/stream/movie/:id.json", async (req, res) => {
  const tmdbId = req.params.id.replace(".json", "");
  console.log(`\n  🎬 Movie request: ${tmdbId}`);
  await handleStream(tmdbId, "movie", null, null, res);
});

// Stream endpoint — series
app.get("/stream/series/:id.json", async (req, res) => {
  const raw = req.params.id.replace(".json", "");
  const parts = raw.split(":");
  const tmdbId = parts[0];
  const season = parts[1] ? parseInt(parts[1]) : null;
  const episode = parts[2] ? parseInt(parts[2]) : null;
  console.log(`\n  📺 Series request: ${tmdbId} S${season}E${episode}`);
  await handleStream(tmdbId, "tv", season, episode, res);
});

// ─── STREAM HANDLER ──────────────────────────────────────────────
async function handleStream(tmdbId, mediaType, season, episode, res) {
  const TIMEOUT = 20000;
  const start = Date.now();

  // Call all providers in parallel
  const promises = loadedProviders.map(async (provider) => {
    const pStart = Date.now();
    try {
      const streams = await Promise.race([
        provider.mod.getStreams(tmdbId, mediaType, season, episode),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error("TIMEOUT")), TIMEOUT)
        ),
      ]);

      const latency = Date.now() - pStart;

      if (!Array.isArray(streams) || streams.length === 0) return [];

      return streams
        .filter((s) => s && s.url && !isTorrent(s.url))
        .map((s) => {
          const { result, tier, quality } = formatStreamForStremio(
            s,
            provider.label
          );
          return {
            ...result,
            _tier: tier,
            _quality: quality,
            _latency: latency,
            _provider: provider.id,
            _score:
              (tier === "4K" ? 100 : tier === "2K" ? 80 : tier === "1080p" ? 60 : 0) +
              Math.max(0, 50 - Math.floor(latency / 500)),
          };
        });
    } catch (err) {
      return [];
    }
  });

  const allResults = await Promise.all(promises);
  let streams = allResults.flat();

  // Filter quality >= 1080p
  streams = streams.filter((s) =>
    ["4K", "2K", "1080p"].includes(s._tier)
  );

  // Sort: 4K first, then 2K, then 1080p, then by score descending
  streams.sort((a, b) => {
    const qa = getQualityRank(a._tier);
    const qb = getQualityRank(b._tier);
    if (qa !== qb) return qa - qb;
    return b._score - a._score;
  });

  // Strip internal fields and deduplicate by URL
  const seen = new Set();
  const cleanStreams = [];
  for (const s of streams) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    const { _tier, _quality, _latency, _provider, _score, ...clean } = s;
    cleanStreams.push(clean);
  }

  const elapsed = Date.now() - start;
  console.log(
    `  ✅ ${cleanStreams.length} streams in ${elapsed}ms (${streams.length} raw from ${loadedProviders.length} providers)`
  );

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ streams: cleanStreams });
}

// ─── START ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  🎬 Nuvio Aggregator — Stremio Addon`);
  console.log(`  🌐 http://localhost:${PORT}`);
  console.log(`  📋 Manifest: http://localhost:${PORT}/manifest.json`);
  console.log(`  ❤️  Health:   http://localhost:${PORT}/health`);
  console.log(`  🎥 Stream:   http://localhost:${PORT}/stream/movie/{tmdbId}.json`);
  console.log(`${"=".repeat(60)}\n`);
});
