# CloveLearn v2 — Digital Stewardship F0.5 Review Gate

Status: **PASS_WITH_DISCLOSED_LIMITS — INTERNAL ADVERSARIAL REVIEW**

Reviewed candidate: `docs/CLOVE_V2_DIGITAL_STEWARDSHIP_CURRICULUM_V0_1.md`
Candidate repair commit: `eb06947805c894db0e02dc36c34ae2098fd18493`
Evidence authority: `docs/CLOVE_V2_DIGITAL_STEWARDSHIP_CLAIM_LEDGER.md`

## Purpose

Determine whether the exact curriculum candidate can proceed from evidence design into bounded implementation without fear inflation, unsupported causal claims, accidental shame, unsafe account changes, unlawful-evasion guidance, privacy leakage, or passive-reading completion.

This is **not** a human-usability study and is **not** an independent external review.

---

## Gate 1 — Evidence replay

### DS-00 KNOW THE MACHINE

Claim boundary: deleting an app is not equivalent to deleting an account/provider-held information; recovery and provider-side controls must be checked.

Authoritative support:
- Office of the Privacy Commissioner of Canada, “5 tips to protect your privacy online”: deleting an app does not itself close the account; deactivation is distinct from provider-side deletion.
  https://www.priv.gc.ca/en/privacy-topics/technology/online-privacy-tracking-cookies/online-privacy/protecting-your-privacy-online/

Ruling: **PASS**.

### DS-01 SURVIVE THE FORCED GRID

Claim boundary: users may reduce optional data/permission exposure while preserving required service functions.

Authoritative support:
- OPC privacy-settings guidance recommends limiting information and disabling app permissions that are not needed, while recognizing that withholding information is not always practical or possible.
  https://www.priv.gc.ca/en/privacy-topics/technology/online-privacy-tracking-cookies/online-privacy/gd_ps_201903/
- OPC deceptive-design guidance documents privacy-unfriendly defaults and steering toward unnecessary collection.
  https://www.priv.gc.ca/en/privacy-topics/technology/online-privacy-tracking-cookies/online-privacy/deceptive-design/gd_dd-ind/

Ruling: **PASS**. The drill explicitly restores a setting when the legitimate task genuinely depends on it and prohibits bypass of identity/security controls.

### DS-02 IDENTITY COMPARTMENTALIZATION

Claim boundary: separate low-stakes and critical account/recovery contexts where provider-supported and lawful; do not teach false identities or control evasion.

Authoritative support:
- Canadian Centre for Cyber Security guidance emphasizes unique account credentials and warns that password reuse creates correlated compromise risk.
  https://www.cyber.gc.ca/en/guidance/rethink-your-password-habits-protect-your-accounts-hackers-itsap30036

Ruling: **PASS AS DESIGN PRACTICE**. The exact two-lane email pattern is a Clove operational design, not presented as a population-level empirical fact.

### DS-03 ATTENTION DEFENSE

Claim boundary: test whether one non-essential notification category is operationally necessary; no mental-health, addiction or dopamine claim.

Ruling: **PASS**. This is explicitly a 24-hour interruption experiment. Safety, security, medical, two-factor-authentication, caregiver and on-call alerts are excluded.

Repair applied during review: “HUMAN-ONLY INTERRUPTIONS” was renamed **INTENTIONAL INTERRUPTIONS** because important machine-generated security/medical alerts are intentionally retained.

### DS-04 MONEY, PRICES & DIGITAL PERSUASION

Claim boundary: compare observable prices/offers without inferring an unknown personalization mechanism.

Authoritative support:
- Competition Bureau guidance documents drip pricing and the importance of attainable represented prices.
  https://competition-bureau.canada.ca/en/deceptive-marketing-practices/drip-pricing
- Competition Bureau subscription-trap guidance recommends checking terms, cancellation clauses and preserving receipts/communications.
  https://competition-bureau.canada.ca/en/fraud-and-scams/tips-and-advice/subscription-traps

Ruling: **PASS**. The drill expressly classifies unexplained differences as `CAUSE UNKNOWN` and prohibits fake identities, access-control bypass, geolocation manipulation and scaled scraping.

### DS-05 REPUTATION, INTIMATE CONTENT & FUTURE OPTIONALITY

Claim boundary: online content may be copied/scraped beyond the uploader's control; professional/relationship consequences are context-dependent; Clove does not determine whether conduct is criminal.

Authoritative support:
- OPC social-media guidance: online material can be copied/shared, may affect reputation and may be difficult to delete.
  https://www.priv.gc.ca/en/privacy-topics/technology/online-privacy-tracking-cookies/online-privacy/social-media/02_05_d_74_sn
- OPC-led international data-scraping statement: deletion from the source does not guarantee already-scraped copies stop being used/shared.
  https://www.priv.gc.ca/en/opc-news/speeches-and-statements/2023/js-dc_20230824/
- Criminal Code s. 162.1 defines the Canadian offence of publication/distribution/etc. of an intimate image without consent subject to the section's specific elements and definitions.
  https://laws-lois.justice.gc.ca/eng/acts/C-46/section-162.1.html

Ruling: **PASS AFTER REPAIR**.

Repair applied during review:
- replaced “worst plausible audience” with **a plausible unintended audience** to reduce threat inflation;
- legal escalation now says conduct **may** violate law or platform rules, notes that legal definitions vary by jurisdiction, and states that Clove does not determine whether an offence occurred.

### DS-06 RECOVERY

Claim boundary: authentication security needs a recovery path when an authentication factor is lost or compromised.

Authoritative support:
- Canadian Centre for Cyber Security MFA guidance expressly recommends a clear recovery plan for lost or compromised authentication factors.
  https://www.cyber.gc.ca/en/guidance/security-layers-multi-factor-authentication
- Current Cyber Centre MFA guidance likewise treats recovery planning as part of MFA deployment.
  https://www.cyber.gc.ca/en/guidance/secure-your-accounts-and-devices-multi-factor-authentication-itsap30030

Ruling: **PASS AFTER REPAIR**.

Repair applied during review: absolute language that security controls are “useless” without recovery was replaced with the narrower fact that a control can become an access problem for a legitimate user when the only factor is lost/compromised.

---

## Gate 2 — Fear inflation

Checks:
- no universal “you are being watched” language;
- no “everything is permanent forever” claim;
- no assumption that retailers use individualized surveillance pricing;
- no dopamine-reset/addiction claim;
- no inevitable career, dating, relationship or social-ruin language;
- no instruction to continuously monitor for leaks or threats.

Result: **PASS**.

The curriculum uses bounded consequences and explicit uncertainty. DS-05 additionally limits repeated checking to what is proportional to the incident.

---

## Gate 3 — Shame / culture-war contamination

Checks:
- no degrading term for creators/users;
- no moral score for intimate-content publication choices;
- no sex-specific creator-economics claim not supported by evidence;
- no “most girls” claim;
- no prediction that men as a class will abandon dating;
- no masculinity/femininity test embedded in Digital Stewardship.

Result: **PASS**.

DS-05 treats intimate-content publishing as an optionality and control decision, not a character judgment.

---

## Gate 4 — Unsafe account/device changes

Checks:
- no forced logout;
- no destructive device reset/wipe;
- no deletion of critical account as a test;
- no mass credential rotation absent a real compromise;
- no migration of critical accounts during the compartmentalization drill;
- no spending requirement;
- no deliberate scam/fraud exposure.

Result: **PASS**.

Every account-changing drill has an abort/recovery path.

---

## Gate 5 — Legal / evasion boundary

Checks:
- no fake identity instruction where accurate identity is required;
- no age-gate, fraud-control or security-control bypass;
- no terms-of-service circumvention as an instructional goal;
- no geolocation manipulation or scaled scraping for price testing;
- no conclusion that a particular incident is criminal.

Result: **PASS**.

Disclosed legal limit: laws vary by jurisdiction and circumstance. The curriculum is general digital-stewardship education, not legal advice.

---

## Gate 6 — Privacy / collection boundary

The candidate explicitly forbids Clove from requiring:
- intimate/private uploads;
- passwords or recovery codes;
- identity documents;
- exact home location;
- health or financial-account details;
- provider/account names in future aggregate telemetry;
- drill free text or intimate descriptions in telemetry;
- receipts/screenshots or authentication data in telemetry.

Result: **PASS AT DESIGN LEVEL**.

Disclosed implementation dependency: no future telemetry is cleared merely by this document. Any implementation requires a separate privacy-contract test that proves payloads obey these exclusions.

---

## Gate 7 — Action completeness

Each module has one primary observable completion:

| Module | Observable completion |
|---|---|
| DS-00 | five-box map + verified recovery method |
| DS-01 | one optional permission/setting tested against the real task |
| DS-02 | tested secondary/alias lane + usage rule |
| DS-03 | one notification category changed + next-day check |
| DS-04 | dated price/offer comparison + evidence-bounded classification |
| DS-05 | future-audience decision; no upload to Clove |
| DS-06 | one verified recovery component + three-step lost-device response |

Result: **PASS**.

No module can be completed merely by reading or agreeing.

---

## Gate 8 — Low-literacy / “flashing 12:00” standard

Internal review finds the underlying tasks bounded and sequential, but the Markdown specification remains too dense to establish that an inexperienced adult can complete the drill without help.

Result: **NOT PROVEN BY INTERNAL REVIEW**.

Required implementation rule:
- one decision/action per screen;
- plain-language term before technical term;
- no paragraph wall in the user interface;
- visible `STOP / I DON'T KNOW` route;
- safe default where a user is uncertain;
- optional evidence/explanation behind a secondary disclosure;
- completion must be observable without demanding sensitive data.

This limitation does not invalidate the evidence foundation. It limits what may be claimed about usability.

---

# Terminal verdict

**F0.5 curriculum foundation: `PASS_WITH_DISCLOSED_LIMITS`**

What this verdict establishes:
- DS-P01 through DS-P12 were adjudicated rather than imported as ideology;
- public teaching copy has a bounded evidence basis;
- the seven candidate drills end in real actions/checks;
- known fear/shame/legal/recovery defects found by internal review were repaired;
- privacy and safety constraints are explicit enough to become implementation contracts.

What it does **not** establish:
- that the curriculum is “caveman-proof” in practice;
- that users understand the copy without assistance;
- that the drills change long-term behaviour;
- that they improve mental health, finances, relationships or security outcomes;
- independent external reviewer agreement.

Those remain **HUMAN EVIDENCE PENDING**, not silently assumed.

# Next independently judgeable unit

**DS-I0 — build only DS-00 KNOW THE MACHINE as a non-public, local-first product slice.**

Locked requirements:
1. one action/decision per screen;
2. no account/provider name or free text transmitted;
3. local state only unless a future privacy gate explicitly authorizes otherwise;
4. `STOP / I DON'T KNOW` paths cannot count as failure or trigger pressure;
5. no forced logout or destructive account test;
6. exact source-to-deployment package test before any release;
7. Chromium + Firefox + keyboard + 390px mobile + reduced-motion replay;
8. malformed/corrupted local state and storage-failure injection;
9. copy test against this evidence ledger;
10. terminal state only: `SOLO_HARDENED / HUMAN_EVIDENCE_PENDING`, `REPAIR_REQUIRED`, or `RETIRE`.

DS-01 through DS-06 remain **LOCKED / NOT IMPLEMENTED** until DS-I0 reaches a terminal state.
