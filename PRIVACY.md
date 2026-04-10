# External Domain Whitelist

All data is stored locally via `localStorage`. No user data is transmitted externally.
The following external domains are contacted for **assets only** — not data:

| Domain | Purpose | Feature | User-initiated? |
|--------|---------|---------|----------------|
| `cdn.jsdelivr.net` | `@xenova/transformers` WASM model weights | Voice-to-text (STT) | Yes — user taps microphone |
| `accounts.spotify.com` | OAuth token refresh | Music Ops integration | Yes — user connects Spotify account |
| `api.spotify.com` | Playback state, playlist data | Music Ops integration | Yes — user connects Spotify account |
| `fonts.googleapis.com` / `fonts.gstatic.com` | UI font files (Bebas Neue, DM Mono, DM Serif) | All pages | Passive — page load |

## Audit Notes

- The Service Worker (`sw.js`) explicitly passes all external-origin requests through without interception (Rule 2: `if (!url.startsWith(self.location.origin)) return;`).
- Spotify and STT features are opt-in. A user who never opens Music Ops or taps the microphone makes zero external requests beyond the font load.
- No analytics, telemetry, or tracking pixels exist in this codebase.
