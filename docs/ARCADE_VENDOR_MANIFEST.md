# Arcade Vendored Libraries — Manifest

Pinned third-party runtime libraries vendored in-repo so the standalone games load
**offline / with no CDN dependency**. Each file is the exact build previously referenced
from `cdn.jsdelivr.net`, downloaded once and committed verbatim (no upgrade, no edit).

Verify integrity any time with:

```sh
sha256sum game/vendor/three/three.min-0.160.0.js \
          game/vendor/three/three.module-0.152.2.js \
          game/vendor/cannon-es/cannon-es-0.20.0.js
```

| Library | Version | Source URL (pinned) | Local path | Bytes | sha256 |
|---|---|---|---|---|---|
| three.js (UMD / global `THREE`) | r160 / 0.160.0 | `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js` | `game/vendor/three/three.min-0.160.0.js` | 669884 | `170c6789f43217c96b3170f4b42fafe135de7f7cd48497a4218f9757ee1d49fa` |
| three.js (ES module) | r152 / 0.152.2 | `https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js` | `game/vendor/three/three.module-0.152.2.js` | 1208839 | `4d01ed1c468372b16732fcecfeb2f463ac1b29b0fc296b2d64ec084e32876b39` |
| cannon-es (ES module) | 0.20.0 | `https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js` | `game/vendor/cannon-es/cannon-es-0.20.0.js` | 346256 | `f0700cbd3a482954949b9d58c1b0f76dcc74767750297647a39d8c40dd63d37c` |

## Consumers

- **Node Hopper** — `game/nodehopper/Node Hopper.html` loads `../vendor/three/three.min-0.160.0.js` (UMD global `THREE`).
- **The Incredible Mind Machine** — `game/theincrediblemindmachine/index.html` importmap maps `three` → `../vendor/three/three.module-0.152.2.js` and `cannon-es` → `../vendor/cannon-es/cannon-es-0.20.0.js`. Its service worker `SHELL` also lists these so an offline-after-first-visit serve has them locally.

## Notes

- **Exact versions, not upgraded.** The two games were pinned to different three.js majors (r160 UMD vs r152 ESM); both are vendored as-is to avoid any behavior change.
- **No internal external dependencies.** The ES-module builds contain no `import` from any external URL (verified by grep), so no further importmap entries are needed.
- **Google Fonts remain CDN-loaded but are cosmetic-only.** Both games still link Google Fonts; these do **not** block initialization (text falls back to system fonts). Self-hosting fonts is a separate, optional follow-up gate, out of scope here.
- **Service worker (Mind Machine) is best-effort.** It is registered from a blob URL, which some browsers will not register; the offline guarantee here comes from the libraries being local same-origin files, not from the service worker.
