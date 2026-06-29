# Nuvio Aggregator — Stremio Addon

Multi-source streaming aggregator for Stremio. Combines 13 tested providers
with 4K and 1080p quality. No torrents.

## Quick Start

```bash
npm install
node server.js
```

Open Stremio and add: `http://localhost:7000/manifest.json`

## What's Inside

### 4K Providers
| Provider | Source | Streams | Format |
|----------|--------|---------|--------|
| 4KHDHub | D3adlyRocket/Test | 6 | Stream |
| CineMM | All-in-One-Nuvio | 6 | MKV |
| Dahmer 4K | Ray's Plugins | 1 | MKV |

### 1080p Providers
| Provider | Source | Streams | Format |
|----------|--------|---------|--------|
| NoTorrent | All-in-One-Nuvio | 6 | HLS/MP4 |
| Dahmer | D3adlyRocket/Test | 5 | MKV |
| Dahmer+ | All-in-One-Nuvio | 5 | MKV |
| MovieBlast | Ray's Plugins | 5 | MKV |
| VidLink | Ray's Plugins | 3 | MP4 |
| NetMirror | All-in-One-Nuvio | 3 | HLS |
| Huhu | D3adlyRocket/Test | 5 | Stream |
| Castle | All-in-One-Nuvio | 3 | HLS |
| VidEasy | All-in-One-Nuvio | 10 | HLS |
| VidFast | Ray's Plugins | 5 | Stream |

## Endpoints

- `GET /manifest.json` — Stremio addon manifest
- `GET /stream/movie/{tmdbId}.json` — Movie streams
- `GET /stream/series/{tmdbId}:{season}:{episode}.json` — Series streams
- `GET /health` — Provider health check

## Environment

- `PORT` — Server port (default: 7000)

## How It Works

1. Receives Stremio stream request (TMDB ID)
2. Calls all 13 providers in parallel (20s timeout each)
3. Filters out torrents and low quality (< 1080p)
4. Sorts: 4K → 2K → 1080p, then by score (quality + speed)
5. Deduplicates by URL
6. Returns Stremio-compatible stream objects

## Tested With

- Movie: Project Hail Mary (TMDB: 687163) — 36 streams (12x 4K, 24x 1080p)
- Latency: ~15s total (parallel provider calls)

## Source Repos

- https://github.com/D3adlyRocket/All-in-One-Nuvio
- https://github.com/hihihihihiiray/nuvio-plugins
- https://github.com/D3adlyRocket/Test
