# OPERATOR'S DECK + CLOVELEARN — ELECTRON DESKTOP APP

> Zero cloud. Zero server. Zero tracking. Your data never leaves your machine.

## What's Inside

**Operator's Deck** — 108 cards, 8 suits, soundtrack for every card, clinical recovery drills, ADHD tools.

**CloveLearn v3.0** — Offline Cognitive Intervention System:
- **Emotional Router** — 10-state detection engine
- **Protocol Engine** — 4 modalities (DBT, CBT, ACT, IFS) × 8 steps
- **Adaptive Correction** — Learns from feedback, bias decay
- **Delay Engine** — Impulse lock, urge curve, persist across refresh
- **Pattern Intelligence** — Warroom analytics dashboard

## Quick Start

```bash
cp /path/to/your/deploy/* electron-app/app/   # Copy 35 HTML files + assets
cd electron-app
npm install
npm start              # Full Deck (index.html)
npm run clovelearn     # CloveLearn direct (whats-going-on.html)
```

## Build

```bash
npm run build:win     # → dist/OperatorsDeck-3.1.0-Setup.exe (~85MB)
npm run build:mac     # → dist/OperatorsDeck-3.1.0.dmg (~95MB)
npm run build:linux   # → dist/OperatorsDeck-3.1.0.AppImage (~90MB)
```

All under 300MB. No cloud dependencies.

## Dual Launch Mode

| Mode | Command | Entry Point |
|---|---|---|
| Full Deck | `npm start` | `index.html` |
| CloveLearn | `npm run clovelearn` | `whats-going-on.html` |

## Menu Shortcuts

`Cmd/Ctrl+1` Home | `Cmd/Ctrl+2` CloveLearn | `Cmd/Ctrl+3` Pattern Intel | `Cmd/Ctrl+4` Tool Shed | `Cmd/Ctrl+E` Export | `Cmd/Ctrl+I` Import

## Voice Input (Future-Ready)

Microphone permissions pre-granted. `window.electronAPI.voiceAvailable` exposed to renderer. Web Speech API works natively in Electron's Chromium.

## Security

`contextIsolation: true` · `sandbox: true` · `nodeIntegration: false` · `webSecurity: true` · External links → system browser · Mic only (no camera)

## Data Persistence

| Platform | Location |
|---|---|
| Windows | `%APPDATA%/operators-deck/Local Storage/` |
| macOS | `~/Library/Application Support/operators-deck/Local Storage/` |
| Linux | `~/.config/operators-deck/Local Storage/` |

Uninstall does NOT delete data.

## CloveLearn Keys

`od_wgo_logs` · `od_protocol_logs` · `od_delay_logs` · `od_wgo_bias` · `od_wgo_corrections` · `od_rsd`

---

**Clove Syndicate** — Containment system. Show up. Hold the line.
