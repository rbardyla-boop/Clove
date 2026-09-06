# Paper Firm — first-minute playtest

## How to open

1. Run RUG locally (default `http://localhost:8080`) with a Paper Firm world code.
2. Run the arcade mesh (default `ws://localhost:8787`).
3. Open `arcade/paper-firm/index.html` (or the served arcade path) with query params if useful:
   - `?rug=http://localhost:8080&match=YOURCODE`
4. Enter the world code → **ENTER THE PAGE**.

Do not deploy production from this playtest path.

## First-minute feel (lowest confidence)

- After connect: **one** next verb on the face (role-aware). Hint text says what to do — or why it is locked.
- **MORE** holds secondary verbs, touch pad, and rare desk tools.
- **STATS** opens the ledger (POCKET / OBS / HARNESS / SIGN). Hidden by default.
- **DESK** opens **WHILE YOU WERE GONE**. Hidden by default.
- Disabled controls keep a plain-English **why + unlock** in the tooltip / aria-label (not strikethrough alone).
- Walk into drawn furniture (desk, archive cabinets, relay). Soft bump + brief “wall” flash — walls matter.

## Role verbs (progressive)

- **Human A / field lead:** FIND → CARRY → EXTRACT → (desk work) → GO OFF SHIFT → RETURN → SIGN.
- **Human B / desk lead:** wait for receipt → VERIFY → PROMOTE → PACKAGE → DELIVER → (optional R2) → wait for SIGN.

## Intact laws

Clients send intent. RUG owns organizational reality. Clove field owns movement / presence / extraction eligibility only. Mesh + RUG admission ticket protocol unchanged.
