# CloveLearn v2 — Digital Stewardship Claim Ledger

Status: **ACTIVE / PRE-PUBLICATION EVIDENCE GATE**

This ledger separates durable design principles from claims that require external evidence before Clove teaches them as fact.

## LOCKED — design principles

### DS-L01 — Digital systems should be used for a defined objective, not allowed to redefine the objective.
Status: `LOCKED`

### DS-L02 — Data minimization
Collect or disclose only what is necessary for the task, subject to legitimate legal, safety, account-recovery, and service requirements.
Status: `LOCKED`

### DS-L03 — Local/private by default
Sensitive user-authored content should remain local when server-side storage is unnecessary. Aggregate telemetry must not contain user-authored mission content.
Status: `LOCKED`

### DS-L04 — Compartmentalization
Separate unrelated digital contexts when doing so is lawful, safe, and supported. Avoid unnecessary creation of one universal identity graph.
Status: `LOCKED`

### DS-L05 — Recovery is part of stewardship
Backups, account recovery, device loss, compromise response, cancellation paths, and export are first-class requirements.
Status: `LOCKED`

### DS-L06 — Future-audience test
Before publishing high-consequence content, users should consider audiences beyond the intended recipient and the possibility of copying, redistribution, or context collapse.
Status: `LOCKED`

### DS-L07 — Capability is not evidence of use
A system being technically capable of profiling, rapid price changes, tracking, or personalization is not proof that a named company is using that capability in a claimed way.
Status: `LOCKED`

### DS-L08 — Clove teaches proportional risk, not paranoia
Threat statements require bounded likelihood, consequence, and evidence. Safety guidance must not encourage unlawful evasion, obsessive checking, or isolation.
Status: `LOCKED`

---

## ADJUDICATED — evidence reviewed

### DS-P01 — Modern participation can create practical smartphone/account dependency
Claim class: prevalence / access inequality.
Ruling: digital access/account dependency is materially consequential; universal smartphone-mandatory language is too strong.
Admissible wording: Internet access, digital accounts and mobile connectivity are deeply embedded in Canadian daily life and public-service access, but service-specific non-digital/accessibility alternatives must be checked rather than assumed absent.
Evidence record: `docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_01_ACCESS_PRICING.md`.
Status: `SUPPORTED — NARROWED`

### DS-P02 — Canadian grocers use individualized surveillance pricing
Claim class: current commercial practice.
Ruling: rich grocery loyalty profiling, transaction data and personalized offers are established; current evidence reviewed does not establish individualized higher grocery base/shelf prices tied to a named shopper profile.
Admissible wording: personalized offers and personalized base prices are different mechanisms; do not claim the latter for a retailer without evidence of actual price selection using consumer-specific data.
Evidence record: `docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_01_ACCESS_PRICING.md`.
Status: `UNSUPPORTED AS GENERAL CURRENT-PRACTICE CLAIM / RETIRE AS FACT`

### DS-P03 — Electronic shelf labels create a surveillance-pricing threat
Claim class: capability-to-risk inference.
Ruling: electronic shelf labels can reduce the time/cost of centralized price updates, but are only the display layer and do not themselves establish shopper identification or personalized pricing.
Required distinction: display layer vs price-selection layer vs identity/data layer.
Evidence record: `docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_01_ACCESS_PRICING.md`.
Status: `SUPPORTED ONLY AFTER SPLITTING THE CLAIM`

### DS-P04 — Attention products are designed to exploit psychological vulnerabilities
Claim class: design practice / behavioral mechanism.
Ruling: major recommendation/notification systems explicitly learn from behavioral signals and optimize ranking against engagement and other objectives; Canadian regulators document deceptive design capable of steering behavior. Universal dopamine/addiction/psychologist-intent language is not established.
Admissible wording: many large platforms learn from interactions and optimize content/notification ranking using predicted engagement and other behavioral signals; configure defaults and measure whether the system served the user's stated objective.
Evidence record: `docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_02_ATTENTION_FREE_APPS.md`.
Status: `SUPPORTED MECHANISM / ORIGINAL INTENT LANGUAGE TOO STRONG`

### DS-P05 — Free apps generally monetize behavioral data
Claim class: business-model prevalence.
Ruling: major ad-supported services such as Meta and parts of Google earn substantial/dominant advertising revenue and use activity data in ad personalization/measurement, but free products can use many other business models.
Admissible wording: a zero-dollar price does not identify the business model; find who pays, what event creates revenue, what data supports the service versus advertising/analytics, and what controls exist.
Evidence record: `docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_02_ATTENTION_FREE_APPS.md`.
Status: `SUPPORTED FOR SPECIFIC AD-SUPPORTED SERVICES / RETIRE AS UNIVERSAL RULE`

---

## PROVISIONAL — evidence required before public use

### DS-P06 — OnlyFans / subscription adult-content income is highly concentrated
Claim class: earnings distribution.
Need: primary platform financial data or reproducible independent dataset; do not use scraped marketing statistics as the sole evidence.
Status: `PROVISIONAL`

### DS-P07 — Adult subscription audiences are strongly male-skewed
Claim class: audience demographics.
Need: reliable platform or survey methodology, sample definition, geography, year, and distinction between visitors, subscribers, and paying customers.
Status: `PROVISIONAL`

### DS-P08 — Straight women have an easier path than straight men to monetize explicit content to the other sex
Claim class: sex-specific market asymmetry.
Need: demand-side spending data, creator earnings by sex/orientation where available, alternative explanations, and uncertainty bounds.
Status: `PROVISIONAL`

### DS-P09 — Sexualized digital content creates future relationship or employment penalties
Claim class: downstream reputational effect.
Need: sector-specific employment evidence and relationship-preference research. Must distinguish individual preference, discrimination, occupational rules, security clearances, and speculation.
Status: `PROVISIONAL`

### DS-P10 — Content cannot be scrubbed from the internet
Claim class: permanence.
Allowed weaker statement: deletion from the original platform does not guarantee all copies are gone.
Need: evidence on redistribution, caches, mirrors, archives, piracy, legal removal, delisting, and practical erasure limits.
Status: `PROVISIONAL`

### DS-P11 — Men will withdraw from dating/adult-content markets in response to widespread sexualized content creation
Claim class: forecast / cultural hypothesis.
Need: longitudinal behavior data. This is prediction, not present fact.
Status: `PROVISIONAL`

### DS-P12 — “Most girls are on OnlyFans”
Claim class: prevalence.
Current ruling: unsupported and not admissible without population-denominator evidence.
Status: `PROVISIONAL / PRESUMED FALSE UNTIL SHOWN OTHERWISE`

---

## RETIRED AS PUBLIC COPY

### DS-R01 — “If you are not paying for the product, you are the product.”
Reason: memorable heuristic but false as a universal rule.
Replacement: identify the actual business model and the value exchanged.
Status: `RETIRED`

### DS-R02 — “Everything uploaded is permanent forever.”
Reason: overstatement.
Replacement: assume high-consequence content may be copied beyond your control; deletion from one service cannot guarantee deletion of all copies.
Status: `RETIRED`

### DS-R03 — Degrading labels for creators as an educational device
Reason: moral insult reduces analytical precision and makes the curriculum less useful to people who most need the risk information.
Replacement: discuss sexualized content, sex work, intimate-content monetization, optionality, market incentives, consent, leakage, safety, income distribution, and future preference conflicts directly.
Status: `RETIRED`

### DS-R04 — “Clean/unharvested digital footprint is the ultimate luxury commodity.”
Reason: rhetorical prediction presented as fact.
Replacement: privacy and reputational optionality can have value; quantify when possible.
Status: `RETIRED AS FACT / MAY SURVIVE AS CLEARLY LABELED THESIS`

---

## Evidence acceptance rule

For a claim to move from `PROVISIONAL` to `SUPPORTED` or `LOCKED FACT`, record:

- exact claim wording;
- jurisdiction/population;
- relevant date range;
- primary source where possible;
- independent corroboration when practical;
- denominator and sample method for quantitative claims;
- capability vs observed-use distinction;
- strongest credible counterevidence;
- wording downgrade if the evidence supports only a narrower claim.

A culturally satisfying claim does not receive a lower evidence threshold.
