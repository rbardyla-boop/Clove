# CloveLearn v2 — DS-I5 FUTURE-AUDIENCE CHECK

Status: `BUILD CONTRACT / NON-PUBLIC`
Issue: #165

## Objective

Guide one adult through one high-consequence sharing decision while the actual content, identity, recipient and context stay entirely outside Clove.

## Evidence boundary

The drill implements only these adjudicated ideas:
- high-consequence content can be copied, redistributed or seen outside the intended context;
- public or redistributed sexualized content can create context-dependent professional or relationship risks, but consequences are not inevitable;
- deleting an original later does not guarantee deletion of copies already held elsewhere, while removal/delisting can still reduce exposure.

The drill must never turn those risks into certainty, shame or a prediction about a specific person.

## Privacy architecture

**Ephemeral by design.**

Answers exist only in JavaScript memory for the current page session.
Reload, close or navigation away resets the drill.

Forbidden answer storage/transmission:
- localStorage;
- sessionStorage;
- IndexedDB;
- cookies;
- URL/query/hash state;
- telemetry/network requests.

Clove accepts no free text, upload, image, video, audio, content description, sexual history, identity, recipient, account or platform information.

## State machine

`BOUNDARY → COPYABILITY → AUDIENCE_WIDENING → FUTURE_CONTEXT → DECISION → COMPLETE`

Safe exit from every nonterminal stage: `STOPPED_SAFE`.

Coarse in-memory values only:
- `copyability`: `yes | no | unsure`
- `audienceWidening`: `yes | no | unsure`
- `futureContext`: `yes | no | unsure`
- `decision`: `wait | share_less | do_not_share | share_outside | need_help`

## Questions

1. Could another person or device retain a copy after you share it?
2. Could the audience become wider than the people you intend?
3. If a different future audience saw it, could that matter to you?

No answer is treated as proof that harm will or will not occur.

## Decision outputs

- WAIT
- SHARE LESS OUTSIDE CLOVE
- DO NOT SHARE
- SHARE OUTSIDE CLOVE — MY DECISION
- NEED HELP — LEAVE SAFELY

Clove never sends, uploads, deletes, redacts or alters content.

## Safety boundary

- adults only;
- do not use this drill for material involving anyone under 18;
- do not use it to process or facilitate non-consensual intimate material;
- no shame, purity, worth, morality or gender-value language;
- no universal career/relationship penalty claim;
- no “everything is permanent forever” claim;
- no legal, employment or relationship advice;
- no instructions to conceal wrongdoing or evade lawful accountability;
- no public deployment.

## Simplicity budget

- one question at a time;
- ≤6 visible buttons including STOP;
- ≥44px targets;
- ≤70 words per explanatory block;
- keyboard, 390px and reduced-motion safe.

## Terminal states

- `SOLO_HARDENED / HUMAN_EVIDENCE_PENDING`
- `REPAIR_REQUIRED`
- `RETIRE`
