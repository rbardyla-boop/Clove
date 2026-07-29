# Clove Insights

First-party, aggregate-only product diagnostics for CloveLearn.

It intentionally stores no IP address, cookie, account, user identifier, full URL,
referrer URL, user-agent string, raw browser error, or wellbeing-tool content.
Daily aggregate rows expire after 400 days. Voluntary feedback notes expire after
90 days. The browser honours Global Privacy Control, Do Not Track, and the local
opt-out on `/privacy-signals.html`.

## Operator commands

```bash
npm install
npm run types
npm run check
npx wrangler d1 migrations apply clove-insights --remote
npm run dry-run
npm run deploy
```

View only aggregated results:

```bash
npx wrangler d1 execute clove-insights --remote --command \
  "SELECT day,event,surface,device,SUM(count) total FROM aggregate_daily GROUP BY 1,2,3,4 ORDER BY day DESC,total DESC LIMIT 100"
```

Review voluntary notes:

```bash
npx wrangler d1 execute clove-insights --remote --command \
  "SELECT id,day,category,surface,device,note,diagnostic FROM feedback_notes WHERE status='new' ORDER BY id DESC LIMIT 100"
```
