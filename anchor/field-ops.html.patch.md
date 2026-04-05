# field-ops.html — Directive Anchor Patch
# Exact insertion — copy lines from PASTE BLOCK verbatim

---

## Verification: confirm you're in the right file

Before patching, verify the file contains both of these strings:

1. `<button class="btn-again" id="btn-again" onclick="runAgain()">RUN IT AGAIN →</button>`
   (should be around line 464 in the `#s-debrief` section)

2. `init();` followed immediately by `</script>`
   (should be around line 1333–1334 — this is the insertion target)

If both strings exist, proceed.

---

## Insertion target

Find these three lines near the very end of field-ops.html:

```
init();
</script>
<script>if('serviceWorker'in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})}</script>
```

---

## PASTE BLOCK — insert between `</script>` and the service-worker line

Replace the three lines above with the following seven lines (exact copy-paste):

```html
init();
</script>

<!-- ═══ DIRECTIVE ANCHOR — load order is mandatory ══════════════════════ -->
<script src="anchor/entropy.js"></script>
<script src="anchor/ics.js"></script>
<script src="anchor/db.js"></script>
<script src="anchor/tension-meter.js"></script>
<script src="anchor/anchor-step.js"></script>
<script src="anchor/anchor-ratio.js"></script>
<!-- ════════════════════════════════════════════════════════════════════ -->

<script>if('serviceWorker'in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})}</script>
```

---

## What you are NOT touching

- The `#s-debrief` HTML block (lines ~435–470) — unchanged.
- The `showDebrief()` function body — unchanged. The patch wraps it externally.
- Any existing localStorage keys or logic — unchanged.
- The service worker registration script — stays in place, after the anchor scripts.

---

## Diff view (for git review)

```diff
  init();
 </script>
+
+<!-- ═══ DIRECTIVE ANCHOR — load order is mandatory ══════════════════════ -->
+<script src="anchor/entropy.js"></script>
+<script src="anchor/ics.js"></script>
+<script src="anchor/db.js"></script>
+<script src="anchor/tension-meter.js"></script>
+<script src="anchor/anchor-step.js"></script>
+<script src="anchor/anchor-ratio.js"></script>
+<!-- ════════════════════════════════════════════════════════════════════ -->
+
 <script>if('serviceWorker'in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})}</script>
```

---

## sw.js cache manifest update

After patching field-ops.html, open sw.js and find the static assets array
(the one that contains `'/field-ops.html'`). Add these 6 entries:

```javascript
'/anchor/entropy.js',
'/anchor/ics.js',
'/anchor/db.js',
'/anchor/tension-meter.js',
'/anchor/anchor-step.js',
'/anchor/anchor-ratio.js',
```

Then bump CACHE_VERSION by 1. This forces a cache bust on next deploy so
Cloudflare Pages serves the new files immediately.

---

## Rollback

```diff
  init();
 </script>
-
-<!-- ═══ DIRECTIVE ANCHOR — load order is mandatory ══════════════════════ -->
-<script src="anchor/entropy.js"></script>
-<script src="anchor/ics.js"></script>
-<script src="anchor/db.js"></script>
-<script src="anchor/tension-meter.js"></script>
-<script src="anchor/anchor-step.js"></script>
-<script src="anchor/anchor-ratio.js"></script>
-<!-- ════════════════════════════════════════════════════════════════════ -->
-
 <script>if('serviceWorker'in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})}</script>
```

Delete the `anchor/` folder. Revert the sw.js cache version bump.
The three `od_anchor*` localStorage keys are silently ignored on next load.
