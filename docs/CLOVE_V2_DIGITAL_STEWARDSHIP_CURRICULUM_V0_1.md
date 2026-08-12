# CloveLearn v2 — Digital Stewardship Curriculum v0.1

Status: **CANDIDATE / NOT PUBLIC / ACTION-FIRST**

Evidence authority: `CLOVE_V2_DIGITAL_STEWARDSHIP_CLAIM_LEDGER.md`

Audience: general adults; any first controlled product exposure remains adults-only.

## Governing rule

Every drill follows:

`THREAT → WHY → ONE ACTION → CHECK → RECOVER`

Reading is not completion. Fear is not completion. Agreement with Clove is not completion.

A drill passes only when the user can point to an observable change, tested recovery path, or completed real-world check.

---

# DS-00 — KNOW THE MACHINE

## Mission
Understand one digital service well enough to know what is on the device, what is in an account, what is on someone else's server, and how access is recovered.

## Threat
People often know how to operate an interface without knowing where information lives, what account controls it, or what happens when the device is lost.

## Why it matters
Confusing the phone with the account, the app with the service, or “delete from device” with “delete from provider” creates avoidable recovery and privacy failures.

## One action — THE FIVE-BOX MAP

Pick **one low- or medium-stakes service you already use**. Do not start with banking, government identity, or a critical health account.

Fill five boxes:

1. **DEVICE** — what physical device am I using?
2. **APP / BROWSER** — what software opens the service?
3. **ACCOUNT** — what login identifies me?
4. **SERVICE / CLOUD** — what organization stores or processes the information?
5. **RECOVERY** — what email, phone, authenticator, backup code, or support path gets me back in?

Then inspect:

- permissions currently granted;
- whether content appears on another signed-in device/browser;
- where the service says account deletion/deactivation is controlled;
- the current recovery method.

## Check
The user must be able to answer, without guessing:

- If this phone disappeared, would the account still exist?
- What restores access?
- Which permissions are optional?
- Does deleting the app delete the account? Do not assume; check the service's own controls/help.

## Recover
If the user discovers an unknown or broken recovery method, **do not log out**. Repair recovery first, then verify it before changing other account settings.

## Completion evidence
A completed five-box map plus one verified recovery method.

## Never teach
- that uninstalling an app deletes provider-held data;
- that all cloud data is permanent;
- that users should deliberately lock themselves out to “test” recovery.

---

# DS-01 — SURVIVE THE FORCED GRID

## Mission
Complete a necessary digital task while giving the service no more access than the task actually requires.

## Threat
Necessary services can accumulate optional permissions, marketing consent, location access, contact access, notifications, and account linkage around a legitimate core task.

## Why it matters
The fact that a service is important does not make every requested permission or secondary use necessary.

## One action — REQUIRED / OPTIONAL

Choose one service you genuinely need.

Create two columns:

**REQUIRED TO COMPLETE MY TASK**

**OPTIONAL / UNCLEAR**

Inspect:

- profile fields;
- location permission;
- contacts permission;
- photo/file permission;
- marketing email/SMS choices;
- push notifications;
- account linking/sign-in choices.

Change **one clearly optional setting** to the least-exposure setting that still lets the legitimate task work.

Do not provide false identity information. Do not bypass identity, age, fraud, security, financial, employment, or safety controls.

## Check
Complete the legitimate task after the change.

If the task still works, the optional access was not required for that use case.

If the task fails, record exactly what dependency was discovered rather than assuming malicious intent.

## Recover
Restore the setting if the legitimate service requires it and there is no suitable alternative. Clove teaches informed tradeoffs, not purity tests.

## Completion evidence
One changed optional permission/setting **and** successful completion of the actual task, or a documented discovery that the setting was genuinely required.

---

# DS-02 — IDENTITY COMPARTMENTALIZATION

## Mission
Reduce unnecessary linkage between high-value identity/recovery accounts and low-stakes sign-ups without creating a recovery failure.

## Threat
Using one inbox, one recovery route, one public identity and one account pattern for everything creates correlated failure and unnecessary linkage.

## Why it matters
A compromised or spam-saturated low-stakes account should not automatically become the recovery centre for banking, government, health, work, and every disposable sign-up.

## One action — TWO-LANE EMAIL PLAN

Do **not** migrate critical accounts yet.

Define two lanes:

### CRITICAL
Examples: banking, government, primary work, health, password-manager recovery.

### LOW-STAKES
Examples: newsletters, shopping accounts, trials, forums, non-critical downloads and promotions.

Choose an existing secondary address or create a legitimate alias/secondary email supported by your provider for future low-stakes sign-ups.

Then verify that the new/secondary address can actually receive mail and that its own recovery method works.

## Check
Send a test message to the secondary address and complete its legitimate recovery verification without changing any critical account.

## Recover
If recovery is unclear or fragile, stop. Do not migrate anything important until the secondary account has a stable password-manager entry and recovery path.

## Completion evidence
A tested secondary/alias lane and a written rule for which future accounts belong there.

## Never teach
- burner identities to evade law, age gates, fraud controls or platform enforcement;
- false names where accurate identity is required;
- moving all critical accounts in one session.

---

# DS-03 — ATTENTION DEFENSE

## Mission
Make the phone interrupt you less without requiring abstinence from useful technology.

## Threat
Recommendation and notification systems can repeatedly call attention back to a service even when the user did not choose that moment for the service.

## Why it matters
The user should decide when a tool enters the mission, not let every application claim equal interruption rights.

## One action — HUMAN-ONLY INTERRUPTIONS FOR 24 HOURS

Open notification settings.

Turn off push notifications from **one non-human, non-safety-critical category** that does not need immediate response.

Good candidates:

- shopping promotions;
- recommendation alerts;
- game reminders;
- “someone posted” alerts;
- marketing/newsletter app pushes;
- streak reminders.

Do **not** disable emergency alerts, medical alerts, security alerts, two-factor authentication, work-on-call alerts, family/caregiver alerts, or anything the user genuinely depends on for timely safety/obligations.

Record today's notification count or the device's available baseline metric if the operating system exposes one.

## Check
After 24 hours ask:

- Did I miss anything that actually required immediate response?
- How many interruptions disappeared?
- Did I still open the service deliberately when I wanted it?

No claim is made that one day improves mental health or “resets dopamine.” This is an operational interruption test.

## Recover
If a legitimate timely obligation was missed, restore that notification category and choose a less consequential source next time.

## Completion evidence
One notification category changed plus a next-day operational check.

---

# DS-04 — MONEY, PRICES & DIGITAL PERSUASION

## Mission
Distinguish a displayed price, a personalized offer, and an actual documented pricing difference before claiming manipulation.

## Threat
Digital commerce can combine loyalty profiles, targeted offers, rapid price updates, subscriptions and interface design. Users can mistake capability or a coupon difference for proof of individualized base-price discrimination.

## Why it matters
Good stewardship requires receipts, not suspicion.

## One action — PRICE RECEIPT

Choose one ordinary, non-urgent product or service.

Record at the same approximate time:

1. the ordinary displayed/base price;
2. any logged-in loyalty/member offer;
3. any public promotion;
4. taxes/fees visible before purchase;
5. whether the offer requires account data, a subscription, auto-renewal or another condition.

Where practical and permitted, compare the public/logged-out view with the logged-in view.

Do not create fake identities, defeat access controls, manipulate geolocation, scrape at scale, or harass staff.

## Check
Classify what you actually observed:

- `SAME BASE PRICE`
- `PERSONALIZED OR MEMBER OFFER`
- `PUBLIC PROMOTION`
- `DIFFERENT BASE PRICE — CAUSE UNKNOWN`
- `NOT COMPARABLE`

A difference is evidence of a difference, not automatically evidence of why it occurred.

## Recover
If a subscription/trial condition was accepted unintentionally, document and use the normal cancellation/refund path promptly. Preserve the receipt/confirmation.

## Completion evidence
One dated price/offer comparison with a mechanism classification that does not exceed the evidence.

---

# DS-05 — REPUTATION, INTIMATE CONTENT & FUTURE OPTIONALITY

## Mission
Make a high-consequence publication decision with the future audience included before anything is posted.

## Threat
Content can be copied, scraped, downloaded, reposted or shown outside the intended audience. Public sexualized material can also create context-dependent professional or relationship stigma.

## Why it matters
The platform's immediate audience is not the only plausible future audience, and deleting the source does not guarantee every downstream copy disappears.

## One action — FUTURE-AUDIENCE CHECK

Use a **hypothetical item or an item that has NOT yet been uploaded**. Clove never asks the user to upload intimate material for this drill.

Answer:

1. Who is the intended audience?
2. Who is a plausible unintended audience?
3. Could a viewer save/copy/screenshot it?
4. Would I still accept publication if a future employer, partner, family member or stranger saw it?
5. What part is reversible?
6. What part may not be recoverable if copied?
7. If money is the reason, what evidence do I have about realistic earnings rather than celebrity examples?
8. What fees, taxes, promotion work or platform dependence have I included in the decision?

Then choose one of:

- `POST AS PLANNED`
- `REDUCE IDENTIFYING DETAIL`
- `CHANGE AUDIENCE / FORMAT`
- `WAIT 24 HOURS`
- `DO NOT POST`

Clove does not score one choice as morally superior. Completion is a deliberate decision with the tradeoff visible.

## Check
The user must be able to state the worst plausible audience expansion they are accepting and the recovery steps available if copying occurs.

## Recover — if content is already circulating unwanted

1. preserve URLs/screenshots/timestamps needed as evidence;
2. use the host/platform's reporting and removal route;
3. request search-engine delisting/removal where applicable;
4. protect accounts and credentials if compromise is involved;
5. escalate unlawful non-consensual intimate-image distribution, threats, stalking or extortion to the appropriate platform, specialist service or authority;
6. keep checking proportional to the incident—do not turn recovery into endless compulsive searching.

Removal can reduce exposure even when full downstream erasure cannot be guaranteed.

## Completion evidence
A completed future-audience decision; no intimate file is collected by Clove.

## Never teach
- “everything is permanent forever”;
- inevitable unemployment, relationship failure or social ruin;
- exact OnlyFans median/top-percentile earnings without a defensible dataset;
- unsupported claims that one sex has a guaranteed monetization advantage;
- shame as risk communication.

---

# DS-06 — RECOVERY

## Mission
Prove that one important digital service can be recovered without waiting for a real emergency.

## Threat
Security controls are useless when the legitimate user cannot recover from device loss, forgotten credentials, compromise or provider failure.

## Why it matters
Recovery designed during a crisis is usually worse than recovery tested beforehand.

## One action — LOST-PHONE TABLETOP

Do **not** destroy, wipe, lock or reset the real phone.

Choose one important but non-catastrophic account and answer:

- Where is the password stored?
- What is the second factor?
- If the phone disappeared, what alternative factor or recovery route exists?
- Is the recovery email/number current?
- Are backup/recovery codes available where appropriate?
- Is important user data backed up/exportable?
- Where is the provider's official compromise/recovery page?

Then test **one safe recovery component** that does not lock you out—for example, verify the recovery email/phone shown in account settings, confirm backup-code presence, or sign in on a second trusted browser using the normal path.

## Check
The user must be able to narrate the first three actions after losing the device without relying on information stored only on that lost device.

## Recover
If the test exposes a single point of failure, repair that one dependency first. Do not rotate every password, factor and recovery method at once unless an actual compromise requires it.

## Completion evidence
One verified recovery component plus a written three-step lost-device response.

---

# Cross-module safety firewall

No Digital Stewardship drill may require the user to:

- upload private or intimate material to Clove;
- disclose passwords, recovery codes, identity documents, exact home location, health information or financial-account details to Clove;
- break a site's terms or defeat legitimate identity/security controls;
- spend money;
- delete a critical account as a test;
- deliberately expose themselves to fraud/scams;
- induce harassment or interpersonal conflict;
- conduct compulsive repeated monitoring;
- make a medical, legal, employment or financial decision based on Clove alone.

# Measurement contract — not yet implemented

If public product integration is later authorized, aggregate measurement may record only coarse events such as module start/completion and recovery-path completion class. It must not transmit:

- account/provider names entered by the user;
- email addresses or phone numbers;
- mission/drill free text;
- intimate-content descriptions;
- URLs containing personal identifiers;
- price screenshots/receipts;
- passwords, backup codes or authentication data.

Any telemetry implementation requires a separate privacy-contract test before deployment.

# Candidate terminal question

Can a low-literacy adult complete each drill with a useful observable change while understanding the actual evidence boundary and without being pushed toward fear, shame, evasion, oversharing or lockout?

Until that question survives the review gate, this curriculum remains **NOT PUBLIC**.
