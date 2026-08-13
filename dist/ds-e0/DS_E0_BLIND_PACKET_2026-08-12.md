# Candidate A — Digital Stewardship DS-00 through DS-06

This is a frozen evaluation packet. Development chronology, issue/PR identifiers, prior test failures, mutation-test history, previous terminal verdicts, and next-step instructions have been intentionally omitted. Current substantive evidence rulings, prohibited claims, safety/privacy boundaries, implementation contracts, and runtime source are retained.

The candidate is non-public. The release-integrity evidence at the end of this packet is part of what must be judged; this packet itself does not authorize deployment.

---

# Independent Evaluation Instructions

You are evaluating **Candidate A**, a non-public adult Digital Stewardship curriculum. Judge only the material in this packet. Do not assume that conservative wording deserves a pass; judge whether the actual teaching is supported, actionable, safe, understandable, and bounded. Do not infer a desired verdict.

Do not return partial scores. Assess all eight gates before returning one complete response. If the packet does not contain enough information to judge a gate, use NOT_JUDGEABLE rather than filling the gap from assumptions.

For each gate choose exactly one: **PASS / REPAIR_REQUIRED / NOT_JUDGEABLE**. Give one short reason. If REPAIR_REQUIRED, quote or identify the exact offending text.

## Eight gates

1. **Evidence fidelity** — no runtime teaching materially exceeds the adjudicated claim ledger or evidence summaries.
2. **Actionability** — each module produces a concrete inspect/decide/check/recover action rather than passive reading.
3. **Fear/paranoia control** — uncertainty or capability is not presented as proof of surveillance, compromise, manipulation, or inevitable harm.
4. **Privacy/data minimization** — drills do not request unnecessary identity, credentials, intimate content, or other sensitive data.
5. **Recovery safety** — account/security guidance does not induce destructive changes or bypass legitimate recovery/safety controls.
6. **Reputation/sexual-content safety** — no shame, purity, gender-worth, permanence absolutism, or universal career/relationship penalty claim.
7. **Low-literacy usability on paper** — instructions appear understandable without specialist security/privacy vocabulary.
8. **Release integrity** — packet evidence shows this candidate remains non-public and technical hardening alone is not presented as public-deployment authorization.

## Overall verdict

After all eight gates, choose exactly one:
- **EXTERNAL_PASS / HUMAN_EVIDENCE_PENDING** — all eight gates PASS.
- **REPAIR_REQUIRED** — one or more gates are REPAIR_REQUIRED.
- **NOT_JUDGEABLE** — no gate requires repair, but at least one gate is NOT_JUDGEABLE.

End with a compact list of any exact text requiring repair. Do not propose new product features.

---

# Part I — Foundation

### docs/CLOVE_V2_DIGITAL_STEWARDSHIP_FOUNDATION.md

```markdown
# CloveLearn v2 — Digital Stewardship Foundation

## Project-manager ruling

Digital Stewardship is a governing CloveLearn foundation, not an optional content topic.

CloveLearn teaches two forms of agency together:

1. **Operational agency** — choose a useful real-world action, execute it, observe the result, learn, and continue.
2. **Digital agency** — use digital systems intentionally while protecting identity, attention, money, privacy, reputation, recovery paths, and future options.

Mission 001 remains valid and is not reopened by this foundation.

The source metaphor is the **“flashing 12:00” problem**: interface competence is not systems competence. Clove should assume a user can tap a phone but may not understand accounts, cloud storage, permissions, identifiers, tracking, recovery, copying, or platform incentives.

---

# 1. Core definitions

## Digital agency

The practical ability to choose how technology is used instead of being passively carried by defaults, interfaces, incentives, or algorithms.

A user should be able to answer:

- What am I trying to accomplish?
- What system am I entering?
- What information does it actually need?
- What am I giving away that it does not need?
- What could link this activity back to me?
- What happens if this account, device, service, or company disappears?
- What future option am I trading for this convenience?
- How do I leave, recover, or reverse the action?

## Digital stewardship

The ongoing responsibility to manage digital identity, data, devices, accounts, communications, reputation, and records across their lifecycle.

**Stewardship is not secrecy. It is deliberate custody.**

## Digital discipline

Use the least exposure, least privilege, least permanence, and least attention necessary to complete the actual task.

Clove does not teach paranoia as competence. The objective is proportional risk management.

---

# 2. Civilian operating principles

These adapt general operational habits without militarizing ordinary life.

## Mission before tool
Define the real objective first. Do not let the app, feed, notification, or device become the mission.

## Need-to-know / data minimization
Give a system only the information required for the legitimate task, subject to legal, safety, recovery, and service requirements.

## Compartmentalization
Avoid unnecessarily binding unrelated low-stakes and high-value activities to one permanent identity/recovery path. This must remain lawful and must not be used to evade legitimate identity, age, fraud, employment, financial, or safety controls.

## Signature awareness
Understand that an action can reveal more than the text a user explicitly types: location, timing, device/account identifiers, purchase patterns, metadata, and cross-account linkage may matter depending on the service.

## Redundancy
Do not let one device, platform, account, or recovery method become an unnecessary single point of failure for important access or records.

## After-action review
After a meaningful scam attempt, account compromise, privacy mistake, bad purchase, or recovery failure, record what happened, what signal was missed, what control failed, and what changes next.

## Abort criteria
When a digital task begins requesting information, permissions, money, urgency, or access inconsistent with the original mission, stop and reassess.

---

# 3. “Flashing 12:00” teaching standard

Every user-facing drill follows:

`THREAT → WHY → ONE ACTION → CHECK → RECOVER`

Rules:

- one unfamiliar concept or decision at a time;
- plain language before technical terminology;
- observable checks instead of abstract warnings;
- safe defaults;
- visible `STOP / I DON'T KNOW` paths;
- distinguish required disclosure from optional disclosure;
- distinguish inconvenience from genuine exclusion;
- never shame prior mistakes;
- recovery is part of the lesson, not an appendix;
- reading or agreeing is never completion.

The Markdown specification may be detailed. The eventual user interface must not be a paragraph wall.

---

# 4. Evidence-locked threat boundaries

## Digital dependency
Internet access, digital accounts, and mobile connectivity are deeply embedded in modern Canadian life, but Clove does not claim a smartphone is literally mandatory for every service or person.

## Identity linkage and permissions
Digital services may request or collect information beyond the minimum a user needs for a specific task. Clove teaches inspection and minimization where supported, not blanket refusal.

## Attention systems
Large digital platforms can learn from interaction signals and optimize recommendations/notifications against engagement and other objectives. Clove does **not** teach a universal dopamine-addiction story or claim psychologists intentionally engineered every product to addict users.

## Prices and persuasion
Electronic shelf labels, loyalty profiles, targeted offers, dynamic systems, subscriptions, and deceptive design are distinct mechanisms. Clove does **not** claim a named grocer uses individualized base-price “surveillance pricing” without evidence of actual consumer-specific price selection.

## Reputation and copying
Deleting a source copy does not guarantee all screenshots, downloads, scraped copies, reposts, or archives disappear. Removal and delisting can still reduce exposure; fatalism is not stewardship.

## Intimate-content economics
Platform aggregate payouts do not establish typical creator income. Published sexual-use samples of OnlyFans lean male, but no representative platform-wide gender census was established. Claims of guaranteed female monetization advantage, inevitable career/relationship ruin, “most girls are on OnlyFans,” or male population withdrawal from dating are not admissible as facts.

## Recovery
Security controls need workable recovery paths. Clove tests recovery safely; it does not deliberately lock users out, wipe devices, or destroy critical accounts to prove a point.

---

# 5. Curriculum architecture

- **DS-00 — KNOW THE MACHINE**: device vs software vs account vs provider vs recovery.
- **DS-01 — SURVIVE THE FORCED GRID**: necessary task, minimum unnecessary exposure.
- **DS-02 — IDENTITY COMPARTMENTALIZATION**: lawful separation of low-stakes and critical contexts.
- **DS-03 — ATTENTION DEFENSE**: intentional interruption rights and scheduled use.
- **DS-04 — MONEY, PRICES & DIGITAL PERSUASION**: receipts, offers, subscriptions, conditions, and mechanism discipline.
- **DS-05 — REPUTATION, INTIMATE CONTENT & FUTURE OPTIONALITY**: future audience, copying, realistic economics, and recovery without shame.
- **DS-06 — RECOVERY**: account/device loss, compromise, evidence preservation, and restoration.
- **DS-07 — AI-MEDIATED REALITY**: future module only; not yet evidence-gated or authorized.

The exact v0.1 drills for DS-00 through DS-06 are frozen in `CLOVE_V2_DIGITAL_STEWARDSHIP_CURRICULUM_V0_1.md`.

---

# 6. Product constitution

Digital Stewardship must not turn Clove into another reading website.

Every implemented module must:

- produce a real configuration change, verified recovery path, or observable check;
- collect no user-authored content when an aggregate event is sufficient;
- keep sensitive state local when server-side storage is unnecessary;
- never reward oversharing;
- state what data is required, why, how long it persists, and how the user exits;
- preserve a safe route back after uncertainty or failure;
- undergo a separate privacy-contract test before any telemetry is authorized.

---

# 7. Retired / prohibited public claims

Do not teach as fact:

- “Canadian grocers use individualized surveillance pricing” as a general current-practice claim;
- electronic shelf labels as proof of personalized pricing;
- “if you are not paying, you are the product” as a universal economic law;
- “everything uploaded is permanent forever”;
- “most girls are on OnlyFans”;
- exact OnlyFans median/top-percentile income claims without a defensible dataset and denominator;
- a platform-wide subscriber-sex percentage without representative methodology;
- guaranteed sex-specific monetization advantage;
- inevitable unemployment, relationship failure, or family-formation consequences from sexualized content;
- a prediction that men will collectively withdraw from dating because of OnlyFans or sexualized-content creation;
- universal dopamine/addiction explanations;
- burner/fake identity advice used to defeat legitimate controls.

A culturally satisfying claim does not receive a lower evidence threshold.

---
```

### docs/CLOVE_V2_DIGITAL_STEWARDSHIP_CLAIM_LEDGER.md

```markdown
# CloveLearn v2 — Digital Stewardship Claim Ledger

This ledger separates durable design principles from claims that require external evidence before Clove teaches them as fact.

## LOCKED — design principles

### DS-L01 — Digital systems should be used for a defined objective, not allowed to redefine the objective.

### DS-L02 — Data minimization
Collect or disclose only what is necessary for the task, subject to legitimate legal, safety, account-recovery, and service requirements.

### DS-L03 — Local/private by default
Sensitive user-authored content should remain local when server-side storage is unnecessary. Aggregate telemetry must not contain user-authored mission content.

### DS-L04 — Compartmentalization
Separate unrelated digital contexts when doing so is lawful, safe, and supported. Avoid unnecessary creation of one universal identity graph.

### DS-L05 — Recovery is part of stewardship
Backups, account recovery, device loss, compromise response, cancellation paths, and export are first-class requirements.

### DS-L06 — Future-audience test
Before publishing high-consequence content, users should consider audiences beyond the intended recipient and the possibility of copying, redistribution, or context collapse.

### DS-L07 — Capability is not evidence of use
A system being technically capable of profiling, rapid price changes, tracking, or personalization is not proof that a named company is using that capability in a claimed way.

### DS-L08 — Clove teaches proportional risk, not paranoia
Threat statements require bounded likelihood, consequence, and evidence. Safety guidance must not encourage unlawful evasion, obsessive checking, or isolation.

---

## ADJUDICATED — evidence reviewed

### DS-P01 — Modern participation can create practical smartphone/account dependency
Claim class: prevalence / access inequality.
Ruling: digital access/account dependency is materially consequential; universal smartphone-mandatory language is too strong.
Admissible wording: Internet access, digital accounts and mobile connectivity are deeply embedded in Canadian daily life and public-service access, but service-specific non-digital/accessibility alternatives must be checked rather than assumed absent.
Evidence record: `docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_01_ACCESS_PRICING.md`.

### DS-P02 — Canadian grocers use individualized surveillance pricing
Claim class: current commercial practice.
Ruling: rich grocery loyalty profiling, transaction data and personalized offers are established; current evidence reviewed does not establish individualized higher grocery base/shelf prices tied to a named shopper profile.
Admissible wording: personalized offers and personalized base prices are different mechanisms; do not claim the latter for a retailer without evidence of actual price selection using consumer-specific data.
Evidence record: `docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_01_ACCESS_PRICING.md`.

### DS-P03 — Electronic shelf labels create a surveillance-pricing threat
Claim class: capability-to-risk inference.
Ruling: electronic shelf labels can reduce the time/cost of centralized price updates, but are only the display layer and do not themselves establish shopper identification or personalized pricing.
Required distinction: display layer vs price-selection layer vs identity/data layer.
Evidence record: `docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_01_ACCESS_PRICING.md`.

### DS-P04 — Attention products are designed to exploit psychological vulnerabilities
Claim class: design practice / behavioral mechanism.
Ruling: major recommendation/notification systems explicitly learn from behavioral signals and optimize ranking against engagement and other objectives; Canadian regulators document deceptive design capable of steering behavior. Universal dopamine/addiction/psychologist-intent language is not established.
Admissible wording: many large platforms learn from interactions and optimize content/notification ranking using predicted engagement and other behavioral signals; configure defaults and measure whether the system served the user's stated objective.
Evidence record: `docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_02_ATTENTION_FREE_APPS.md`.

### DS-P05 — Free apps generally monetize behavioral data
Claim class: business-model prevalence.
Ruling: major ad-supported services such as Meta and parts of Google earn substantial/dominant advertising revenue and use activity data in ad personalization/measurement, but free products can use many other business models.
Admissible wording: a zero-dollar price does not identify the business model; find who pays, what event creates revenue, what data supports the service versus advertising/analytics, and what controls exist.
Evidence record: `docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_02_ATTENTION_FREE_APPS.md`.

### DS-P06 — OnlyFans / subscription adult-content income is highly concentrated
Claim class: earnings distribution.
Ruling: Fenix International's public accounts establish billions in aggregate creator payouts and millions of creator accounts, but do not publish a creator-income median or percentile distribution. Selected research and proprietary datasets show very wide outcomes, but do not justify exact platform-wide top-percentile claims.
Admissible wording: headline platform payouts do not tell you what a typical creator earns; require a disclosed dataset and denominator before repeating “average creator” or top-percentile income claims.
Evidence record: `docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_03_INTIMACY_REPUTATION_PERMANENCE.md`.

### DS-P07 — Adult subscription audiences are strongly male-skewed
Claim class: audience demographics.
Ruling: peer-reviewed samples of OnlyFans sexual-content users have generally contained more men than women, but observed male shares vary and the platform does not publish a representative customer gender census.
Admissible wording: published sexual-use samples lean male; do not quote a platform-wide male percentage as settled fact without a representative sampling method.
Evidence record: `docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_03_INTIMACY_REPUTATION_PERMANENCE.md`.

### DS-P08 — Straight women have an easier path than straight men to monetize explicit content to the other sex
Claim class: sex-specific market asymmetry.
Ruling: the reviewed evidence does not provide the required representative creator-sex × creator-orientation × buyer-sex/orientation × earnings comparison. Pieces of a plausible mechanism do not establish the comparative claim.
Admissible wording: none as fact. May remain an explicitly labeled research hypothesis.
Evidence record: `docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_03_INTIMACY_REPUTATION_PERMANENCE.md`.

### DS-P09 — Sexualized digital content creates future relationship or employment penalties
Claim class: downstream reputational effect.
Ruling: split the claim. Experimental research supports context-dependent professional-selection risk from sexualized social-media imagery, including a disproportionate penalty for female candidates. Canadian sex-work research supports stigma/disclosure stress in some relationships but also documents supportive relationships. Universal career or relationship penalties are not established.
Admissible wording: public sexualized content can create future-audience, professional-selection and relationship-stigma risks; these are probabilistic and context-dependent, not inevitable outcomes.
Evidence record: `docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_03_INTIMACY_REPUTATION_PERMANENCE.md`.

### DS-P10 — Content cannot be scrubbed from the internet
Claim class: permanence / control loss.
Ruling: the absolute claim is false, but the weaker claim is strongly supported. Deleting an original does not guarantee deletion of screenshots, downloads, scraped copies, reposts or archives; removal/delisting can still materially reduce exposure.
Admissible wording: deleting the original does not guarantee every copy is gone; act early to remove/delist where possible, but do not assume one Delete button restores full control.
Evidence record: `docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_03_INTIMACY_REPUTATION_PERMANENCE.md`.

### DS-P11 — Men will withdraw from dating/adult-content markets in response to widespread sexualized content creation
Claim class: forecast / cultural hypothesis.
Ruling: research documents changes in sexual frequency and finds that sexualized self-presentation can reduce long-term relationship interest in some experimental settings, but no reviewed longitudinal evidence establishes that OnlyFans or widespread sexual-content creation causes men as a population to withdraw from dating markets.
Admissible wording: none as fact. May remain a clearly labeled hypothesis about possible incentive/preference changes.
Evidence record: `docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_04_DATING_PREVALENCE.md`.

### DS-P12 — “Most girls are on OnlyFans”
Claim class: prevalence.
Ruling: the 2024 platform filing reports approximately 4.634 million creator accounts globally across all creator demographics. Against global age/sex population denominators, this is incompatible with a general claim that most girls/young women/women are creators. A niche/local-feed claim would need its own defined population and denominator.
Admissible wording: OnlyFans has millions of creator accounts, but “most girls are on OnlyFans” is a denominator-free internet claim, not a population fact.
Evidence record: `docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_04_DATING_PREVALENCE.md`.

---

## RETIRED AS PUBLIC COPY

### DS-R01 — “If you are not paying for the product, you are the product.”
Reason: memorable heuristic but false as a universal rule.
Replacement: identify the actual business model and the value exchanged.

### DS-R02 — “Everything uploaded is permanent forever.”
Reason: overstatement.
Replacement: assume high-consequence content may be copied beyond your control; deletion from one service cannot guarantee deletion of all copies.

### DS-R03 — Degrading labels for creators as an educational device
Reason: moral insult reduces analytical precision and makes the curriculum less useful to people who most need the risk information.
Replacement: discuss sexualized content, sex work, intimate-content monetization, optionality, market incentives, consent, leakage, safety, income distribution, and future preference conflicts directly.

### DS-R04 — “Clean/unharvested digital footprint is the ultimate luxury commodity.”
Reason: rhetorical prediction presented as fact.
Replacement: privacy and reputational optionality can have value; quantify when possible.

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
```

# Part II — Evidence adjudication summaries

### docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_01_ACCESS_PRICING.md

```markdown
# CloveLearn v2 — Digital Stewardship F0.5 Evidence Unit 01

Claims: DS-P01, DS-P02, DS-P03

## Purpose

Test the first three Digital Stewardship claims against current Canadian primary/authoritative evidence before Clove turns them into teaching.

This unit deliberately separates:

1. broad digital dependence from a claim that a smartphone is literally mandatory;
2. personalized offers from personalized base prices;
3. electronic shelf-label capability from algorithmic pricing and identity-linked personalization.

A technically possible mechanism is not evidence that a named retailer uses it.

---

## DS-P01 — Modern participation can create practical smartphone/account dependency

### Evidence

**Statistics Canada — digital government use**

Statistics Canada's 2026 analysis of Canadian digital-government users reports, using the 2022 Canadian Internet Use Survey, that 94.5% of Canadians aged 15+ used the Internet and 76.3% used digital government services. For ages 15–24, the corresponding estimates were 99.2% Internet use and 71.8% digital-government-service use.

Source: Statistics Canada, *Who are the users of digital government services? Exploring the characteristics of Canadian individuals and businesses using digital government services* (2026).  
https://www150.statcan.gc.ca/n1/pub/22-20-0001/222000012026001-eng.htm

**CRTC — connectivity as basic participation infrastructure**

The CRTC's universal-service policy treats reliable Internet and cellphone service as basic telecommunications access. In current Broadband Fund decisions and policy material, the CRTC explicitly ties those services to Canadians' ability to participate in daily life and essential institutions.

Sources:

- CRTC, *Internet — Our Role*.  
  https://crtc.gc.ca/eng/internet/role.htm
- CRTC, *Telecom Decision CRTC 2025-150*.  
  https://crtc.gc.ca/eng/archive/2025/2025-150.htm

**Statistics Canada / CRTC — mobile infrastructure is pervasive, but access is not universal**

Current telecommunications statistics report 37.7 million mobile subscriptions in 2024, 99.5% LTE-network access, and 96.4% household access to an unlimited 50/10 broadband option in 2024. Those are strong infrastructure/adoption signals, but they also demonstrate that access gaps still exist.

Source: Statistics Canada, *Telecommunications Statistics*, drawing on CRTC data.  
https://www.statcan.gc.ca/en/subjects-start/digital_economy_and_society/telecommunications

### Counterevidence / limit

None of these sources establishes that every Canadian must own a smartphone, that every public service is app-only, or that opting out of smartphones is legally equivalent to social exclusion. Digital-government use is widespread, not universal. Alternatives vary by service, jurisdiction, disability/accessibility needs, income, geography and institution.

### Ruling

**`SUPPORTED — NARROWED`**

### Admissible public wording

> Internet access, digital accounts and mobile connectivity are now deeply embedded in Canadian daily life and public-service access. That makes losing access, losing an account, or lacking digital skills practically consequential. But do not assume every service requires a smartphone: check the actual non-digital and accessibility alternatives.

## DS-P02 — Canadian grocers use individualized surveillance pricing

### Evidence supporting adjacent mechanisms

**Competition Bureau — personalized pricing is technically and commercially plausible**

The Competition Bureau's 2025 discussion paper defines algorithmic pricing and distinguishes dynamic pricing based on market conditions from personalized pricing based on consumer data such as demographics, online behaviour and transaction history. The paper says more than 60 companies in Canada offer algorithmic pricing services and explicitly discusses personalized/surveillance pricing as a competition-policy concern.

Source: Competition Bureau Canada, *Algorithmic pricing and competition: Discussion paper* (2025).  
https://competition-bureau.canada.ca/en/how-we-foster-competition/education-and-outreach/publications/algorithmic-pricing-and-competition-discussion-paper

That establishes capability and a market for pricing technology. It does **not** identify a Canadian grocery chain as charging an individual a higher grocery price based on that person's profile.

**Office of the Privacy Commissioner — grocery loyalty data is rich enough for substantial profiling/analytics**

The Privacy Commissioner's 2026 PC Optimum investigation documents retention of loyalty data, browsing behaviour, device information and historical transaction data including product, quantity, amount, store and transaction information. Loblaw stated that retained information was used for analytics, customer trends and development/enhancement of product and service offerings.

Source: Office of the Privacy Commissioner of Canada, PIPEDA Findings #2026-001.  
https://www.priv.gc.ca/en/opc-actions-and-decisions/investigations/investigations-into-businesses/2026/pipeda-2026-001/

This establishes detailed loyalty/transaction data collection and analytics. It does **not** establish personalized higher base prices.

**Loblaw — personalized offers acknowledged; individualized price increases denied**

Loblaw publicly states that PC Optimum customers can receive different offers based on shopping preferences/activity while denying that it uses personal data to increase an individual's shelf or online price.

Source: Loblaw Companies Limited, *Real Talk — Does Loblaw use personal data to raise prices?* (2026).  
https://www.loblaw.ca/en/real-talk-does-loblaw-use-personal-data-to-raise-prices/

This is a company statement, not independent proof of absence. It is nevertheless material counterevidence and cannot be ignored.

### Strongest counterevidence

The current authoritative sources found for this unit show:

- detailed grocery loyalty data collection: yes;
- personalized offers: yes;
- algorithmic/personalized pricing capability in the broader market: yes;
- verified individualized higher grocery shelf/base prices tied to a named Canadian shopper profile: **not established**.

### Ruling

**`UNSUPPORTED AS A GENERAL CURRENT-PRACTICE CLAIM / RETIRE AS FACT`**

This is not a finding that surveillance pricing can never occur. It is a finding that the current evidence packet does not justify telling users that Canadian grocers are doing it.

### Admissible public wording

> Loyalty programs can connect purchase history and other usage data to personalized offers. Separately, pricing algorithms can use consumer data to personalize prices. Do not assume those two systems are connected in a particular retailer unless there is evidence of the actual pricing practice.

## DS-P03 — Electronic shelf labels create a surveillance-pricing threat

### Evidence

**Electronic labels substantially reduce the operational friction of changing displayed prices.**

Walmart describes its U.S. digital shelf-label system as allowing shelf prices to be updated through a centralized digital workflow; a price-change task that could take days can be completed in minutes. Walmart Canada has separately described electronic shelf labels as part of store digitization and automation.

Sources:

- Walmart, *New Tech, Better Outcomes: Digital Shelf Labels Are a Win for Customers and Associates* (2024).  
  https://corporate.walmart.com/news/2024/06/06/new-tech-better-outcomes-digital-shelf-labels-are-a-win-for-customers-and-associates
- Walmart Canada, *Walmart Canada Announces Major $3.5 Billion Investment For Growth And Customer Experience Transformation* (2020).  
  https://www.walmartcanada.ca/news/2020/07/20/walmart-canada-announces-major-3-5-billion-investment-for-growth-and-customer-experience-transformation

**But the label is not the personalization system.**

The Competition Bureau's model of personalized pricing requires a pricing process that uses consumer data to tailor a price. An electronic label can be an output/display mechanism for a price chosen elsewhere, but the label itself is not evidence that identity data participates in price selection.

Source: Competition Bureau Canada, *Algorithmic pricing and competition: Discussion paper*.  
https://competition-bureau.canada.ca/en/how-we-foster-competition/education-and-outreach/publications/algorithmic-pricing-and-competition-discussion-paper

Walmart's current U.S. explanation says its digital shelf labels operate on a closed system, do not collect shopper information, and show the same store price to all customers; price changes remain people-led and are generally pushed outside shopping hours. That statement is company-specific and should not be universalized to every ESL implementation.

Source: Walmart, *How the Shelf Got Smarter and Our Jobs Got Easier* (2026).  
https://corporate.walmart.com/news/2026/03/02/how-the-shelf-got-smarter-and-our-jobs-got-easier

Loblaw similarly states that its electronic shelf labels cannot identify the shopper and are not used to personalize prices, while acknowledging that digital labels make price updates more efficient.

Source: Loblaw Companies Limited, *Real Talk — Does Loblaw use personal data to raise prices?* (2026).  
https://www.loblaw.ca/en/real-talk-does-loblaw-use-personal-data-to-raise-prices/

### Ruling

**`SUPPORTED ONLY AFTER SPLITTING THE CLAIM`**

Supported:

> Electronic shelf labels can make centralized price changes dramatically faster and cheaper to execute than manually replacing paper tags.

Not supported:

> Therefore electronic shelf labels are surveillance-pricing devices.

### Required capability stack for a surveillance-pricing allegation

Clove should teach users to distinguish three layers:

1. **Display layer** — electronic shelf label or online price display.
2. **Price-selection layer** — rule, human decision or pricing algorithm that chooses the price.
3. **Identity/data layer** — consumer-specific data connected to that selection.

Rapid display updates prove Layer 1 capability. Personalized/surveillance pricing requires evidence connecting Layers 2 and 3 to the price actually shown/charged to an individual or group.
```

### docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_02_ATTENTION_FREE_APPS.md

```markdown
# CloveLearn v2 — Digital Stewardship F0.5 Evidence Unit 02

Claims: DS-P04, DS-P05

## Purpose

Test two common Digital Stewardship slogans without importing pop-neuroscience or anti-technology folklore:

- whether attention products are deliberately designed to steer and retain behavior;
- whether a free app necessarily means the user is paying with behavioral data.

---

## DS-P04 — Attention products are designed to exploit psychological vulnerabilities

### What current primary/authoritative sources establish

**Large recommendation systems explicitly learn from behavior and optimize ranking against engagement-related objectives.**

Meta's engineering documentation for Instagram Explore describes models trained on user interaction history and predicts engagement events such as clicks, likes and negative signals. The system combines predicted event probabilities with tunable weights and explicitly discusses trade-offs among online engagement metrics.

Source: Meta Engineering, *Scaling the Instagram Explore recommendations system* (2023).  
https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/

Meta's 2025 engineering description of Instagram says ranked surfaces extend beyond Feed/Stories/Reels into comments and notification importance, and says ranking accuracy is directly related to user engagement.

Source: Meta Engineering, *Journey to 1000 models: Scaling Instagram's recommendation system* (2025).  
https://engineering.fb.com/2025/05/21/production-engineering/journey-to-1000-models-scaling-instagrams-recommendation-system/

Meta's notification engineering also describes notifications as a mechanism for bringing people back to Instagram and reports a framework intended to improve notification engagement while reducing volume.

Source: Meta Engineering, *A New Ranking Framework for Better Notification Quality on Instagram* (2025).  
https://engineering.fb.com/2025/09/02/ml-applications/a-new-ranking-framework-for-better-notification-quality-on-instagram/

TikTok states that its For You recommendations use user interactions including watched content, likes, shares, comments and searches.

Source: TikTok Newsroom, *Learn why a video is recommended For You*.  
https://newsroom.tiktok.com/learn-why-a-video-is-recommended-for-you?lang=en

Google/YouTube research papers describe production recommenders that learn from clicks, dwell/watch time and other logged feedback, and describe recommendation research objectives including engagement and user satisfaction.

Sources:

- Google Research, *Top-K Off-Policy Correction for a REINFORCE Recommender System* (2019).  
  https://research.google/pubs/top-k-off-policy-correction-for-a-reinforce-recommender-system/
- Google Research, *Improving Training Stability for Multitask Ranking Models in Recommender Systems* (2023).  
  https://research.google/pubs/improving-training-stability-for-multitask-ranking-models-in-recommender-systems/

**Canadian regulators independently establish that interface design can steer behavior in ways that harm privacy or competition.**

A 2026 joint Competition Bureau / Office of the Privacy Commissioner article explains that digital structure, information and pressure can steer people's choices. It cites Canadian regulator observations of obstructive design, false hierarchy, forced action and related deceptive patterns.

Source: Competition Bureau Canada and Office of the Privacy Commissioner of Canada, *Digital Design to Support Informed Consumer Choices* (2026).  
https://competition-bureau.canada.ca/en/how-we-foster-competition/collaboration-and-partnerships/digital-design-support-informed-consumer-choices

The OPC's 2024 sweep and regulator resolution likewise document deceptive design patterns in websites/apps and explicitly warn that design can influence users toward less privacy-protective choices or continued use.

Sources:

- Office of the Privacy Commissioner of Canada, *Sweep Report 2024: Deceptive Design Patterns*.  
  https://www.priv.gc.ca/en/about-the-opc/what-we-do/international-collaboration/international-privacy-networks/international-privacy-sweep/2024_sweep/opc-sweep-report-2024/
- Office of the Privacy Commissioner of Canada, *Beware of deceptive design: Tips for individuals*.  
  https://www.priv.gc.ca/en/privacy-topics/technology/online-privacy-tracking-cookies/online-privacy/deceptive-design/gd_dd-ind/

### What the sources do not establish

The reviewed evidence does **not** justify a universal claim that:

- all social apps are engineered by behavioral psychologists;
- every engagement feature is intentionally addictive;
- a single 'dopamine loop' explains social-media use;
- every notification/feed is designed to exploit pathology;
- engagement optimization and user benefit are mutually exclusive.

Platform engineering sources themselves describe multiple objectives, including relevance, negative feedback and satisfaction. Intent must not be inferred beyond the documented objective/design.

### Ruling

**`SUPPORTED MECHANISM / ORIGINAL INTENT LANGUAGE TOO STRONG`**

### Admissible public wording

> Many large digital platforms explicitly learn from your interactions and rank content or notifications using predicted engagement and other behavioral signals. Separately, regulators have documented interface patterns that can steer people toward choices they might not otherwise make. Treat attention as a resource and configure the system rather than assuming its defaults serve your goals.

## DS-P05 — Free apps generally monetize behavioral data

### Evidence for major ad-supported platforms

**Meta**

Meta's 2025 Form 10-K reports $196.175 billion in advertising revenue against $200.966 billion total revenue. Meta states that ad growth is driven by ad impressions, user engagement, targeting and measurement tools. Meta's privacy policy states that activity, device, location and partner information can be used to personalize content and ads.

Sources:

- Meta Platforms, Inc., 2025 Form 10-K, U.S. SEC.  
  https://www.sec.gov/Archives/edgar/data/1326801/000162828026025534/meta-12312025x10kars.htm
- Meta Privacy Policy.  
  https://www.facebook.com/privacy/policy/

For Meta's Family of Apps, it is therefore defensible to say that advertising is the dominant revenue model and that collected information is used in ad personalization/measurement.

**Alphabet / Google**

Alphabet states that Google Services generates revenue primarily from advertising while also generating subscription, platform and device revenue. Google's current ad controls explain that activity, account information and areas where a user has used Google can be used to personalize ads when personalization is enabled.

Sources:

- Alphabet Investor Relations, Financial Statements Glossary / Google Services revenues.  
  https://abc.xyz/investor/faqs-and-general-information/default.aspx
- Google, *Control what data Google uses to show you ads*.  
  https://support.google.com/My-Ad-Center-Help/answer/12156161?hl=en

Google also explicitly defines personalized ads as ads influenced by previously collected/historical data such as search activity, site/app visits, location or demographics.

Source: Google Ads/AdSense Help, *Personalized and non-personalized ads*.  
https://support.google.com/adsense/answer/9007336?hl=en

### Counterevidence to the universal slogan

'Free' does not identify a single business model. A free digital product can be funded by:

- advertising;
- a paid premium tier;
- enterprise customers;
- transaction fees;
- hardware sales;
- donations/grants;
- public funding;
- cross-subsidy from another business;
- an introductory loss-leading strategy;
- a combination of models.

Even Alphabet's own business demonstrates the problem with the slogan: it combines advertising with subscriptions, app/platform revenue, devices, enterprise cloud and other businesses.

The evidence therefore cannot support the universal heuristic:

> If you are not paying for the product, you are the product.

That phrase can point people toward the right question but often supplies the answer before investigating it.

### Ruling

**`SUPPORTED FOR SPECIFIC AD-SUPPORTED SERVICES / RETIRE AS UNIVERSAL RULE`**

### Admissible public wording

> A zero-dollar price does not tell you how a service makes money. Find the actual business model. For major ad-supported platforms such as Meta and parts of Google, advertising is a major or dominant revenue source and user/activity data can be used for ad personalization and measurement. Other free services use very different models.
```

### docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_03_INTIMACY_REPUTATION_PERMANENCE.md

```markdown
# CloveLearn v2 — Digital Stewardship F0.5 Evidence Unit 03

Scope: DS-P06 through DS-P10 only.

Purpose: separate what can actually be taught about subscription adult-content economics, audience sex composition, sex-specific monetization, reputational consequences, and digital persistence from claims that are rhetorically attractive but not adequately evidenced.

## Method rule

Prefer official filings, regulators and peer-reviewed research. Third-party commercial datasets may inform a hypothesis but do not become platform-wide fact without a defensible sampling frame and reproducible method.

---

## DS-P06 — OnlyFans / subscription adult-content income is highly concentrated

### Original claim
OnlyFans / subscription adult-content creator income is highly concentrated.

### What is established

Fenix International Limited, the operator of OnlyFans, filed group accounts for the year ending 30 November 2024 with UK Companies House on 27 August 2025. Public reporting based on those accounts states approximately:

- $7.22 billion gross fan payments;
- $5.8 billion paid to creators;
- 4.634 million creator accounts at year end;
- 377.456 million fan accounts at year end.

Sources:
- UK Companies House filing history: https://find-and-update.company-information.service.gov.uk/company/10354575/filing-history
- Financial Times summary of the filed accounts: https://www.ft.com/content/7d936956-f1b9-4fe4-b3de-feaddac79953
- Euronews summary of the filed accounts: https://www.euronews.com/business/2025/08/25/onlyfans-takes-72bn-from-subscribers-in-2024-as-adult-site-booms

These figures establish platform scale and aggregate creator payout. They **do not establish the median creator income, the share earned by the top 1%, or the platform-wide earnings distribution**. Dividing annual aggregate payouts by year-end account count would also be misleading because account counts include different activity/tenure states and are not a denominator for annual active-creator earnings.

Peer-reviewed and research samples show very wide creator income variation, but they are too small or selected to estimate the whole platform distribution. For example, a qualitative U.S. study of 22 new sexual-content creators reported a very large income range, while a 2024 Irish interview study of seven creators reported a much narrower selected range. Those samples establish heterogeneity, not a population distribution.

Sources:
- Hamilton et al., creator motivations study: https://arxiv.org/abs/2205.10425
- Tynan & Linehan, *OnlyFans: How Models Negotiate Fan Interaction*: https://link.springer.com/article/10.1007/s12119-024-10230-2

A 2026 proprietary OnlyGuider analysis reports severe concentration in a sample associated with 2,982 creator accounts and more than one million subscriber records. It is relevant as hypothesis-supporting evidence, but it is an industry/search business dataset with a non-random commercial data source and is not adequate by itself to establish exact platform-wide percentile shares.

Source:
- https://onlyguider.com/blog/onlyfans-subscriber-spend-study/

### Counterevidence / limitation

The platform does not publicly report a creator-income median or percentile distribution in the reviewed statutory filing. Exact internet claims such as “the top 1% earn X%” frequently recycle opaque or marketing-derived datasets.

### Ruling

**The aggregate scale of creator payouts is established. Very unequal creator outcomes are plausible and supported by selected datasets, but the exact OnlyFans-wide earnings concentration is not established strongly enough for Clove to publish percentile claims as fact.**

### Admissible public wording

> Headline platform payouts do not tell you what a typical creator earns. OnlyFans reports billions in aggregate creator payouts and millions of creator accounts, but its public filings do not give a platform-wide median. Independent samples show very wide outcomes, so treat precise “average creator” and top-percentile claims cautiously unless the dataset and denominator are disclosed.

---

## DS-P07 — Adult subscription audiences are strongly male-skewed

### Evidence

The best peer-reviewed studies located do find more male than female OnlyFans sexual-content users, but the magnitude is inconsistent and the samples are not a platform census.

Litam et al. (2022) surveyed 718 U.S. adults. Within its Mechanical Turk subsample, 344 respondents identified as OnlyFans users: 217 men (63%) and 127 women (37%). The study itself describes users as predominantly male, but the recruitment design makes this unsuitable as a global platform census.

Source:
- https://pmc.ncbi.nlm.nih.gov/articles/PMC9330933/

A separate study of 425 people who had used OnlyFans for sexual purposes in the previous three months reported 53.4% male, 45.6% female, with small nonbinary/transgender proportions.

Source:
- https://pmc.ncbi.nlm.nih.gov/articles/PMC9838472/

Fenix International's public accounts report fan-account totals but not a fan gender census. A 2024 creator-interaction paper explicitly notes that the company does not report the gender distribution required to determine representativeness.

Source:
- https://link.springer.com/article/10.1007/s12119-024-10230-2

### Ruling

**Male over-representation is supported in studied sexual-use samples. “Strongly male-skewed” as a precise platform-wide claim is too strong without a representative platform census.**

### Admissible public wording

> Published studies of people using OnlyFans for sexual content have generally found more men than women, but OnlyFans does not publish a representative customer gender census. Do not quote a single platform-wide male percentage as settled fact unless its sampling method is explicit.

---

## DS-P08 — Straight women have an easier path than straight men to monetize explicit content to the other sex

### Evidence test

The reviewed evidence can establish pieces of a possible mechanism:

- some user samples lean male;
- some creator studies focus heavily on female creators serving male audiences;
- adult-content markets show sex/gender differences in demand and pricing in some settings.

But the required direct evidence is missing: a representative OnlyFans dataset crossing **creator sex × creator sexual orientation × buyer sex/orientation × creator earnings × exposure/marketing effort**.

The platform does not publish that matrix. Creator demographic estimates in the literature are inconsistent, and small qualitative samples cannot establish comparative market opportunity.

Relevant sources:
- OnlyFans user sample: https://pmc.ncbi.nlm.nih.gov/articles/PMC9330933/
- Recent sexual-use sample: https://pmc.ncbi.nlm.nih.gov/articles/PMC9838472/
- Creator-interaction research and explicit warning that company creator gender distribution is not known: https://link.springer.com/article/10.1007/s12119-024-10230-2
- Broader online sexual-services pricing/popularity study, not an OnlyFans earnings comparison: https://arxiv.org/abs/2006.15648

### Ruling

**The directional hypothesis may be plausible, but the requested comparative claim is not established. It must not be taught as fact.**

### Admissible public wording

None as a factual sex-comparison claim. If discussed in research mode:

> Hypothesis: demand may differ substantially by creator and buyer sex/orientation. Clove has not found a representative dataset that can quantify the relative monetization opportunity by sex and orientation on OnlyFans.

---

## DS-P09 — Sexualized digital content creates future relationship or employment penalties

This claim must be split.

### A. Employment / professional selection

A 2023 *Journal of Experimental Social Psychology* paper ran four studies (combined N=813). Evaluators saw either self-sexualized or semi-professional social-media photos of job/scholarship candidates. Self-sexualized photos reduced selection of female candidates, including among participants with hiring experience; the penalty was disproportionately female, demonstrating a sexual double standard in these experimental settings.

Source:
- https://www.sciencedirect.com/science/article/pii/S0022103123000616

A later experimental recruitment study also found that non-professional social-media content can reduce perceived competence/fit and hiring intention, although it is not specific to sexual content.

Source:
- https://pubmed.ncbi.nlm.nih.gov/41229601/

The Office of the Privacy Commissioner of Canada advises people to consider how online posts could affect reputation if seen by a potential employer and notes that online material can be copied, shared and difficult to delete.

Source:
- https://www.priv.gc.ca/en/privacy-topics/technology/online-privacy-tracking-cookies/online-privacy/social-media/02_05_d_74_sn

#### Ruling — employment

**There is credible evidence that sexualized/non-professional public social-media traces can influence professional selection, with experimental evidence of a disproportionate penalty for women. This is a risk, not a universal outcome, and it is not evidence that every employer searches for or penalizes adult-content work.**

### B. Romantic relationships

Canadian research on sex workers shows real stigma and disclosure stress, but also supportive relationships and successful strategies for maintaining intimacy.

A Canadian study of 218 sex workers found many participants who disclosed sex work to partners experienced one or more negative consequences, while some experienced acceptance and support.

Source:
- https://pubmed.ncbi.nlm.nih.gov/35877549/

A 2024 qualitative study of 30 Canadian couples where one or both partners sold sexual services found ongoing negotiation and stigma-related stress, but also documented ways couples maintain intimacy and support.

Source:
- https://pubmed.ncbi.nlm.nih.gov/38270936/

These studies concern sex work broadly and do not justify a universal claim that OnlyFans creation causes future relationship failure or makes someone undateable.

#### Ruling — relationships

**Stigma and disclosure can create relationship costs for some people; inevitable or population-wide dating penalties are not established.**

### Admissible public wording

> Public sexualized content can carry future-audience risk. Experiments show that sexualized social-media images can affect professional selection, with a stronger penalty observed for female candidates. Sex-work disclosure can also create stigma and relationship stress for some people, while other couples remain supportive. Treat this as an optionality tradeoff, not a prophecy about anyone's career or love life.

---

## DS-P10 — Content cannot be scrubbed from the internet

### Original claim
Content cannot be scrubbed from the internet.

### Evidence

The original absolute wording is false because content can sometimes be deleted, delisted or successfully removed from specific services. The weaker claim is strongly supported.

The Office of the Privacy Commissioner of Canada states that online content can be copied, shared and difficult to delete, and separately advises that data posted online can persist in different places such that permanent removal may be difficult or impossible.

Sources:
- https://www.priv.gc.ca/en/privacy-topics/technology/online-privacy-tracking-cookies/online-privacy/social-media/02_05_d_74_sn
- https://www.priv.gc.ca/en/privacy-topics/technology/online-privacy-tracking-cookies/online-privacy/protecting-your-privacy-online/

A 2023 joint privacy-regulator statement on data scraping explains that even when an individual deletes information from a social-media account, scrapers may continue using and sharing copies already collected.

Source:
- https://www.priv.gc.ca/en/opc-news/speeches-and-statements/2023/js-dc_20230824/

The Privacy Commissioner's investigation of Pornhub operator Aylo provides a concrete Canadian case: intimate images were found reposted more than 700 times across about 80 sites, and material continued to resurface after professional takedown work.

Source:
- https://www.priv.gc.ca/en/opc-news/speeches-and-statements/2024/s-d_20240229/

This proves a key distinction: **removing the source copy and recovering control over all downstream copies are different tasks**.

### Counterevidence / limitation

Removal efforts can materially reduce exposure. Platform deletion, search-engine delisting, legal remedies, takedown services and site-level removal are not useless. Clove must not teach fatalism such as “once posted, nothing can ever be done.”

### Ruling

The absolute “cannot be scrubbed” claim is retired. The narrower control-loss claim is strong enough to teach.

### Admissible public wording

> Deleting the original does not guarantee that every copy is gone. Screenshots, downloads, scraping, reposts and archives can outlive the source. Removal and delisting can still reduce exposure, so act early—but do not assume one Delete button restores full control.

---

## Cross-unit curriculum consequence

The Digital Stewardship intimacy module must not be an anti-sex-work lecture. Its defensible function is to teach **future optionality under asymmetric information**:

1. distinguish platform aggregate revenue from typical individual earnings;
2. refuse unsupported sex-comparison statistics;
3. make the future-audience/reputation tradeoff explicit before high-consequence publication;
4. explain that professional and relationship consequences are probabilistic and context-dependent;
5. teach realistic containment/recovery after unwanted copying rather than fatalism or shame.

## Unit verdict

- DS-P06: `SUPPORTED AGGREGATE SCALE / CONCENTRATION PROBABLE / EXACT DISTRIBUTION UNSUPPORTED`
- DS-P07: `SUPPORTED — NARROWED`
- DS-P08: `UNSUPPORTED / RETIRE AS FACT`
- DS-P09: `SUPPORTED AS CONTEXT-DEPENDENT RISK / UNIVERSAL CLAIM RETIRED`
- DS-P10: `SUPPORTED — NARROWED / LOCKED FACT`

No public curriculum integration is authorized by this evidence unit alone.
```

### docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_04_DATING_PREVALENCE.md

```markdown
# CloveLearn v2 — Digital Stewardship F0.5 Evidence Unit 04

Scope: DS-P11 and DS-P12.

---

## DS-P11 — Men will withdraw from dating/adult-content markets in response to widespread sexualized content creation

### Claim class
Forecast / population-level causal hypothesis.

### Evidence reviewed

There is evidence that sexual and relationship behaviour is changing in some populations. For example, research has documented increasing sexual infrequency among some young adults, and current studies examine many possible correlates including relationship formation, partner selectivity, digital life, economic conditions and broader cultural change.

Relevant examples:
- Statistics Canada youth sexual-behaviour analysis: https://www150.statcan.gc.ca/n1/pub/82-003-x/2020009/article/00001-eng.htm
- 2025 study of partner choosiness and sexual frequency among single heterosexual adults: https://link.springer.com/article/10.1007/s10508-025-03160-z

There is also experimental evidence that sexualized dating-profile presentation can reduce perceived long-term partner quality or long-term relationship interest in some contexts.

Source:
- https://cyberpsychology.eu/article/view/40025

OnlyFans-specific user research describes user demographics and sexual attitudes, but does not establish that the growth of OnlyFans or sexual-content creation causes men to leave dating markets.

Source:
- https://pmc.ncbi.nlm.nih.gov/articles/PMC9330933/

### What is missing

The claim requires longitudinal evidence linking exposure to or prevalence of subscription sexual-content creation to subsequent male withdrawal from dating, while separating alternative explanations such as:

- marriage/cohabitation trends;
- economic conditions and housing;
- general pornography use;
- dating-app market structure;
- social isolation;
- mental health;
- changing sexual norms;
- partner preferences;
- delayed family formation;
- voluntary celibacy or reduced interest.

No reviewed source supplies that causal design.

### Ruling

**The claim is an unsupported forecast. Existing evidence about lower sexual frequency or sexualized-profile preferences does not establish an OnlyFans-driven male withdrawal mechanism.**

### Admissible public wording

None as a prediction or fact.

If retained in research/challenger mode only:

> Hypothesis: widespread monetized digital intimacy could change some people's incentives or preferences around dating. Clove has not found longitudinal evidence establishing the direction, size, or sex-specific population effect.

---

## DS-P12 — “Most girls are on OnlyFans”

### Claim class
Prevalence / denominator claim.

### Evidence

Fenix International's statutory 2024 accounts report approximately 4.634 million creator accounts on OnlyFans globally at year end. That number includes creators of all sexes, orientations, ages 18+, activity levels and content categories.

Sources:
- UK Companies House filing history: https://find-and-update.company-information.service.gov.uk/company/10354575/filing-history
- Financial Times report from the filed accounts: https://www.ft.com/content/7d936956-f1b9-4fe4-b3de-feaddac79953

The United Nations World Population Prospects provides global population counts disaggregated by age and sex. The global female population, and even broad adult/young-adult female populations, are orders of magnitude larger than the total number of OnlyFans creator accounts.

Source:
- https://population.un.org/wpp/

Therefore, as a general-population statement, “most girls are on OnlyFans” cannot be reconciled with the available denominator. Even the deliberately impossible upper-bound assumption that every one of the 4.634 million creator accounts belonged to a unique woman would still leave the creator count far below a majority of the global adult-female population.

The phrase can sometimes be used colloquially to mean “many women in my feed/social group seem to promote OnlyFans.” That is a different claim about selection effects and local social exposure, not population prevalence.

### Ruling

**As a general claim about girls/young women/women, it is false. As a claim about a specific social niche, it is undefined until the population and denominator are specified.**

### Admissible public wording

> OnlyFans has millions of creator accounts, but “most girls are on OnlyFans” is a denominator-free internet claim, not a population fact. Ask: most of which population, in what country, at what age, and measured how?

---

## Unit verdict

- DS-P11: `UNSUPPORTED FORECAST / RETIRE AS PUBLIC FACT`
- DS-P12: `RETIRED / GENERAL-POPULATION CLAIM CONTRADICTED BY SCALE`

This completes adjudication of DS-P01 through DS-P12. It does not by itself authorize public curriculum integration; the surviving evidence must now be converted into bounded action drills and then pass an anti-fear / anti-slop / legal-reputational review.
```

# Part III — Implementation contracts

### docs/CLOVE_V2_DS_I0_SPEC.md

```markdown
# CloveLearn v2 — DS-I0 Implementation Contract

Target: **DS-00 — KNOW THE MACHINE**

## Claim under test

Whether Clove can guide one adult through a five-part digital-service map and one safe recovery-path check without collecting sensitive account content, causing lockout, requiring technical jargon, or turning the lesson into passive reading.

## User flow

`ARRIVE → PICK A LOW-STAKES SERVICE PRIVATELY → DEVICE → APP/BROWSER → ACCOUNT → SERVICE/CLOUD → RECOVERY → SAFE CHECK → COMPLETE`

The user does **not** type the service/provider/account name into Clove.

## Interaction model

One card/decision per screen.

### Step 0 — boundary
- adult/general education notice;
- choose a low- or medium-stakes service already used;
- explicit warning not to use banking, government identity, or critical health account for the first run;
- `I HAVE ONE` / `I DON'T KNOW WHAT TO PICK` / `STOP`.

### Step 1 — DEVICE
Question: “What physical thing are you using right now?”
Choices: `PHONE / TABLET / COMPUTER / OTHER / I DON'T KNOW`.
No make/model/device identifier collected.

### Step 2 — APP OR BROWSER
Teach one distinction only:
- app = installed program;
- browser = program used to open websites.
Choices: `APP / BROWSER / BOTH / I DON'T KNOW`.
No browser/app name required.

### Step 3 — ACCOUNT
Question: “Does this service have a sign-in/account?”
Choices: `YES / NO / NOT SURE`.
Never ask for username, email, phone number, password, or account identifier.

### Step 4 — SERVICE / CLOUD
Teach: deleting something from this device is not automatically the same as deleting the account/provider copy.
Question: “If this device disappeared, do you think the service/account would still exist?”
Choices: `YES / NO / NOT SURE`.
Then show: “Do not guess. We will check the service's own account/help controls later.”

### Step 5 — RECOVERY
Question: “Can you identify at least one recovery path without showing it to Clove?”
Choices:
- `YES — RECOVERY EMAIL/PHONE`
- `YES — AUTHENTICATOR/BACKUP METHOD`
- `YES — PROVIDER SUPPORT/RECOVERY PAGE`
- `NO / NOT SURE`.
Never ask for the actual address, number, code, secret, URL token, or backup code.

### Step 6 — SAFE CHECK
If a recovery path is known:
- instruct user to open the service's own settings/help in another tab/window if practical;
- verify only that the recovery method shown is current/recognizable or that an official recovery page exists;
- explicitly: **DO NOT LOG OUT, RESET A PASSWORD, DELETE THE ACCOUNT, REMOVE MFA, OR USE A BACKUP CODE JUST TO TEST THIS DRILL.**

If recovery is unknown:
- completion can be `FOUND THE OFFICIAL RECOVERY/HELP LOCATION` without changing any account setting;
- if still unknown, user can choose `STOP — I NEED HELP` and receive a no-pressure closeout.

### Step 7 — COMPLETE
Show only structured summary labels, never provider/account details:
- DEVICE understood? yes/no
- APP/BROWSER understood? yes/no
- ACCOUNT relationship understood? yes/no
- PROVIDER/CLOUD relationship understood? yes/no
- RECOVERY path located? yes/no

Completion state:
- `MAPPED + RECOVERY VERIFIED`
- `MAPPED + RECOVERY LOCATION FOUND`
- `MAPPED + RECOVERY STILL UNKNOWN`
- `STOPPED SAFELY`

No shame/streak/rank.

## Local state

Store only coarse structured answers required to resume the drill. No free text.

Allowed local fields:
- schemaVersion
- stage
- deviceClass
- accessMode
- hasAccount
- providerPersistenceBelief
- recoveryClass
- recoveryCheckResult
- completedAtDayBucket (optional coarse day, if needed locally)

Forbidden local fields:
- provider/service name
- username/email/phone
- passwords/passphrases
- recovery codes
- identity documents
- exact URLs containing account identifiers or tokens
- free-text notes

## Network/telemetry

DS-I0 v0.1 must function with **zero telemetry**. No `fetch`, `sendBeacon`, analytics event, remote form, third-party script, CDN, or external model is required for the slice.

If telemetry is proposed later, it is a separate gate.

## Accessibility / low-literacy contract

- one primary question per screen;
- max one short explanation paragraph before choices;
- buttons at least 44 CSS px high;
- visible focus state;
- keyboard-only path;
- semantic headings and buttons;
- 390px viewport without horizontal overflow;
- `prefers-reduced-motion` respected;
- no timed decision;
- `I DON'T KNOW` is a valid answer, not an error;
- `STOP` is always available after entry.

## Failure/recovery contract

Test:
- missing local state;
- malformed JSON/state;
- unknown schema version;
- invalid/out-of-order stage;
- unavailable localStorage/IndexedDB if used;
- reload at every stage;
- back/forward navigation;
- same-turn/double activation;
- hidden-stage bypass attempt;
- disabled JavaScript message if practical;
- storage clear between sessions.

Failure must never expose sensitive data or trap the user in an unsavable state.

## Evidence-copy contract

Forbidden factual copy:
- “everything online is permanent”;
- “the cloud never deletes anything”;
- “apps spy on you”;
- “you are the product”;
- claims that the selected provider stores or tracks something unless the user checked the provider's own information;
- claims that one recovery method is universally safest.

Required distinction:
- device vs software vs account vs provider/service vs recovery.
```

### docs/CLOVE_V2_DS_I1_SPEC.md

```markdown
# CloveLearn v2 — DS-I1 Implementation Contract

Target: **DS-01 — SURVIVE THE FORCED GRID**

## Claim under test

Whether Clove can guide one adult to inspect one low-risk digital permission/setting around a real task, classify it as REQUIRED / OPTIONAL / UNCLEAR, reduce at most one clearly optional exposure, verify whether the task still works, and restore the setting if needed—without collecting account/provider details or teaching control evasion.

## First-run boundary

Choose a service genuinely used for a real task, but do **not** use banking, government identity, critical health, emergency/safety, employer-admin, password-manager recovery, or another high-consequence account for the first run.

Sign-in/account-linking changes are **outside DS-I1 v0.1 entirely**. They can affect account access and recovery, so they are deferred to a later evidence/test gate rather than offered as a first-run option.

## User flow

`BOUNDARY → SETTING_CLASS → CLASSIFY → CHANGE_DECISION → TASK_CHECK → RECOVER_IF_NEEDED → COMPLETE`

Safe exits:
- any nonterminal stage → `STOPPED_SAFE`
- REQUIRED → no change → COMPLETE
- UNCLEAR → no change → COMPLETE
- OTHER / NOT SURE → inspection only → COMPLETE

## Allowed setting classes

- `location`
- `contacts`
- `photos_files`
- `ordinary_notifications`
- `marketing_messages`
- `unknown`

No provider/app/account name is entered.

## Stage contract

### BOUNDARY
- pick one genuine low/medium-stakes service privately;
- do not type its name;
- `I HAVE ONE / I DON'T KNOW WHAT TO PICK / STOP`.

### SETTING_CLASS
Question: “Which one setting are you inspecting?”

Choices:
- LOCATION
- CONTACTS
- PHOTOS / FILES
- ORDINARY APP NOTIFICATIONS
- MARKETING EMAIL / SMS
- OTHER / NOT SURE

With STOP this yields a maximum of **7 visible buttons**, matching the low-literacy contract.

### CLASSIFY
Question: “For the real task you want to do, is this setting required?”
Choices:
- `REQUIRED`
- `OPTIONAL`
- `UNCLEAR`

Classification is about this task, not whether the provider is good or bad.

If `settingClass === unknown`, the drill is inspection-only and routes to COMPLETE without a change.

### CHANGE_DECISION
Reached only after OPTIONAL on a change-eligible setting class.

Change-eligible classes:
- location;
- contacts;
- photos/files;
- ordinary app notifications;
- marketing email/SMS.

Instruction: use normal operating-system/service settings to reduce **one** clearly optional permission/setting to the least exposure that still appears compatible with the task.
Choices:
- `I CHANGED ONE OPTIONAL SETTING`
- `I DECIDED NOT TO CHANGE IT`

Never tell the user which provider-specific value to select unless the provider's own documentation is being shown outside Clove. No free text.

### TASK_CHECK
If changed, ask the user to perform the real legitimate task.
Choices:
- `THE TASK STILL WORKS`
- `THE TASK DOES NOT WORK`
- `I'M NOT SURE`

If no change was made, route to COMPLETE.

### RECOVER_IF_NEEDED
Reached only after task failure/uncertainty following a change.
Instruction: restore the setting to its previous state using the same normal settings control.
Choices:
- `RESTORED — TASK WORKS AGAIN`
- `RESTORED — STILL NOT WORKING`
- `I NEED HELP / STOP`

No further configuration advice is given in v0.1.

### COMPLETE
Coarse result only:
- `REQUIRED — NO CHANGE`
- `OPTIONAL — CHANGED / TASK WORKED`
- `OPTIONAL — RESTORED`
- `OPTIONAL — NO CHANGE`
- `UNCLEAR — NO CHANGE`
- `OTHER / NOT SURE — INSPECTED ONLY`
- `STOPPED SAFELY`

No score, streak, shame, or rank.

## Safety exclusions

Never instruct the user to disable or weaken:
- emergency alerts;
- medical/caregiver alerts;
- account/security alerts;
- two-factor or multi-factor authentication;
- fraud/payment verification;
- password-manager/account recovery;
- employer on-call or required operational alerts;
- legal identity, age, safety, employment, financial, or anti-fraud controls.

Never teach:
- fake identity;
- age-gate bypass;
- geolocation spoofing/manipulation;
- fraud-control bypass;
- access-control circumvention;
- unlinking/removing/changing a sign-in identity in this first-run module;
- deleting an account/device as a test;
- spending money to complete the drill.

## Local state allowlist

- schemaVersion
- stage
- settingClass
- classification
- changeDecision
- taskResult
- recoveryResult

No free text.

Forbidden:
- provider/app name;
- username/email/phone;
- account ID;
- exact location;
- contact names;
- filenames/photo metadata;
- password/token/recovery code;
- marketing content;
- URL;
- notes.

## Network contract

DS-I1 v0.1: **zero network/telemetry**.

No fetch, beacon, analytics event, remote form, third-party script/font/model, WebSocket, or EventSource.

## Accessibility / simplicity

- one primary question per screen;
- explanation ≤70 words;
- ≤7 visible buttons including STOP;
- 44 CSS px minimum target;
- keyboard path;
- 390px no overflow;
- reduced-motion respected;
- no timer;
- STOP after entry and at boundary;
- `UNCLEAR` / `I'M NOT SURE` are valid, non-punitive.
```

### docs/CLOVE_V2_DS_I2_SPEC.md

```markdown
# CloveLearn v2 — DS-I2 Implementation Contract

Target: **DS-02 — IDENTITY COMPARTMENTALIZATION**

## Claim under test

Whether Clove can help one adult distinguish CRITICAL vs LOW-STAKES account contexts, inspect whether an existing secondary/alias lane is usable, and adopt a bounded future-use rule without collecting account identifiers, changing critical-account recovery, requiring new account creation, or implying anonymity.

## Governing safety rule

**No critical-account migration in DS-I2 v0.1.**

Do not change the email/phone/recovery method for banking, government, health, password-manager recovery, primary work, or another high-consequence account during this drill.

A second account is not automatically safer. More accounts can add recovery complexity. The goal is to reduce unnecessary linkage between low-stakes and critical contexts when a supported secondary/alias already exists or may be adopted later.

## User flow

`BOUNDARY → CURRENT_PATTERN → EXISTING_LANE → RECEIVE_CHECK? → RECOVERY_AWARENESS? → FUTURE_RULE → COMPLETE`

Safe exits:
- every nonterminal stage → `STOPPED_SAFE`
- no existing lane → `FUTURE_RULE`
- unsure whether lane exists → `FUTURE_RULE`
- receive test declined/failed → `RECOVERY_AWARENESS` or `FUTURE_RULE`, with no migration
- recovery uncertain/outdated → `FUTURE_RULE`, with explicit no-migration warning

## Stage contract

### BOUNDARY
Choose the situation privately. Never type an address, provider name, username, phone number, password, recovery code, or account identifier into Clove.

Choices:
- `I'M READY`
- `I DON'T KNOW WHAT THIS MEANS`
- `STOP`

The helper explains only:
- CRITICAL = banking, government, primary work, health, password-manager/account recovery;
- LOW-STAKES = newsletters, shopping, trials, forums, promotions, non-critical downloads.

### CURRENT_PATTERN
Question: “Right now, how mixed are your critical and low-stakes accounts?”
Choices:
- `MOSTLY THE SAME EMAIL / LANE`
- `ALREADY MOSTLY SEPARATE`
- `I'M NOT SURE`

No address is entered.

### EXISTING_LANE
Question: “Do you already have a secondary email or provider-supported alias you can access?”
Choices:
- `YES — SECONDARY EMAIL`
- `YES — PROVIDER-SUPPORTED ALIAS`
- `NO`
- `I'M NOT SURE`

If NO / NOT SURE, no account creation is requested. Route to FUTURE_RULE.

### RECEIVE_CHECK
Reached only when an existing lane is reported.

Instruction: use the user's own mail app/provider outside Clove to send a harmless test message to the existing secondary/alias. Clove never sees either address or the message.

Use a neutral subject/body such as “test”. Do not include private information.

Choices:
- `TEST MESSAGE RECEIVED`
- `TEST DID NOT ARRIVE`
- `I DON'T WANT TO TEST THIS`

A failed/declined receive check does not trigger account changes.

### RECOVERY_AWARENESS
Reached when an existing lane is reported, regardless of receive result.

Question: “Without logging out or changing anything, can you identify how this secondary/alias would be recovered?”
Choices:
- `YES — RECOVERY LOOKS CURRENT / RECOGNIZABLE`
- `I FOUND RECOVERY, BUT I'M NOT SURE IT IS CURRENT`
- `NO / I DON'T KNOW`

Instruction: inspect only. Do **not** log out, reset a password, change recovery email/phone, remove multi-factor authentication, or consume a backup code as a test.

If recovery is uncertain, the lane is not cleared for critical use by Clove. DS-I2 never migrates critical accounts anyway.

### FUTURE_RULE
Question: “What rule will you use after this drill?”
Choices:
- `LOW-STAKES SIGN-UPS CAN USE A SECONDARY / ALIAS WHEN AVAILABLE`
- `KEEP MY CURRENT SETUP FOR NOW`
- `I NEED MORE HELP BEFORE CHANGING ANYTHING`

This is a future low-stakes rule only. It does not authorize moving existing critical accounts.

### COMPLETE
Structured result only:
- current pattern: mixed / separate / unknown;
- existing lane: secondary / alias / none / unknown;
- receive check: received / failed / declined / not-run;
- recovery awareness: current / uncertain / unknown / not-run;
- future rule: low_stakes_lane / keep_current / need_help.

No score, streak, rank, shame, or claim of anonymity/security guarantee.

## Local state allowlist

- schemaVersion
- stage
- currentPattern
- laneType
- receiveResult
- recoveryAwareness
- futureRule

Forbidden local/user fields:
- email address;
- provider name;
- username;
- phone number;
- account ID;
- password/passphrase;
- authentication token;
- recovery/backup code;
- message subject/body;
- contact name;
- exact URL;
- free text/notes.

## Network contract

DS-I2 v0.1: **zero network/telemetry**.

Clove does not send the test email. The user performs the test in their existing mail service outside Clove.

No fetch, XHR, sendBeacon, WebSocket, EventSource, remote form, third-party script/font/model, or analytics event.

## Safety exclusions

Never instruct the user to:
- create a new account as a requirement;
- migrate a critical account;
- change a critical account's sign-in or recovery route;
- log out to test recovery;
- reset a password merely to test recovery;
- remove/disable multi-factor authentication;
- consume a backup code merely to test it;
- use a fake identity to evade a lawful/legitimate control;
- use a burner/disposable phone as a routine privacy tactic;
- defeat age, fraud, identity, employment, financial, or safety controls;
- assume a secondary email makes them anonymous;
- spend money.

## Accessibility / simplicity

- one primary question per screen;
- explanation ≤70 words;
- ≤6 visible action buttons including STOP;
- minimum target height 44 CSS px;
- keyboard-only path;
- 390px no horizontal overflow;
- reduced-motion respected;
- no timer;
- `I'M NOT SURE`, `I DON'T WANT TO TEST`, `KEEP CURRENT`, and `STOP` are valid non-punitive outcomes.
```

### docs/CLOVE_V2_DS_I3_SPEC.md

```markdown
# CloveLearn v2 — DS-I3 Implementation Contract

Target: **DS-03 — ATTENTION DEFENSE**

## Claim under test

Whether Clove can guide one adult to identify one nonessential notification stream, decide whether it deserves immediate interruption, make at most one reversible change, test it through normal life, and restore it if something important was missed or remains uncertain—without clinical/addiction claims or disabling safety/security/medical/on-call controls.

## First-run eligible interruption classes

- marketing / promotional alerts;
- social activity alerts;
- news / entertainment alerts;
- game / re-engagement alerts;
- nonurgent shopping alerts;
- OTHER / NOT SURE — inspection-only.

## Explicit exclusions

Do not change:
- emergency/public-safety alerts;
- medical/caregiver alerts;
- two-factor authentication, security, fraud or payment-verification alerts;
- employer on-call / required operational alerts;
- a user-created calendar/reminder alert the user considers time-critical.

## User flow

`BOUNDARY → INTERRUPTION_CLASS → INTENT`

Branches:
- `REQUIRED_NOW → COMPLETE / NO CHANGE`
- `UNCLEAR → COMPLETE / NO CHANGE`
- `OTHER / NOT SURE → COMPLETE / INSPECTION ONLY`
- `CAN_WAIT → CHANGE_DECISION`
- `NO_CHANGE → COMPLETE`
- `CHANGED → REAL_LIFE_CHECK`
- `MISSED_NOTHING_IMPORTANT → COMPLETE`
- `MISSED_IMPORTANT / UNSURE → RECOVER`
- `RECOVERED → COMPLETE`
- every nonterminal stage → `STOPPED_SAFE`

## Stage contract

### BOUNDARY
Choose one low-risk notification stream privately. Do not type the app/provider/account name into Clove.

Choices:
- `I HAVE ONE`
- `I DON'T KNOW WHAT TO PICK`
- `STOP`

### INTERRUPTION_CLASS
Question: “Which kind of interruption are you inspecting?”
Choices:
- `MARKETING / PROMOTIONAL`
- `SOCIAL ACTIVITY`
- `NEWS / ENTERTAINMENT`
- `GAME / RE-ENGAGEMENT`
- `NONURGENT SHOPPING`
- `OTHER / NOT SURE`

With STOP this is 7 buttons, so DS-I3 simplicity budget is **≤7 visible buttons including STOP**.

### INTENT
Question: “Does this need to interrupt you when it arrives?”
Choices:
- `YES — I NEED IT NOW`
- `NO — IT CAN WAIT`
- `I'M NOT SURE`

For OTHER / NOT SURE, the module is inspection-only and must not enter the change branch.

### CHANGE_DECISION
Reached only after `CAN_WAIT` on an eligible class.

Before changing anything, remember the previous setting privately. Clove does not record it.

Instruction: use the app/device's normal settings to silence, disable, or schedule only this one nonessential stream. Do not change any excluded critical alert.

Choices:
- `I CHANGED THIS ONE STREAM`
- `I DECIDED NOT TO CHANGE IT`

### REAL_LIFE_CHECK
If changed, use the device normally through one real use period—a few hours or a day is enough. No timer or streak.

Choices:
- `I MISSED NOTHING IMPORTANT`
- `I MISSED SOMETHING IMPORTANT`
- `I'M NOT SURE`

### RECOVER
Reached after `MISSED IMPORTANT` or `UNSURE`.

Instruction: restore the previous setting for this one stream using the same normal settings control. Make no additional changes.

Choices:
- `RESTORED PREVIOUS SETTING`
- `I NEED HELP / STOP`

### COMPLETE
Coarse result only:
- required_now / no change;
- unclear / no change;
- unknown class / inspection only;
- can_wait / no change;
- changed / kept quiet;
- changed / restored.

No score, streak, shame, rank, dopamine claim, addiction label, or mental-health treatment claim.

## Local state allowlist

- schemaVersion
- stage
- interruptionClass
- intent
- changeDecision
- checkResult
- recoveryResult

Forbidden:
- app/provider/account name;
- notification text/content;
- contact/sender name;
- email/phone/account identifier;
- exact schedule/time;
- location;
- password/token/recovery code;
- free text/notes.

## Network contract

DS-I3 v0.1: **zero network/telemetry**.

No fetch, XHR, beacon, WebSocket, EventSource, analytics event, remote form, third-party script/font/model.

## Evidence/copy boundary

Do not teach as fact:
- “notifications hijack dopamine”;
- “social media is literally addictive” as a universal diagnosis;
- “dopamine detox”;
- “your phone is rewiring your brain”;
- “turn off all notifications.”

Allowed framing: recommendation/notification systems can optimize against engagement-related signals; this drill tests whether one interruption deserves immediate access to the user's attention.

## Accessibility / simplicity

- one primary question per screen;
- explanation ≤70 words;
- ≤7 visible buttons including STOP;
- target height ≥44px;
- keyboard-only path;
- 390px no overflow;
- reduced-motion respected;
- no countdown/timer;
- STOP from boundary and every nonterminal stage;
- `I'M NOT SURE` is valid and non-punitive.
```

### docs/CLOVE_V2_DS_I4_SPEC.md

```markdown
# CLOVE v2 — DS-I4 OFFER REALITY CHECK

## Objective
Guide one adult through one ordinary digital offer so the headline and actual commitment are separated before any decision is made.

## Evidence boundary
This drill implements only adjudicated claims:
- personalized offers are not the same as personalized base prices;
- rapid price-update/display capability does not prove person-specific pricing;
- a zero-dollar price does not reveal the business model;
- capability is not evidence of observed use.

It must not accuse a merchant of deception or personalized pricing without direct evidence.

## State machine
`BOUNDARY → OFFER_TYPE → HEADLINE → COMMITMENT_CHECK → DECISION → COMPLETE`

Safe exit from every nonterminal stage: `STOPPED_SAFE`.

## Eligible offer classes
- `free_trial`
- `subscription`
- `intro_discount`
- `bundle_addon`
- `one_time`
- `other_unknown` — inspection-only

## Coarse stored fields only
- `offerType`
- `headlineClear`: `yes | no | unknown`
- `billingPattern`: `one_time | recurring | unclear | not_applicable`
- `renewalShown`: `yes | no | unknown | not_applicable`
- `timingShown`: `yes | no | unknown | not_applicable`
- `conditionShown`: `yes | no | unknown | not_applicable`
- `addonsObserved`: `yes | no | unknown | not_applicable`
- `decision`: `clear_continue_outside | not_clear_wait | no_longer_want | need_help_leave`

No merchant/app name, exact price, currency, account identifier, payment data, receipt text, URL, screenshot, offer copy or free text enters Clove.

## User action
The user inspects the offer outside Clove and answers only coarse questions about what is visibly disclosed. Clove never clicks purchase, cancel, accept, decline, subscribe or contact-merchant controls.

## Decision rule
Clove does not decide whether an offer is legal, deceptive, fair or personalized.

If required commitment details are unclear, the safe outcome is `NOT CLEAR / DO NOT COMMIT YET`.

If the user no longer wants the offer, that is a complete valid outcome.

## Recovery
No account/payment state is changed by Clove. Recovery means leaving the offer uncommitted and returning later if desired.

## Safety locks
- zero network/telemetry for drill answers;
- no financial/legal/consumer-rights advice;
- no purchase/cancellation pressure;
- no retailer-specific allegation;
- no exact-price collection;
- no dark-pattern label as a factual verdict;
- no timers/streaks/scores;
- no public deployment;
- no DS-05/DS-06 scope.

## Simplicity budget
- ≤6 visible action buttons including STOP;
- ≥44px target height;
- ≤70 words in any explanatory block;
- one question at a time;
- plain language; no pricing-jargon requirement.
```

### docs/CLOVE_V2_DS_I5_SPEC.md

```markdown
# CloveLearn v2 — DS-I5 FUTURE-AUDIENCE CHECK

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
```

### docs/CLOVE_V2_DS_I6_SPEC.md

```markdown
# CloveLearn v2 — DS-I6 RECOVERY READINESS

## Objective

Guide one adult to inspect the recovery readiness of one account or service they are authorized to use, without collecting credentials/codes/contact details or making an account change.

## Design boundary

This drill implements the locked stewardship principle that recovery is part of system ownership. It does not certify account security or diagnose compromise.

## Privacy architecture

**Ephemeral by design.**

Answers exist only in JavaScript memory for the current page session. Reload, close or navigation away resets the drill.

Forbidden persistence/transmission:
- localStorage;
- sessionStorage;
- IndexedDB;
- cookies;
- URL/query/hash answer state;
- telemetry/network requests for drill answers.

Clove accepts no free text or uploads and never asks for service/provider/account name, username, email, phone, address, password, passkey, PIN, two-factor code, recovery code, backup code, recovery contact value, security-question answer, device identifier, screenshot, receipt or support transcript.

## First-run safety rule

**Inspect only. Change nothing.**

Do not log out, start a password reset, remove or replace recovery methods, disable two-factor authentication, rotate backup/recovery codes, revoke sessions, delete the account, or start an account-recovery flow for this drill.

If normal access is unavailable, the drill stops the inspection path and points only to the service's official help/recovery route outside Clove. It never supplies bypass instructions.

## State machine

`BOUNDARY → NORMAL_ACCESS → RECOVERY_SETTINGS → RECOGNIZABLE_METHOD → SECOND_ROUTE → DECISION → COMPLETE`

Short conservative branches may enter `DECISION` early when normal access or settings access is unavailable/uncertain.

Safe exit from every nonterminal stage: `STOPPED_SAFE`.

Coarse in-memory values only:
- `normalAccess`: `yes | no | unsure`
- `settingsFound`: `yes | no | unsure`
- `recognizableMethod`: `yes | no | unsure`
- `secondRoute`: `yes | no | unsure`
- `decision`: `ready_enough | update_later | official_help | need_help`

## Questions

1. Can you access this account normally right now?
2. Can you locate its recovery/security settings without changing anything?
3. Does at least one listed recovery method look like something you still control? Do not enter it into Clove.
4. Is a second independent recovery route or backup option visible? Inspection only.

No answer proves that an account is secure or compromised.

## Decision outputs

- READY ENOUGH FOR NOW
- NEEDS A RECOVERY UPDATE LATER
- USE OFFICIAL HELP / RECOVERY OUTSIDE CLOVE
- NEED HELP BEFORE CHANGING ANYTHING

Clove performs no update.

## Simplicity budget

- one question at a time;
- ≤6 visible buttons including STOP;
- ≥44px targets;
- ≤70 words per explanatory block;
- keyboard, 390px and reduced-motion safe.
```

# Part IV — Exact runtime source

The following HTML/JavaScript is serialized verbatim from Candidate A.

### digital-stewardship-00.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#07111f">
<meta name="description" content="CloveLearn Digital Stewardship: map one digital service and verify a safe recovery path without giving Clove your account details.">
<title>Know the Machine — CloveLearn</title>
<style>
:root{--bg:#07111f;--panel:#0c1928;--panel2:#102235;--line:#28425c;--text:#edf5ff;--muted:#9fb2c7;--accent:#5eead4;--accent2:#8fc5ff;--warn:#f4c56a;--max:720px}
*{box-sizing:border-box}
html{background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
body{margin:0;min-height:100dvh;background:radial-gradient(circle at 50% -20%,#16334d 0,var(--bg) 42%)}
button{font:inherit;cursor:pointer}
.shell{width:min(var(--max),calc(100% - 28px));margin:0 auto;padding:24px 0 64px}
.top{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:22px}
.brand{font-size:11px;font-weight:900;letter-spacing:.16em;color:var(--accent)}
.phase{font-size:10px;color:var(--muted);letter-spacing:.08em;text-align:right}
.hero{padding:22px 0 18px}
h1{font-size:clamp(42px,9vw,68px);line-height:.95;letter-spacing:-.045em;margin:0 0 16px}
.lead{font-size:clamp(17px,3vw,21px);color:#cad9e8;margin:0;max-width:620px}
.card{background:rgba(12,25,40,.95);border:1px solid var(--line);border-radius:18px;padding:22px;margin:14px 0;box-shadow:0 16px 45px rgba(0,0,0,.18)}
.step{font-size:10px;font-weight:900;letter-spacing:.14em;color:var(--accent);text-transform:uppercase;margin-bottom:8px}
h2{font-size:26px;line-height:1.15;margin:0 0 10px}
.explain{color:var(--muted);font-size:14px;margin:0 0 18px;max-width:610px}
.choices{display:grid;gap:10px}
.choice,.stop{width:100%;min-height:44px;border:1px solid var(--line);border-radius:12px;background:var(--panel2);color:var(--text);padding:13px 15px;font-weight:850;text-align:left;letter-spacing:.02em}
.choice:hover,.choice:focus-visible,.stop:hover,.stop:focus-visible{border-color:var(--accent2);outline:3px solid rgba(143,197,255,.25);outline-offset:2px}
.choice.primary{border-color:var(--accent);background:#0b2a30;color:#eafffb}
.stop{margin-top:14px;background:transparent;color:var(--muted);text-align:center}
.notice{border-left:4px solid var(--warn);padding:12px 14px;background:#19170f;color:#ead8aa;border-radius:0 10px 10px 0;font-size:12px;margin:14px 0}
.privacy{font-size:11px;color:#89a0b7;margin-top:14px;line-height:1.55}
.status{font-size:12px;color:var(--warn);min-height:20px;margin:10px 0 0}
.summary{display:grid;gap:8px;margin:14px 0}
.row{display:flex;justify-content:space-between;gap:18px;border-bottom:1px solid rgba(40,66,92,.55);padding:9px 0;font-size:13px}
.row b{color:var(--muted);font-size:10px;letter-spacing:.1em;text-transform:uppercase}
.helper{border:1px solid var(--line);background:#081522;border-radius:12px;padding:13px;color:#c7d6e5;font-size:13px;margin:12px 0}
[hidden]{display:none!important}
.footer{margin-top:28px;font-size:10px;color:#71869c;line-height:1.6}
@media(max-width:520px){.shell{width:min(100% - 20px,var(--max));padding-top:16px}.top{align-items:flex-start}.card{padding:17px}.row{display:grid;gap:3px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
</style>
</head>
<body>
<main class="shell">
  <header class="top">
    <div class="brand">CLOVELEARN / DIGITAL STEWARDSHIP</div>
    <div class="phase">DS-I0 BUILD CANDIDATE<br>NOT PUBLIC</div>
  </header>

  <section class="hero">
    <h1>KNOW THE MACHINE.</h1>
    <p class="lead">Map one digital service without giving Clove your account details.</p>
  </section>

  <section class="card" aria-labelledby="question">
    <div id="stepLabel" class="step">Start</div>
    <h2 id="question">Pick one low-stakes service.</h2>
    <p id="explain" class="explain"></p>
    <div id="helper" class="helper" hidden></div>
    <div id="choices" class="choices"></div>
    <button id="stopButton" class="stop" type="button" hidden>STOP</button>
    <p id="storageStatus" class="status" role="status" aria-live="polite"></p>
  </section>

  <p class="privacy"><strong>Private by design:</strong> Never type your password, email, phone number, recovery code, or provider name into Clove. This drill uses only coarse choices stored on this device. It sends no drill answers anywhere.</p>
  <p class="footer">Education only. Do not test this first on banking, government identity, or a critical health account. Do not log out, reset a password, remove multi-factor authentication, use a backup code, wipe a device, or delete an account just to prove recovery works.</p>

  <noscript><section class="card"><h2>JavaScript is off.</h2><p class="explain">This interactive drill cannot run without JavaScript. Nothing has been saved or sent. You can leave safely and return later.</p></section></noscript>
</main>
<script src="digital-stewardship-00.js" defer></script>
</body>
</html>
```

### digital-stewardship-00.js

```javascript
(() => {
'use strict';

const KEY='clove_ds_i0_v1';
const STAGES=['BOUNDARY','DEVICE','ACCESS_MODE','ACCOUNT','SERVICE_CLOUD','RECOVERY','SAFE_CHECK','COMPLETE','STOPPED_SAFE'];
const NEXT={
  BOUNDARY:new Set(['DEVICE','STOPPED_SAFE']),
  DEVICE:new Set(['ACCESS_MODE','STOPPED_SAFE']),
  ACCESS_MODE:new Set(['ACCOUNT','STOPPED_SAFE']),
  ACCOUNT:new Set(['SERVICE_CLOUD','STOPPED_SAFE']),
  SERVICE_CLOUD:new Set(['RECOVERY','STOPPED_SAFE']),
  RECOVERY:new Set(['SAFE_CHECK','STOPPED_SAFE']),
  SAFE_CHECK:new Set(['COMPLETE','STOPPED_SAFE']),
  COMPLETE:new Set(),STOPPED_SAFE:new Set(),
};
const ALLOWED={
  deviceClass:new Set(['phone','tablet','computer','other','unknown',null]),
  accessMode:new Set(['app','browser','both','unknown',null]),
  hasAccount:new Set(['yes','no','unknown',null]),
  providerPersistenceBelief:new Set(['yes','no','unknown',null]),
  recoveryClass:new Set(['contact','auth','support','unknown',null]),
  recoveryCheckResult:new Set(['current','location','unknown',null]),
};
const REQUIRED_BEFORE={
  BOUNDARY:[],DEVICE:[],
  ACCESS_MODE:['deviceClass'],
  ACCOUNT:['deviceClass','accessMode'],
  SERVICE_CLOUD:['deviceClass','accessMode','hasAccount'],
  RECOVERY:['deviceClass','accessMode','hasAccount','providerPersistenceBelief'],
  SAFE_CHECK:['deviceClass','accessMode','hasAccount','providerPersistenceBelief','recoveryClass'],
  COMPLETE:['deviceClass','accessMode','hasAccount','providerPersistenceBelief','recoveryClass','recoveryCheckResult'],
  STOPPED_SAFE:[],
};
const blank=()=>({schemaVersion:1,stage:'BOUNDARY',deviceClass:null,accessMode:null,hasAccount:null,providerPersistenceBelief:null,recoveryClass:null,recoveryCheckResult:null});

const stepLabel=document.querySelector('#stepLabel');
const question=document.querySelector('#question');
const explain=document.querySelector('#explain');
const choices=document.querySelector('#choices');
const stopButton=document.querySelector('#stopButton');
const storageStatus=document.querySelector('#storageStatus');
const helper=document.querySelector('#helper');

let state=blank();
let storageAvailable=true;
let helperOpen=false;
let transitionLock=false;

function validState(candidate){
  if(!candidate || candidate.schemaVersion!==1 || !STAGES.includes(candidate.stage)) return false;
  if(!Object.entries(ALLOWED).every(([field,allowed])=>allowed.has(candidate[field] ?? null))) return false;
  return REQUIRED_BEFORE[candidate.stage].every(field=>candidate[field]!==null && candidate[field]!==undefined);
}

function discardSavedState(){
  try{localStorage.removeItem(KEY);return true;}
  catch{storageAvailable=false;return false;}
}

function load(){
  let raw;
  try{raw=localStorage.getItem(KEY);}
  catch{storageAvailable=false;state=blank();return;}
  if(!raw) return;

  let parsed;
  try{parsed=JSON.parse(raw);}
  catch{state=blank();discardSavedState();return;}

  if(validState(parsed)){state=parsed;return;}
  state=blank();
  discardSavedState();
}

function persist(){
  if(!storageAvailable) return false;
  try{
    localStorage.setItem(KEY,JSON.stringify(state));
    return true;
  }catch{
    storageAvailable=false;
    return false;
  }
}

function storageNote(){
  storageStatus.textContent=storageAvailable ? '' : 'Progress will not be saved on this browser. You can continue in memory, but a reload will reset the drill.';
}

function transition(expectedStage,nextStage,patch={}){
  if(transitionLock || state.stage!==expectedStage || !NEXT[expectedStage]?.has(nextStage)) return false;
  transitionLock=true;
  const candidate={...state,...patch,stage:nextStage};
  if(!validState(candidate)){transitionLock=false;return false;}
  state=candidate;
  persist();
  render();
  transitionLock=false;
  return true;
}

function button(label,onClick,primary=false){
  const b=document.createElement('button');
  b.type='button';
  b.className=`choice${primary?' primary':''}`;
  b.textContent=label;
  b.addEventListener('click',onClick);
  choices.appendChild(b);
}

function clearStage(){
  choices.replaceChildren();
  helper.hidden=true;
  helper.textContent='';
  stopButton.hidden=['COMPLETE','STOPPED_SAFE'].includes(state.stage);
  storageNote();
}

function renderBoundary(){
  stepLabel.textContent='0 / Start';
  question.textContent='Pick one low-stakes service.';
  explain.textContent='Use something you already understand a little. Do not start with banking, government identity, or a critical health account.';
  button('I HAVE ONE',()=>transition('BOUNDARY','DEVICE'),true);
  button("I DON'T KNOW WHAT TO PICK",()=>{
    helperOpen=!helperOpen;
    helper.hidden=!helperOpen;
    helper.textContent='Try a weather app, streaming service, shopping account, game, newsletter, or another service where a mistake would not lock you out of something critical.';
  });
}

function renderDevice(){
  stepLabel.textContent='1 / Device';
  question.textContent='What physical thing are you using right now?';
  explain.textContent='A device is the physical object in your hand or on your desk. We do not need its brand, model, or serial number.';
  for(const [label,value] of [['PHONE','phone'],['TABLET','tablet'],['COMPUTER','computer'],['OTHER','other'],["I DON'T KNOW",'unknown']]) button(label,()=>transition('DEVICE','ACCESS_MODE',{deviceClass:value}),label==='PHONE');
}

function renderAccess(){
  stepLabel.textContent='2 / App or browser';
  question.textContent='Are you using an app or a browser?';
  explain.textContent='An app is an installed program. A browser is the program you use to open websites. Some services use both.';
  for(const [label,value] of [['APP','app'],['BROWSER','browser'],['BOTH','both'],["I DON'T KNOW",'unknown']]) button(label,()=>transition('ACCESS_MODE','ACCOUNT',{accessMode:value}));
}

function renderAccount(){
  stepLabel.textContent='3 / Account';
  question.textContent='Does this service have a sign-in or account?';
  explain.textContent='Do not enter the sign-in here. Just identify whether an account exists.';
  for(const [label,value] of [['YES','yes'],['NO','no'],['NOT SURE','unknown']]) button(label,()=>transition('ACCOUNT','SERVICE_CLOUD',{hasAccount:value}));
}

function renderService(){
  stepLabel.textContent='4 / Service or cloud';
  question.textContent='If this device disappeared, would the service or account still exist?';
  explain.textContent='Deleting something from a device is not automatically the same as deleting an account or a copy held by a service provider. If you are unsure, say so.';
  for(const [label,value] of [['YES — IT WOULD STILL EXIST','yes'],['NO — I THINK IT IS ONLY HERE','no'],['NOT SURE','unknown']]) button(label,()=>transition('SERVICE_CLOUD','RECOVERY',{providerPersistenceBelief:value}));
}

function renderRecovery(){
  stepLabel.textContent='5 / Recovery';
  question.textContent='Can you identify at least one recovery path without showing it to Clove?';
  explain.textContent='You are identifying the kind of recovery path, not the address, number, code, secret, or provider.';
  for(const [label,value] of [
    ['YES — RECOVERY EMAIL / PHONE','contact'],
    ['YES — AUTHENTICATOR / BACKUP METHOD','auth'],
    ['YES — PROVIDER SUPPORT / RECOVERY PAGE','support'],
    ['NO / NOT SURE','unknown'],
  ]) button(label,()=>transition('RECOVERY','SAFE_CHECK',{recoveryClass:value}));
}

function renderSafeCheck(){
  stepLabel.textContent='6 / Safe check';
  if(state.recoveryClass==='unknown'){
    question.textContent='Can you find the official recovery or help location?';
    explain.textContent='Use the service itself or its official help/settings. Do not log out, reset a password, remove multi-factor authentication, or consume a backup code just to test this drill.';
    button('I FOUND THE OFFICIAL RECOVERY LOCATION',()=>transition('SAFE_CHECK','COMPLETE',{recoveryCheckResult:'location'}),true);
    button('I STILL DO NOT KNOW',()=>transition('SAFE_CHECK','COMPLETE',{recoveryCheckResult:'unknown'}));
  }else{
    question.textContent='Safely check the recovery path.';
    explain.textContent='In the service’s own settings or official help, verify only that the recovery method looks current or that an official recovery location exists. Do not log out, reset a password, remove multi-factor authentication, or consume a backup code just to test this drill.';
    button('I CHECKED — IT LOOKS CURRENT',()=>transition('SAFE_CHECK','COMPLETE',{recoveryCheckResult:'current'}),true);
    button('I FOUND THE OFFICIAL RECOVERY LOCATION',()=>transition('SAFE_CHECK','COMPLETE',{recoveryCheckResult:'location'}));
    button('I STILL DO NOT KNOW',()=>transition('SAFE_CHECK','COMPLETE',{recoveryCheckResult:'unknown'}));
  }
}

function understood(value){return value && value!=='unknown' ? 'YES' : 'NOT YET';}
function renderComplete(){
  stepLabel.textContent='7 / Complete';
  question.textContent='MAP COMPLETE';
  const recoveryText=state.recoveryCheckResult==='current'?'Recovery verified':state.recoveryCheckResult==='location'?'Recovery location found':'Recovery still unknown';
  explain.textContent=`${recoveryText}. You now have a five-part map without giving Clove the service name or account details.`;
  const rows=[
    ['DEVICE',understood(state.deviceClass)],
    ['APP / BROWSER',understood(state.accessMode)],
    ['ACCOUNT',understood(state.hasAccount)],
    ['SERVICE / CLOUD',understood(state.providerPersistenceBelief)],
    ['RECOVERY',state.recoveryCheckResult==='current'?'VERIFIED':state.recoveryCheckResult==='location'?'LOCATION FOUND':'UNKNOWN'],
  ];
  const summary=document.createElement('div');summary.className='summary';
  for(const [label,value] of rows){const row=document.createElement('div');row.className='row';const b=document.createElement('b');b.textContent=label;const span=document.createElement('span');span.textContent=value;row.append(b,span);summary.append(row);}
  choices.append(summary);
  button('START OVER SAFELY',()=>{discardSavedState();state=blank();helperOpen=false;render();});
}

function renderStopped(){
  stepLabel.textContent='Stopped';
  question.textContent='STOPPED SAFELY';
  explain.textContent='You can leave here. Nothing is scored, and you do not need to finish this drill today.';
  button('START OVER',()=>{discardSavedState();state=blank();helperOpen=false;render();});
}

function render(){
  clearStage();
  switch(state.stage){
    case 'BOUNDARY':renderBoundary();break;
    case 'DEVICE':renderDevice();break;
    case 'ACCESS_MODE':renderAccess();break;
    case 'ACCOUNT':renderAccount();break;
    case 'SERVICE_CLOUD':renderService();break;
    case 'RECOVERY':renderRecovery();break;
    case 'SAFE_CHECK':renderSafeCheck();break;
    case 'COMPLETE':renderComplete();break;
    case 'STOPPED_SAFE':renderStopped();break;
    default:state=blank();renderBoundary();
  }
  storageNote();
}

stopButton.addEventListener('click',()=>{
  const current=state.stage;
  if(NEXT[current]?.has('STOPPED_SAFE')) transition(current,'STOPPED_SAFE');
});

load();
render();
})();
```

### digital-stewardship-01.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#07111f">
<meta name="description" content="CloveLearn Digital Stewardship: inspect one low-risk digital setting, test the real task, and restore it if needed.">
<title>Survive the Forced Grid — CloveLearn</title>
<style>
:root{--bg:#07111f;--panel:#0c1928;--panel2:#102235;--line:#28425c;--text:#edf5ff;--muted:#9fb2c7;--accent:#5eead4;--accent2:#8fc5ff;--warn:#f4c56a;--max:720px}
*{box-sizing:border-box}html{background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}body{margin:0;min-height:100dvh;background:radial-gradient(circle at 50% -20%,#16334d 0,var(--bg) 42%)}button{font:inherit;cursor:pointer}.shell{width:min(var(--max),calc(100% - 28px));margin:0 auto;padding:24px 0 64px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:22px}.brand{font-size:11px;font-weight:900;letter-spacing:.16em;color:var(--accent)}.phase{font-size:10px;color:var(--muted);letter-spacing:.08em;text-align:right}.hero{padding:22px 0 18px}h1{font-size:clamp(38px,8vw,64px);line-height:.95;letter-spacing:-.045em;margin:0 0 16px}.lead{font-size:clamp(17px,3vw,21px);color:#cad9e8;margin:0;max-width:620px}.card{background:rgba(12,25,40,.95);border:1px solid var(--line);border-radius:18px;padding:22px;margin:14px 0;box-shadow:0 16px 45px rgba(0,0,0,.18)}.step{font-size:10px;font-weight:900;letter-spacing:.14em;color:var(--accent);text-transform:uppercase;margin-bottom:8px}h2{font-size:26px;line-height:1.15;margin:0 0 10px}.explain{color:var(--muted);font-size:14px;margin:0 0 18px;max-width:610px}.choices{display:grid;gap:10px}.choice,.stop{width:100%;min-height:44px;border:1px solid var(--line);border-radius:12px;background:var(--panel2);color:var(--text);padding:13px 15px;font-weight:850;text-align:left;letter-spacing:.02em}.choice:hover,.choice:focus-visible,.stop:hover,.stop:focus-visible{border-color:var(--accent2);outline:3px solid rgba(143,197,255,.25);outline-offset:2px}.choice.primary{border-color:var(--accent);background:#0b2a30;color:#eafffb}.stop{margin-top:14px;background:transparent;color:var(--muted);text-align:center}.helper{border:1px solid var(--line);background:#081522;border-radius:12px;padding:13px;color:#c7d6e5;font-size:13px;margin:12px 0}.status{font-size:12px;color:var(--warn);min-height:20px;margin:10px 0 0}.privacy{font-size:11px;color:#89a0b7;margin-top:14px;line-height:1.55}.safety{border-left:4px solid var(--warn);padding:12px 14px;background:#19170f;color:#ead8aa;border-radius:0 10px 10px 0;font-size:12px;margin:14px 0}.summary{display:grid;gap:8px;margin:14px 0}.row{display:flex;justify-content:space-between;gap:18px;border-bottom:1px solid rgba(40,66,92,.55);padding:9px 0;font-size:13px}.row b{color:var(--muted);font-size:10px;letter-spacing:.1em;text-transform:uppercase}.footer{margin-top:28px;font-size:10px;color:#71869c;line-height:1.6}[hidden]{display:none!important}@media(max-width:520px){.shell{width:min(100% - 20px,var(--max));padding-top:16px}.top{align-items:flex-start}.card{padding:17px}.row{display:grid;gap:3px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
</style>
</head>
<body>
<main class="shell">
<header class="top"><div class="brand">CLOVELEARN / DIGITAL STEWARDSHIP</div><div class="phase">DS-I1 BUILD CANDIDATE<br>NOT PUBLIC</div></header>
<section class="hero"><h1>SURVIVE THE FORCED GRID.</h1><p class="lead">Change one optional setting only if the real task still works without it.</p></section>
<section class="card" aria-labelledby="question">
<div id="stepLabel" class="step">Start</div><h2 id="question">Pick one low-risk service.</h2><p id="explain" class="explain"></p><div id="helper" class="helper" hidden></div><div id="choices" class="choices"></div><button id="stopButton" class="stop" type="button" hidden>STOP</button><p id="storageStatus" class="status" role="status" aria-live="polite"></p>
</section>
<p class="privacy"><strong>Private by design:</strong> Do not type the service name, account name, email, phone number, password, or other account details into Clove. This drill stores only coarse choices on this device and sends no drill answers anywhere.</p>
<div class="safety"><strong>First-run safety:</strong> Do not use banking, government identity, critical health, emergency/safety, employer-admin, or password-manager recovery for this drill. Do not disable emergency, medical, security, two-factor authentication, fraud, payment-verification, recovery, caregiver, or on-call controls. Do not spoof your location, use a false identity, bypass an age gate, or defeat an access or fraud control. Sign-in and account-linking changes are outside this first run.</div>
<p class="footer">The goal is not to prove a company is collecting too much. The goal is to test one clearly optional setting against one legitimate task, then restore the setting if the task stops working.</p>
<noscript><section class="card"><h2>JavaScript is off.</h2><p class="explain">This interactive drill cannot run without JavaScript. Nothing has been saved or sent. You can leave safely and return later.</p></section></noscript>
</main>
<script src="digital-stewardship-01.js" defer></script>
</body>
</html>
```

### digital-stewardship-01.js

```javascript
(() => {
'use strict';

const KEY='clove_ds_i1_v1';
const STAGES=['BOUNDARY','SETTING_CLASS','CLASSIFY','CHANGE_DECISION','TASK_CHECK','RECOVER','COMPLETE','STOPPED_SAFE'];
const ELIGIBLE=new Set(['location','contacts','photos_files','ordinary_notifications','marketing_messages']);
const NEXT={
  BOUNDARY:new Set(['SETTING_CLASS','STOPPED_SAFE']),
  SETTING_CLASS:new Set(['CLASSIFY','STOPPED_SAFE']),
  CLASSIFY:new Set(['CHANGE_DECISION','COMPLETE','STOPPED_SAFE']),
  CHANGE_DECISION:new Set(['TASK_CHECK','COMPLETE','STOPPED_SAFE']),
  TASK_CHECK:new Set(['RECOVER','COMPLETE','STOPPED_SAFE']),
  RECOVER:new Set(['COMPLETE','STOPPED_SAFE']),
  COMPLETE:new Set(),STOPPED_SAFE:new Set(),
};
const ALLOWED={
  settingClass:new Set([...ELIGIBLE,'unknown',null]),
  classification:new Set(['required','optional','unclear',null]),
  changeDecision:new Set(['changed','no_change',null]),
  taskResult:new Set(['works','fails','unsure',null]),
  recoveryResult:new Set(['restored_works','restored_still_broken',null]),
};
const blank=()=>({schemaVersion:1,stage:'BOUNDARY',settingClass:null,classification:null,changeDecision:null,taskResult:null,recoveryResult:null});

const stepLabel=document.querySelector('#stepLabel');
const question=document.querySelector('#question');
const explain=document.querySelector('#explain');
const choices=document.querySelector('#choices');
const stopButton=document.querySelector('#stopButton');
const storageStatus=document.querySelector('#storageStatus');
const helper=document.querySelector('#helper');

let state=blank();
let storageAvailable=true;
let helperOpen=false;
let transitionLock=false;

function validState(s){
  if(!s||s.schemaVersion!==1||!STAGES.includes(s.stage)) return false;
  if(!Object.entries(ALLOWED).every(([field,allowed])=>allowed.has(s[field]??null))) return false;
  if(['BOUNDARY','SETTING_CLASS','STOPPED_SAFE'].includes(s.stage)) return true;
  if(s.settingClass===null) return false;
  if(s.stage==='CLASSIFY') return true;
  if(s.classification===null) return false;
  if(s.stage==='CHANGE_DECISION') return s.classification==='optional'&&ELIGIBLE.has(s.settingClass);
  if(s.stage==='TASK_CHECK') return s.classification==='optional'&&ELIGIBLE.has(s.settingClass)&&s.changeDecision==='changed';
  if(s.stage==='RECOVER') return s.classification==='optional'&&ELIGIBLE.has(s.settingClass)&&s.changeDecision==='changed'&&['fails','unsure'].includes(s.taskResult);
  if(s.stage==='COMPLETE'){
    if(s.settingClass==='unknown') return true;
    if(['required','unclear'].includes(s.classification)) return true;
    if(s.classification==='optional'&&ELIGIBLE.has(s.settingClass)&&s.changeDecision==='no_change') return true;
    if(s.classification==='optional'&&ELIGIBLE.has(s.settingClass)&&s.changeDecision==='changed'&&s.taskResult==='works') return true;
    if(s.classification==='optional'&&ELIGIBLE.has(s.settingClass)&&s.changeDecision==='changed'&&['fails','unsure'].includes(s.taskResult)&&['restored_works','restored_still_broken'].includes(s.recoveryResult)) return true;
  }
  return false;
}

function discard(){try{localStorage.removeItem(KEY);return true;}catch{storageAvailable=false;return false;}}
function load(){
  let raw;try{raw=localStorage.getItem(KEY);}catch{storageAvailable=false;state=blank();return;}
  if(!raw)return;
  let parsed;try{parsed=JSON.parse(raw);}catch{state=blank();discard();return;}
  if(validState(parsed)){state=parsed;return;}
  state=blank();discard();
}
function persist(){
  if(!storageAvailable)return false;
  try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{storageAvailable=false;return false;}
}
function storageNote(){storageStatus.textContent=storageAvailable?'':'Progress will not be saved on this browser. You can continue in memory, but a reload will reset the drill.';}
function transition(expected,next,patch={}){
  if(transitionLock||state.stage!==expected||!NEXT[expected]?.has(next))return false;
  transitionLock=true;
  const candidate={...state,...patch,stage:next};
  if(!validState(candidate)){transitionLock=false;return false;}
  state=candidate;persist();render();transitionLock=false;return true;
}
function button(label,action,primary=false){const b=document.createElement('button');b.type='button';b.className=`choice${primary?' primary':''}`;b.textContent=label;b.addEventListener('click',action);choices.appendChild(b);}
function clearStage(){choices.replaceChildren();helper.hidden=true;helper.textContent='';stopButton.hidden=['COMPLETE','STOPPED_SAFE'].includes(state.stage);storageNote();}

function renderBoundary(){
  stepLabel.textContent='0 / Start';question.textContent='Pick one low-risk service.';
  explain.textContent='Use a service you genuinely use for a real task. Keep the service name private. For the first run, avoid anything where a mistake could affect money, identity, health, safety, work administration, or account recovery.';
  button('I HAVE ONE',()=>transition('BOUNDARY','SETTING_CLASS'),true);
  button("I DON'T KNOW WHAT TO PICK",()=>{helperOpen=!helperOpen;helper.hidden=!helperOpen;helper.textContent='Try a weather app, streaming service, shopping app, game, newsletter, or another low-consequence service you can safely test without spending money.';});
}
function renderSetting(){
  stepLabel.textContent='1 / Setting';question.textContent='Which one setting are you inspecting?';
  explain.textContent='Choose the type only. Do not enter the service name, account, location, contacts, files, or message content. Sign-in and account-linking changes are outside this first run.';
  for(const [label,value] of [['LOCATION','location'],['CONTACTS','contacts'],['PHOTOS / FILES','photos_files'],['ORDINARY APP NOTIFICATIONS','ordinary_notifications'],['MARKETING EMAIL / SMS','marketing_messages'],['OTHER / NOT SURE','unknown']]) button(label,()=>transition('SETTING_CLASS','CLASSIFY',{settingClass:value}));
}
function finishClassification(value){
  if(state.settingClass==='unknown') return transition('CLASSIFY','COMPLETE',{classification:value});
  if(value==='optional') return transition('CLASSIFY','CHANGE_DECISION',{classification:value});
  return transition('CLASSIFY','COMPLETE',{classification:value});
}
function renderClassify(){
  stepLabel.textContent='2 / Classify';question.textContent='For the real task, is this setting required?';
  if(state.settingClass==='unknown') explain.textContent='If you cannot clearly identify the setting type, this first run is inspection only. Classify what you know, but Clove will not ask you to change it.';
  else explain.textContent='Required means the real task depends on it. Optional means you have a clear reason to think the task can work with less access. Unclear is a valid answer.';
  button('REQUIRED',()=>finishClassification('required'));
  button('OPTIONAL',()=>finishClassification('optional'),true);
  button('UNCLEAR',()=>finishClassification('unclear'));
}
function renderChange(){
  stepLabel.textContent='3 / One change';question.textContent='Change only one clearly optional setting.';
  explain.textContent='Use the normal app, service, or device settings. Reduce only the setting you just classified as optional. Do not change security, recovery, identity, payment, emergency, medical, caregiver, or on-call controls.';
  button('I CHANGED ONE OPTIONAL SETTING',()=>transition('CHANGE_DECISION','TASK_CHECK',{changeDecision:'changed'}),true);
  button('I DECIDED NOT TO CHANGE IT',()=>transition('CHANGE_DECISION','COMPLETE',{changeDecision:'no_change'}));
}
function renderTask(){
  stepLabel.textContent='4 / Real task';question.textContent='Now do the legitimate task you came here to do.';
  explain.textContent='Use the service normally. Do not create a fake identity, spoof location, bypass controls, buy something, or deliberately trigger a failure. We are testing whether the ordinary task still works after one optional change.';
  button('THE TASK STILL WORKS',()=>transition('TASK_CHECK','COMPLETE',{taskResult:'works'}),true);
  button('THE TASK DOES NOT WORK',()=>transition('TASK_CHECK','RECOVER',{taskResult:'fails'}));
  button("I'M NOT SURE",()=>transition('TASK_CHECK','RECOVER',{taskResult:'unsure'}));
}
function renderRecover(){
  stepLabel.textContent='5 / Restore';question.textContent='Restore the setting to its previous state.';
  explain.textContent='Use the same normal settings control to put back what you changed. Make no additional changes. If you cannot restore it confidently, stop and use the provider’s official help or a trusted person rather than experimenting further.';
  button('RESTORED — TASK WORKS AGAIN',()=>transition('RECOVER','COMPLETE',{recoveryResult:'restored_works'}),true);
  button('RESTORED — STILL NOT WORKING',()=>transition('RECOVER','COMPLETE',{recoveryResult:'restored_still_broken'}));
  button('I NEED HELP / STOP',()=>transition('RECOVER','STOPPED_SAFE'));
}
function resultText(){
  if(state.settingClass==='unknown') return 'The setting was not clear enough for a safe first-run change, so you left it alone.';
  if(state.classification==='required') return 'You classified the setting as required for this task and made no change.';
  if(state.classification==='unclear') return 'The setting remained unclear, so you made no change.';
  if(state.changeDecision==='no_change') return 'You classified the setting as optional but chose not to change it.';
  if(state.taskResult==='works') return 'You reduced one optional setting and the real task still worked.';
  if(state.recoveryResult==='restored_works') return 'The task stopped working, so you restored the setting and the task worked again.';
  if(state.recoveryResult==='restored_still_broken') return 'You restored the setting but the task still did not work. Stop changing settings and use official help if needed.';
  return 'You completed the check without making another change.';
}
function renderComplete(){
  stepLabel.textContent='Complete';question.textContent='CHECK COMPLETE';explain.textContent=resultText();
  const summary=document.createElement('div');summary.className='summary';
  for(const [label,value] of [['SETTING',state.settingClass==='unknown'?'NOT SURE':state.settingClass.replaceAll('_',' ').toUpperCase()],['CLASSIFICATION',(state.classification||'NONE').toUpperCase()],['CHANGE',state.changeDecision==='changed'?'ONE CHANGE':state.changeDecision==='no_change'?'NO CHANGE':'NONE'],['TASK',state.taskResult?state.taskResult.toUpperCase():'NOT RUN'],['RECOVERY',state.recoveryResult?state.recoveryResult.replaceAll('_',' ').toUpperCase():'NOT NEEDED']]){const row=document.createElement('div');row.className='row';const b=document.createElement('b');b.textContent=label;const span=document.createElement('span');span.textContent=value;row.append(b,span);summary.append(row);}choices.append(summary);
  button('START OVER SAFELY',()=>{discard();state=blank();helperOpen=false;render();});
}
function renderStopped(){stepLabel.textContent='Stopped';question.textContent='STOPPED SAFELY';explain.textContent='You can leave here. Nothing is scored, and Clove will not pressure you to change a setting you are unsure about.';button('START OVER',()=>{discard();state=blank();helperOpen=false;render();});}
function render(){clearStage();switch(state.stage){case'BOUNDARY':renderBoundary();break;case'SETTING_CLASS':renderSetting();break;case'CLASSIFY':renderClassify();break;case'CHANGE_DECISION':renderChange();break;case'TASK_CHECK':renderTask();break;case'RECOVER':renderRecover();break;case'COMPLETE':renderComplete();break;case'STOPPED_SAFE':renderStopped();break;default:state=blank();renderBoundary();}storageNote();}

stopButton.addEventListener('click',()=>{const current=state.stage;if(NEXT[current]?.has('STOPPED_SAFE'))transition(current,'STOPPED_SAFE');});
load();render();
})();
```

### digital-stewardship-02.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#07111f">
<meta name="description" content="CloveLearn Digital Stewardship: map critical and low-stakes account lanes without giving Clove your account details.">
<title>Identity Compartmentalization — CloveLearn</title>
<style>
:root{--bg:#07111f;--panel:#0c1928;--panel2:#102235;--line:#28425c;--text:#edf5ff;--muted:#9fb2c7;--accent:#5eead4;--accent2:#8fc5ff;--warn:#f4c56a;--max:720px}
*{box-sizing:border-box}html{background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}body{margin:0;min-height:100dvh;background:radial-gradient(circle at 50% -20%,#16334d 0,var(--bg) 42%)}button{font:inherit;cursor:pointer}.shell{width:min(var(--max),calc(100% - 28px));margin:0 auto;padding:24px 0 64px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:22px}.brand{font-size:11px;font-weight:900;letter-spacing:.16em;color:var(--accent)}.phase{font-size:10px;color:var(--muted);letter-spacing:.08em;text-align:right}.hero{padding:22px 0 18px}h1{font-size:clamp(36px,7.5vw,60px);line-height:.96;letter-spacing:-.045em;margin:0 0 16px}.lead{font-size:clamp(17px,3vw,21px);color:#cad9e8;margin:0;max-width:620px}.card{background:rgba(12,25,40,.95);border:1px solid var(--line);border-radius:18px;padding:22px;margin:14px 0;box-shadow:0 16px 45px rgba(0,0,0,.18)}.step{font-size:10px;font-weight:900;letter-spacing:.14em;color:var(--accent);text-transform:uppercase;margin-bottom:8px}h2{font-size:26px;line-height:1.15;margin:0 0 10px}.explain{color:var(--muted);font-size:14px;margin:0 0 18px;max-width:610px}.choices{display:grid;gap:10px}.choice,.stop{width:100%;min-height:44px;border:1px solid var(--line);border-radius:12px;background:var(--panel2);color:var(--text);padding:13px 15px;font-weight:850;text-align:left;letter-spacing:.02em}.choice:hover,.choice:focus-visible,.stop:hover,.stop:focus-visible{border-color:var(--accent2);outline:3px solid rgba(143,197,255,.25);outline-offset:2px}.choice.primary{border-color:var(--accent);background:#0b2a30;color:#eafffb}.stop{margin-top:14px;background:transparent;color:var(--muted);text-align:center}.helper{border:1px solid var(--line);background:#081522;border-radius:12px;padding:13px;color:#c7d6e5;font-size:13px;margin:12px 0}.status{font-size:12px;color:var(--warn);min-height:20px;margin:10px 0 0}.privacy{font-size:11px;color:#89a0b7;margin-top:14px;line-height:1.55}.safety{border-left:4px solid var(--warn);padding:12px 14px;background:#19170f;color:#ead8aa;border-radius:0 10px 10px 0;font-size:12px;margin:14px 0}.summary{display:grid;gap:8px;margin:14px 0}.row{display:flex;justify-content:space-between;gap:18px;border-bottom:1px solid rgba(40,66,92,.55);padding:9px 0;font-size:13px}.row b{color:var(--muted);font-size:10px;letter-spacing:.1em;text-transform:uppercase}.footer{margin-top:28px;font-size:10px;color:#71869c;line-height:1.6}[hidden]{display:none!important}@media(max-width:520px){.shell{width:min(100% - 20px,var(--max));padding-top:16px}.top{align-items:flex-start}.card{padding:17px}.row{display:grid;gap:3px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
</style>
</head>
<body>
<main class="shell">
<header class="top"><div class="brand">CLOVELEARN / DIGITAL STEWARDSHIP</div><div class="phase">DS-I2 BUILD CANDIDATE<br>NOT PUBLIC</div></header>
<section class="hero"><h1>SEPARATE WHAT DOESN'T NEED TO MIX.</h1><p class="lead">Map critical and low-stakes account lanes without moving a critical account.</p></section>
<section class="card" aria-labelledby="question">
<div id="stepLabel" class="step">Start</div><h2 id="question">Ready to map your account lanes?</h2><p id="explain" class="explain"></p><div id="helper" class="helper" hidden></div><div id="choices" class="choices"></div><button id="stopButton" class="stop" type="button" hidden>STOP</button><p id="storageStatus" class="status" role="status" aria-live="polite"></p>
</section>
<p class="privacy"><strong>Private by design:</strong> Never type an email address, provider name, username, phone number, password, recovery code, or account identifier into Clove. This drill stores only coarse choices on this device and sends no drill answers anywhere.</p>
<div class="safety"><strong>First-run safety:</strong> Do not move or change the sign-in or recovery route for banking, government, health, password-manager recovery, primary work, or another high-consequence account during this drill. A secondary email or alias does not make you anonymous. Do not log out, reset a password, change recovery email or phone, remove multi-factor authentication, or use a backup code just to test this drill.</div>
<p class="footer">A second account is not automatically safer. More accounts can create more recovery work. This drill only maps what already exists and sets a future low-stakes rule.</p>
<noscript><section class="card"><h2>JavaScript is off.</h2><p class="explain">This interactive drill cannot run without JavaScript. Nothing has been saved or sent. You can leave safely and return later.</p></section></noscript>
</main>
<script src="digital-stewardship-02.js" defer></script>
</body>
</html>
```

### digital-stewardship-02.js

```javascript
(() => {
'use strict';

const KEY='clove_ds_i2_v1';
const STAGES=['BOUNDARY','CURRENT_PATTERN','EXISTING_LANE','RECEIVE_CHECK','RECOVERY_AWARENESS','FUTURE_RULE','COMPLETE','STOPPED_SAFE'];
const NEXT={
  BOUNDARY:new Set(['CURRENT_PATTERN','STOPPED_SAFE']),
  CURRENT_PATTERN:new Set(['EXISTING_LANE','STOPPED_SAFE']),
  EXISTING_LANE:new Set(['RECEIVE_CHECK','FUTURE_RULE','STOPPED_SAFE']),
  RECEIVE_CHECK:new Set(['RECOVERY_AWARENESS','STOPPED_SAFE']),
  RECOVERY_AWARENESS:new Set(['FUTURE_RULE','STOPPED_SAFE']),
  FUTURE_RULE:new Set(['COMPLETE','STOPPED_SAFE']),
  COMPLETE:new Set(),STOPPED_SAFE:new Set(),
};
const ALLOWED={
  currentPattern:new Set(['mixed','separate','unknown',null]),
  laneType:new Set(['secondary','alias','none','unknown',null]),
  receiveResult:new Set(['received','failed','declined','not_run',null]),
  recoveryAwareness:new Set(['current','uncertain','unknown','not_run',null]),
  futureRule:new Set(['low_stakes_lane','keep_current','need_help',null]),
};
const blank=()=>({schemaVersion:1,stage:'BOUNDARY',currentPattern:null,laneType:null,receiveResult:null,recoveryAwareness:null,futureRule:null});

const stepLabel=document.querySelector('#stepLabel');
const question=document.querySelector('#question');
const explain=document.querySelector('#explain');
const choices=document.querySelector('#choices');
const stopButton=document.querySelector('#stopButton');
const storageStatus=document.querySelector('#storageStatus');
const helper=document.querySelector('#helper');

let state=blank();
let storageAvailable=true;
let helperOpen=false;
let transitionLock=false;

function validState(s){
  if(!s||s.schemaVersion!==1||!STAGES.includes(s.stage))return false;
  if(!Object.entries(ALLOWED).every(([field,allowed])=>allowed.has(s[field]??null)))return false;
  if(['BOUNDARY','CURRENT_PATTERN','STOPPED_SAFE'].includes(s.stage))return true;
  if(s.currentPattern===null)return false;
  if(s.stage==='EXISTING_LANE')return true;
  if(s.laneType===null)return false;
  if(s.stage==='RECEIVE_CHECK')return ['secondary','alias'].includes(s.laneType);
  if(s.stage==='RECOVERY_AWARENESS')return ['secondary','alias'].includes(s.laneType)&&['received','failed','declined'].includes(s.receiveResult);
  if(s.stage==='FUTURE_RULE'){
    if(['none','unknown'].includes(s.laneType))return s.receiveResult==='not_run'&&s.recoveryAwareness==='not_run';
    return ['secondary','alias'].includes(s.laneType)&&['received','failed','declined'].includes(s.receiveResult)&&['current','uncertain','unknown'].includes(s.recoveryAwareness);
  }
  if(s.stage==='COMPLETE'){
    if(s.futureRule===null)return false;
    if(['none','unknown'].includes(s.laneType))return s.receiveResult==='not_run'&&s.recoveryAwareness==='not_run';
    return ['secondary','alias'].includes(s.laneType)&&['received','failed','declined'].includes(s.receiveResult)&&['current','uncertain','unknown'].includes(s.recoveryAwareness);
  }
  return false;
}

function discard(){try{localStorage.removeItem(KEY);return true;}catch{storageAvailable=false;return false;}}
function load(){
  let raw;try{raw=localStorage.getItem(KEY);}catch{storageAvailable=false;state=blank();return;}
  if(!raw)return;
  let parsed;try{parsed=JSON.parse(raw);}catch{state=blank();discard();return;}
  if(validState(parsed)){state=parsed;return;}
  state=blank();discard();
}
function persist(){if(!storageAvailable)return false;try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{storageAvailable=false;return false;}}
function storageNote(){storageStatus.textContent=storageAvailable?'':'Progress will not be saved on this browser. You can continue in memory, but a reload will reset the drill.';}
function transition(expected,next,patch={}){
  if(transitionLock||state.stage!==expected||!NEXT[expected]?.has(next))return false;
  transitionLock=true;
  const candidate={...state,...patch,stage:next};
  if(!validState(candidate)){transitionLock=false;return false;}
  state=candidate;persist();render();transitionLock=false;return true;
}
function button(label,action,primary=false){const b=document.createElement('button');b.type='button';b.className=`choice${primary?' primary':''}`;b.textContent=label;b.addEventListener('click',action);choices.appendChild(b);}
function clearStage(){choices.replaceChildren();helper.hidden=true;helper.textContent='';stopButton.hidden=['COMPLETE','STOPPED_SAFE'].includes(state.stage);storageNote();}

function renderBoundary(){
  stepLabel.textContent='0 / Start';question.textContent='Ready to map your account lanes?';
  explain.textContent='Keep every address and provider private. Critical accounts are things like banking, government, primary work, health, or account recovery. Low-stakes accounts are things like newsletters, shopping, trials, forums, promotions, and non-critical downloads.';
  button("I'M READY",()=>transition('BOUNDARY','CURRENT_PATTERN'),true);
  button("I DON'T KNOW WHAT THIS MEANS",()=>{helperOpen=!helperOpen;helper.hidden=!helperOpen;helper.textContent='Think of two buckets: CRITICAL if losing access would seriously disrupt money, identity, health, work, or recovery; LOW-STAKES if losing the account would mostly be an inconvenience.';});
}
function renderPattern(){
  stepLabel.textContent='1 / Current pattern';question.textContent='Right now, how mixed are your critical and low-stakes accounts?';
  explain.textContent='You are only noticing the pattern. Do not move an account, change an address, or expose the address to Clove.';
  button('MOSTLY THE SAME EMAIL / LANE',()=>transition('CURRENT_PATTERN','EXISTING_LANE',{currentPattern:'mixed'}),true);
  button('ALREADY MOSTLY SEPARATE',()=>transition('CURRENT_PATTERN','EXISTING_LANE',{currentPattern:'separate'}));
  button("I'M NOT SURE",()=>transition('CURRENT_PATTERN','EXISTING_LANE',{currentPattern:'unknown'}));
}
function chooseLane(value){
  if(['none','unknown'].includes(value))return transition('EXISTING_LANE','FUTURE_RULE',{laneType:value,receiveResult:'not_run',recoveryAwareness:'not_run'});
  return transition('EXISTING_LANE','RECEIVE_CHECK',{laneType:value});
}
function renderLane(){
  stepLabel.textContent='2 / Existing lane';question.textContent='Do you already have a secondary email or alias you can access?';
  explain.textContent='Use only something that already exists. This drill does not require you to create an account or alias.';
  button('YES — SECONDARY EMAIL',()=>chooseLane('secondary'),true);
  button('YES — PROVIDER-SUPPORTED ALIAS',()=>chooseLane('alias'));
  button('NO',()=>chooseLane('none'));
  button("I'M NOT SURE",()=>chooseLane('unknown'));
}
function renderReceive(){
  stepLabel.textContent='3 / Receive check';question.textContent='Can the existing lane receive a harmless test message?';
  explain.textContent='Use your own mail app outside Clove. Send a simple test message to the existing secondary or alias. Do not include private information. Clove does not send, read, or record either address or the message.';
  button('TEST MESSAGE RECEIVED',()=>transition('RECEIVE_CHECK','RECOVERY_AWARENESS',{receiveResult:'received'}),true);
  button('TEST DID NOT ARRIVE',()=>transition('RECEIVE_CHECK','RECOVERY_AWARENESS',{receiveResult:'failed'}));
  button("I DON'T WANT TO TEST THIS",()=>transition('RECEIVE_CHECK','RECOVERY_AWARENESS',{receiveResult:'declined'}));
}
function renderRecovery(){
  stepLabel.textContent='4 / Recovery awareness';question.textContent='Without changing anything, can you identify how this secondary or alias is recovered?';
  explain.textContent='Inspect only. Do not log out, reset a password, change recovery email or phone, remove multi-factor authentication, or use a backup code just to test this drill.';
  button('YES — RECOVERY LOOKS CURRENT / RECOGNIZABLE',()=>transition('RECOVERY_AWARENESS','FUTURE_RULE',{recoveryAwareness:'current'}),true);
  button("I FOUND RECOVERY, BUT I'M NOT SURE IT IS CURRENT",()=>transition('RECOVERY_AWARENESS','FUTURE_RULE',{recoveryAwareness:'uncertain'}));
  button("NO / I DON'T KNOW",()=>transition('RECOVERY_AWARENESS','FUTURE_RULE',{recoveryAwareness:'unknown'}));
}
function renderRule(){
  stepLabel.textContent='5 / Future rule';question.textContent='What rule will you use after this drill?';
  const noLane=['none','unknown'].includes(state.laneType);
  const recoveryUnclear=['uncertain','unknown'].includes(state.recoveryAwareness);
  if(noLane)explain.textContent='You do not need to create anything now. The useful result is knowing whether your current setup is mixed and deciding what you will do later.';
  else if(recoveryUnclear)explain.textContent='Recovery is not clear enough to treat this lane as dependable. Do not move a critical account. A future low-stakes rule can wait until you understand the lane better.';
  else explain.textContent='Keep the rule narrow: future low-stakes sign-ups can use an existing secondary or alias when that is useful. Do not migrate critical accounts in this drill.';
  button('LOW-STAKES SIGN-UPS CAN USE A SECONDARY / ALIAS WHEN AVAILABLE',()=>transition('FUTURE_RULE','COMPLETE',{futureRule:'low_stakes_lane'}),true);
  button('KEEP MY CURRENT SETUP FOR NOW',()=>transition('FUTURE_RULE','COMPLETE',{futureRule:'keep_current'}));
  button('I NEED MORE HELP BEFORE CHANGING ANYTHING',()=>transition('FUTURE_RULE','COMPLETE',{futureRule:'need_help'}));
}
function resultText(){
  if(['none','unknown'].includes(state.laneType))return 'You mapped the current pattern. No new account was required, and no critical account was moved.';
  if(state.recoveryAwareness!=='current')return 'You inspected an existing lane, but recovery is not fully clear. No migration happened and nothing critical was moved.';
  if(state.receiveResult==='failed')return 'The test message did not arrive. You kept the result bounded and did not move a critical account.';
  if(state.receiveResult==='declined')return 'You chose not to run the receive test. That is a valid stop point; no critical account was moved.';
  return 'You confirmed an existing low-stakes lane can receive mail and found a recognizable recovery path. No critical account was moved.';
}
function renderComplete(){
  stepLabel.textContent='Complete';question.textContent='MAP COMPLETE';explain.textContent=resultText();
  const summary=document.createElement('div');summary.className='summary';
  for(const [label,value] of [['CURRENT PATTERN',(state.currentPattern||'unknown').toUpperCase()],['EXISTING LANE',(state.laneType||'unknown').toUpperCase()],['RECEIVE CHECK',(state.receiveResult||'not_run').replaceAll('_',' ').toUpperCase()],['RECOVERY',(state.recoveryAwareness||'not_run').replaceAll('_',' ').toUpperCase()],['FUTURE RULE',(state.futureRule||'none').replaceAll('_',' ').toUpperCase()]]){const row=document.createElement('div');row.className='row';const b=document.createElement('b');b.textContent=label;const span=document.createElement('span');span.textContent=value;row.append(b,span);summary.append(row);}choices.append(summary);
  button('START OVER SAFELY',()=>{discard();state=blank();helperOpen=false;render();});
}
function renderStopped(){stepLabel.textContent='Stopped';question.textContent='STOPPED SAFELY';explain.textContent='You can leave here. Nothing is scored, no account needs to be created, and no critical account needs to be moved.';button('START OVER',()=>{discard();state=blank();helperOpen=false;render();});}
function render(){clearStage();switch(state.stage){case'BOUNDARY':renderBoundary();break;case'CURRENT_PATTERN':renderPattern();break;case'EXISTING_LANE':renderLane();break;case'RECEIVE_CHECK':renderReceive();break;case'RECOVERY_AWARENESS':renderRecovery();break;case'FUTURE_RULE':renderRule();break;case'COMPLETE':renderComplete();break;case'STOPPED_SAFE':renderStopped();break;default:state=blank();renderBoundary();}storageNote();}

stopButton.addEventListener('click',()=>{const current=state.stage;if(NEXT[current]?.has('STOPPED_SAFE'))transition(current,'STOPPED_SAFE');});
load();render();
})();
```

### digital-stewardship-03.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#07111f">
<meta name="description" content="CloveLearn Digital Stewardship: test whether one nonessential notification deserves immediate access to your attention.">
<title>Attention Defense — CloveLearn</title>
<style>
:root{--bg:#07111f;--panel:#0c1928;--panel2:#102235;--line:#28425c;--text:#edf5ff;--muted:#9fb2c7;--accent:#5eead4;--accent2:#8fc5ff;--warn:#f4c56a;--max:720px}
*{box-sizing:border-box}html{background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}body{margin:0;min-height:100dvh;background:radial-gradient(circle at 50% -20%,#16334d 0,var(--bg) 42%)}button{font:inherit;cursor:pointer}.shell{width:min(var(--max),calc(100% - 28px));margin:0 auto;padding:24px 0 64px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:22px}.brand{font-size:11px;font-weight:900;letter-spacing:.16em;color:var(--accent)}.phase{font-size:10px;color:var(--muted);letter-spacing:.08em;text-align:right}.hero{padding:22px 0 18px}h1{font-size:clamp(42px,9vw,68px);line-height:.95;letter-spacing:-.045em;margin:0 0 16px}.lead{font-size:clamp(17px,3vw,21px);color:#cad9e8;margin:0;max-width:620px}.card{background:rgba(12,25,40,.95);border:1px solid var(--line);border-radius:18px;padding:22px;margin:14px 0;box-shadow:0 16px 45px rgba(0,0,0,.18)}.step{font-size:10px;font-weight:900;letter-spacing:.14em;color:var(--accent);text-transform:uppercase;margin-bottom:8px}h2{font-size:26px;line-height:1.15;margin:0 0 10px}.explain{color:var(--muted);font-size:14px;margin:0 0 18px;max-width:610px}.choices{display:grid;gap:10px}.choice,.stop{width:100%;min-height:44px;border:1px solid var(--line);border-radius:12px;background:var(--panel2);color:var(--text);padding:13px 15px;font-weight:850;text-align:left;letter-spacing:.02em}.choice:hover,.choice:focus-visible,.stop:hover,.stop:focus-visible{border-color:var(--accent2);outline:3px solid rgba(143,197,255,.25);outline-offset:2px}.choice.primary{border-color:var(--accent);background:#0b2a30;color:#eafffb}.stop{margin-top:14px;background:transparent;color:var(--muted);text-align:center}.helper{border:1px solid var(--line);background:#081522;border-radius:12px;padding:13px;color:#c7d6e5;font-size:13px;margin:12px 0}.status{font-size:12px;color:var(--warn);min-height:20px;margin:10px 0 0}.privacy{font-size:11px;color:#89a0b7;margin-top:14px;line-height:1.55}.safety{border-left:4px solid var(--warn);padding:12px 14px;background:#19170f;color:#ead8aa;border-radius:0 10px 10px 0;font-size:12px;margin:14px 0}.summary{display:grid;gap:8px;margin:14px 0}.row{display:flex;justify-content:space-between;gap:18px;border-bottom:1px solid rgba(40,66,92,.55);padding:9px 0;font-size:13px}.row b{color:var(--muted);font-size:10px;letter-spacing:.1em;text-transform:uppercase}.footer{margin-top:28px;font-size:10px;color:#71869c;line-height:1.6}[hidden]{display:none!important}@media(max-width:520px){.shell{width:min(100% - 20px,var(--max));padding-top:16px}.top{align-items:flex-start}.card{padding:17px}.row{display:grid;gap:3px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
</style>
</head>
<body>
<main class="shell">
<header class="top"><div class="brand">CLOVELEARN / DIGITAL STEWARDSHIP</div><div class="phase">DS-I3 BUILD CANDIDATE<br>NOT PUBLIC</div></header>
<section class="hero"><h1>ATTENTION DEFENSE.</h1><p class="lead">Decide whether one nonessential interruption deserves access to you right now.</p></section>
<section class="card" aria-labelledby="question"><div id="stepLabel" class="step">Start</div><h2 id="question">Pick one low-risk notification stream.</h2><p id="explain" class="explain"></p><div id="helper" class="helper" hidden></div><div id="choices" class="choices"></div><button id="stopButton" class="stop" type="button" hidden>STOP</button><p id="storageStatus" class="status" role="status" aria-live="polite"></p></section>
<p class="privacy"><strong>Private by design:</strong> Do not type the app, provider, account, sender, or notification content into Clove. This drill stores only coarse choices on this device and sends no drill answers anywhere.</p>
<div class="safety"><strong>Safety boundary:</strong> Do not change emergency, medical, caregiver, security, two-factor authentication, fraud, payment-verification, or required on-call alerts. This is not a dopamine detox, addiction diagnosis, or treatment. We are testing one interruption, not making a claim about your brain or your character.</div>
<p class="footer">Remember the previous setting privately before changing anything. If the test causes you to miss something important or you become unsure, restore that one setting.</p>
<noscript><section class="card"><h2>JavaScript is off.</h2><p class="explain">This interactive drill cannot run without JavaScript. Nothing has been saved or sent. You can leave safely and return later.</p></section></noscript>
</main>
<script src="digital-stewardship-03.js" defer></script>
</body>
</html>
```

### digital-stewardship-03.js

```javascript
(() => {
'use strict';
const KEY='clove_ds_i3_v1';
const STAGES=['BOUNDARY','INTERRUPTION_CLASS','INTENT','CHANGE_DECISION','REAL_LIFE_CHECK','RECOVER','COMPLETE','STOPPED_SAFE'];
const ELIGIBLE=new Set(['marketing','social','news_entertainment','game','shopping']);
const NEXT={BOUNDARY:new Set(['INTERRUPTION_CLASS','STOPPED_SAFE']),INTERRUPTION_CLASS:new Set(['INTENT','STOPPED_SAFE']),INTENT:new Set(['CHANGE_DECISION','COMPLETE','STOPPED_SAFE']),CHANGE_DECISION:new Set(['REAL_LIFE_CHECK','COMPLETE','STOPPED_SAFE']),REAL_LIFE_CHECK:new Set(['RECOVER','COMPLETE','STOPPED_SAFE']),RECOVER:new Set(['COMPLETE','STOPPED_SAFE']),COMPLETE:new Set(),STOPPED_SAFE:new Set()};
const ALLOWED={interruptionClass:new Set([...ELIGIBLE,'unknown',null]),intent:new Set(['required_now','can_wait','unclear',null]),changeDecision:new Set(['changed','no_change',null]),checkResult:new Set(['nothing_important','missed_important','unsure',null]),recoveryResult:new Set(['restored',null])};
const blank=()=>({schemaVersion:1,stage:'BOUNDARY',interruptionClass:null,intent:null,changeDecision:null,checkResult:null,recoveryResult:null});
const stepLabel=document.querySelector('#stepLabel'),question=document.querySelector('#question'),explain=document.querySelector('#explain'),choices=document.querySelector('#choices'),stopButton=document.querySelector('#stopButton'),storageStatus=document.querySelector('#storageStatus'),helper=document.querySelector('#helper');
let state=blank(),storageAvailable=true,helperOpen=false,transitionLock=false;
function validState(s){if(!s||s.schemaVersion!==1||!STAGES.includes(s.stage))return false;if(!Object.entries(ALLOWED).every(([k,a])=>a.has(s[k]??null)))return false;if(['BOUNDARY','INTERRUPTION_CLASS','STOPPED_SAFE'].includes(s.stage))return true;if(s.interruptionClass===null)return false;if(s.stage==='INTENT')return true;if(s.intent===null)return false;if(s.stage==='CHANGE_DECISION')return s.intent==='can_wait'&&ELIGIBLE.has(s.interruptionClass);if(s.stage==='REAL_LIFE_CHECK')return s.intent==='can_wait'&&ELIGIBLE.has(s.interruptionClass)&&s.changeDecision==='changed';if(s.stage==='RECOVER')return s.intent==='can_wait'&&ELIGIBLE.has(s.interruptionClass)&&s.changeDecision==='changed'&&['missed_important','unsure'].includes(s.checkResult);if(s.stage==='COMPLETE'){if(s.interruptionClass==='unknown')return true;if(['required_now','unclear'].includes(s.intent))return true;if(s.intent==='can_wait'&&ELIGIBLE.has(s.interruptionClass)&&s.changeDecision==='no_change')return true;if(s.intent==='can_wait'&&ELIGIBLE.has(s.interruptionClass)&&s.changeDecision==='changed'&&s.checkResult==='nothing_important')return true;if(s.intent==='can_wait'&&ELIGIBLE.has(s.interruptionClass)&&s.changeDecision==='changed'&&['missed_important','unsure'].includes(s.checkResult)&&s.recoveryResult==='restored')return true;}return false;}
function discard(){try{localStorage.removeItem(KEY);return true}catch{storageAvailable=false;return false}}
function load(){let raw;try{raw=localStorage.getItem(KEY)}catch{storageAvailable=false;state=blank();return}if(!raw)return;let parsed;try{parsed=JSON.parse(raw)}catch{state=blank();discard();return}if(validState(parsed)){state=parsed;return}state=blank();discard()}
function persist(){if(!storageAvailable)return false;try{localStorage.setItem(KEY,JSON.stringify(state));return true}catch{storageAvailable=false;return false}}
function storageNote(){storageStatus.textContent=storageAvailable?'':'Progress will not be saved on this browser. You can continue in memory, but a reload will reset the drill.'}
function transition(expected,next,patch={}){if(transitionLock||state.stage!==expected||!NEXT[expected]?.has(next))return false;transitionLock=true;const candidate={...state,...patch,stage:next};if(!validState(candidate)){transitionLock=false;return false}state=candidate;persist();render();transitionLock=false;return true}
function button(label,action,primary=false){const b=document.createElement('button');b.type='button';b.className=`choice${primary?' primary':''}`;b.textContent=label;b.addEventListener('click',action);choices.appendChild(b)}
function clearStage(){choices.replaceChildren();helper.hidden=true;helper.textContent='';stopButton.hidden=['COMPLETE','STOPPED_SAFE'].includes(state.stage);storageNote()}
function renderBoundary(){stepLabel.textContent='0 / Start';question.textContent='Pick one low-risk notification stream.';explain.textContent='Choose one stream that is not emergency, medical, caregiver, security, fraud, payment-verification, required work/on-call, or another alert you consider time-critical. Keep the app and notification content private.';button('I HAVE ONE',()=>transition('BOUNDARY','INTERRUPTION_CLASS'),true);button("I DON'T KNOW WHAT TO PICK",()=>{helperOpen=!helperOpen;helper.hidden=!helperOpen;helper.textContent='Try a marketing promotion, social activity alert, entertainment/news alert, game re-engagement alert, or nonurgent shopping alert. If you are unsure whether it matters, choose OTHER / NOT SURE and make no change.'})}
function renderClass(){stepLabel.textContent='1 / Interruption';question.textContent='Which kind of interruption are you inspecting?';explain.textContent='Choose only the category. Clove does not need the app, account, sender, or message.';for(const [label,value] of [['MARKETING / PROMOTIONAL','marketing'],['SOCIAL ACTIVITY','social'],['NEWS / ENTERTAINMENT','news_entertainment'],['GAME / RE-ENGAGEMENT','game'],['NONURGENT SHOPPING','shopping'],['OTHER / NOT SURE','unknown']])button(label,()=>transition('INTERRUPTION_CLASS','INTENT',{interruptionClass:value}))}
function chooseIntent(value){if(state.interruptionClass==='unknown')return transition('INTENT','COMPLETE',{intent:value});if(value==='can_wait')return transition('INTENT','CHANGE_DECISION',{intent:value});return transition('INTENT','COMPLETE',{intent:value})}
function renderIntent(){stepLabel.textContent='2 / Intent';question.textContent='Does this need to interrupt you when it arrives?';explain.textContent=state.interruptionClass==='unknown'?'Because the stream is not clearly classified, this first run is inspection only. Choose the closest answer; Clove will not ask you to change it.':'Answer for this one stream. “Can wait” means the information may still matter, but it does not need immediate access to your attention.';button('YES — I NEED IT NOW',()=>chooseIntent('required_now'));button('NO — IT CAN WAIT',()=>chooseIntent('can_wait'),true);button("I'M NOT SURE",()=>chooseIntent('unclear'))}
function renderChange(){stepLabel.textContent='3 / One change';question.textContent='Change only this one stream.';explain.textContent='Remember the previous setting privately. Using normal app/device controls, silence, disable, or schedule only this nonessential stream. Do not alter emergency, medical, caregiver, security, fraud, payment, authentication, or required on-call alerts.';button('I CHANGED THIS ONE STREAM',()=>transition('CHANGE_DECISION','REAL_LIFE_CHECK',{changeDecision:'changed'}),true);button('I DECIDED NOT TO CHANGE IT',()=>transition('CHANGE_DECISION','COMPLETE',{changeDecision:'no_change'}))}
function renderCheck(){stepLabel.textContent='4 / Real-life check';question.textContent='Use your device normally for a real period.';explain.textContent='A few hours or a normal day is enough. There is no timer or streak. Return after ordinary use and judge only whether this one change caused you to miss something important.';button('I MISSED NOTHING IMPORTANT',()=>transition('REAL_LIFE_CHECK','COMPLETE',{checkResult:'nothing_important'}),true);button('I MISSED SOMETHING IMPORTANT',()=>transition('REAL_LIFE_CHECK','RECOVER',{checkResult:'missed_important'}));button("I'M NOT SURE",()=>transition('REAL_LIFE_CHECK','RECOVER',{checkResult:'unsure'}))}
function renderRecover(){stepLabel.textContent='5 / Restore';question.textContent='Restore the previous setting.';explain.textContent='Use the same normal setting control to restore only the stream you changed. Make no additional changes. If you cannot restore it confidently, stop and use official help or a trusted person.';button('RESTORED PREVIOUS SETTING',()=>transition('RECOVER','COMPLETE',{recoveryResult:'restored'}),true);button('I NEED HELP / STOP',()=>transition('RECOVER','STOPPED_SAFE'))}
function resultText(){if(state.interruptionClass==='unknown')return 'The stream was not clear enough for a safe first-run change, so you left it alone.';if(state.intent==='required_now')return 'You decided this stream deserves immediate interruption and made no change.';if(state.intent==='unclear')return 'You were not sure, so you made no change.';if(state.changeDecision==='no_change')return 'You decided the stream could wait but chose not to change it.';if(state.checkResult==='nothing_important')return 'You changed one nonessential stream and did not miss anything important during the test period.';if(state.recoveryResult==='restored')return 'The test raised a concern, so you restored the previous setting.';return 'You finished without making another change.'}
function renderComplete(){stepLabel.textContent='Complete';question.textContent='CHECK COMPLETE';explain.textContent=resultText();const summary=document.createElement('div');summary.className='summary';for(const [label,value] of [['STREAM',(state.interruptionClass||'unknown').replaceAll('_',' ').toUpperCase()],['INTENT',(state.intent||'none').replaceAll('_',' ').toUpperCase()],['CHANGE',(state.changeDecision||'none').replaceAll('_',' ').toUpperCase()],['CHECK',(state.checkResult||'not run').replaceAll('_',' ').toUpperCase()],['RECOVERY',(state.recoveryResult||'not needed').replaceAll('_',' ').toUpperCase()]]){const row=document.createElement('div');row.className='row';const b=document.createElement('b');b.textContent=label;const span=document.createElement('span');span.textContent=value;row.append(b,span);summary.append(row)}choices.append(summary);button('START OVER SAFELY',()=>{discard();state=blank();helperOpen=false;render()})}
function renderStopped(){stepLabel.textContent='Stopped';question.textContent='STOPPED SAFELY';explain.textContent='You can leave here. Nothing is scored, and you do not need to change any notification setting.';button('START OVER',()=>{discard();state=blank();helperOpen=false;render()})}
function render(){clearStage();switch(state.stage){case'BOUNDARY':renderBoundary();break;case'INTERRUPTION_CLASS':renderClass();break;case'INTENT':renderIntent();break;case'CHANGE_DECISION':renderChange();break;case'REAL_LIFE_CHECK':renderCheck();break;case'RECOVER':renderRecover();break;case'COMPLETE':renderComplete();break;case'STOPPED_SAFE':renderStopped();break;default:state=blank();renderBoundary()}storageNote()}
stopButton.addEventListener('click',()=>{const current=state.stage;if(NEXT[current]?.has('STOPPED_SAFE'))transition(current,'STOPPED_SAFE')});
load();render();
})();
```

### digital-stewardship-04.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#07111f">
<meta name="description" content="CloveLearn Digital Stewardship: inspect one digital offer before making a commitment.">
<title>Offer Reality Check — CloveLearn</title>
<style>
:root{--bg:#07111f;--panel:#0c1928;--panel2:#102235;--line:#28425c;--text:#edf5ff;--muted:#9fb2c7;--accent:#5eead4;--accent2:#8fc5ff;--warn:#f4c56a;--max:720px}*{box-sizing:border-box}html{background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}body{margin:0;min-height:100dvh;background:radial-gradient(circle at 50% -20%,#16334d 0,var(--bg) 42%)}button{font:inherit;cursor:pointer}.shell{width:min(var(--max),calc(100% - 28px));margin:0 auto;padding:24px 0 64px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:22px}.brand{font-size:11px;font-weight:900;letter-spacing:.16em;color:var(--accent)}.phase{font-size:10px;color:var(--muted);letter-spacing:.08em;text-align:right}.hero{padding:22px 0 18px}h1{font-size:clamp(40px,9vw,66px);line-height:.95;letter-spacing:-.045em;margin:0 0 16px}.lead{font-size:clamp(17px,3vw,21px);color:#cad9e8;margin:0;max-width:620px}.card{background:rgba(12,25,40,.95);border:1px solid var(--line);border-radius:18px;padding:22px;margin:14px 0;box-shadow:0 16px 45px rgba(0,0,0,.18)}.step{font-size:10px;font-weight:900;letter-spacing:.14em;color:var(--accent);text-transform:uppercase;margin-bottom:8px}h2{font-size:26px;line-height:1.15;margin:0 0 10px}.explain{color:var(--muted);font-size:14px;margin:0 0 18px;max-width:610px}.choices{display:grid;gap:10px}.choice,.stop{width:100%;min-height:44px;border:1px solid var(--line);border-radius:12px;background:var(--panel2);color:var(--text);padding:13px 15px;font-weight:850;text-align:left;letter-spacing:.02em}.choice:hover,.choice:focus-visible,.stop:hover,.stop:focus-visible{border-color:var(--accent2);outline:3px solid rgba(143,197,255,.25);outline-offset:2px}.choice.primary{border-color:var(--accent);background:#0b2a30;color:#eafffb}.stop{margin-top:14px;background:transparent;color:var(--muted);text-align:center}.status{font-size:12px;color:var(--warn);min-height:20px;margin:10px 0 0}.privacy{font-size:11px;color:#89a0b7;margin-top:14px;line-height:1.55}.safety{border-left:4px solid var(--warn);padding:12px 14px;background:#19170f;color:#ead8aa;border-radius:0 10px 10px 0;font-size:12px;margin:14px 0}.footer{margin-top:28px;font-size:10px;color:#71869c;line-height:1.6}[hidden]{display:none!important}@media(max-width:520px){.shell{width:min(100% - 20px,var(--max));padding-top:16px}.top{align-items:flex-start}.card{padding:17px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
</style>
</head>
<body>
<main class="shell">
<header class="top"><div class="brand">CLOVELEARN / DIGITAL STEWARDSHIP</div><div class="phase">DS-I4 BUILD CANDIDATE<br>NOT PUBLIC</div></header>
<section class="hero"><h1>OFFER REALITY CHECK.</h1><p class="lead">Separate the headline from the commitment before you decide.</p></section>
<section class="card" aria-labelledby="question"><div id="stepLabel" class="step">Start</div><h2 id="question">Inspect one ordinary digital offer.</h2><p id="explain" class="explain"></p><div id="choices" class="choices"></div><button id="stopButton" class="stop" type="button">STOP</button><p id="storageStatus" class="status" role="status" aria-live="polite"></p></section>
<p class="privacy"><strong>Private by design:</strong> Do not type the merchant, app, price, payment details, URL, receipt, or offer text into Clove. This drill stores only coarse choices on this device and sends no drill answers anywhere.</p>
<div class="safety"><strong>Evidence boundary:</strong> A personalized offer is not proof of a personalized base price. Clove does not decide whether an offer is legal, deceptive, fair, or personalized. No purchase or cancellation happens inside Clove.</div>
<p class="footer">Use the seller's own offer screen or terms to inspect what is actually shown. If the commitment is unclear, leaving it uncommitted is a complete valid outcome.</p>
<noscript><section class="card"><h2>JavaScript is off.</h2><p class="explain">This interactive drill cannot run without JavaScript. Nothing has been saved or sent. You can leave safely and return later.</p></section></noscript>
</main>
<script src="digital-stewardship-04.js" defer></script>
</body>
</html>
```

### digital-stewardship-04.js

```javascript
(() => {
'use strict';
const KEY='clove_ds_i4_v1';
const STAGES=['BOUNDARY','OFFER_TYPE','HEADLINE','COMMITMENT_CHECK','DECISION','COMPLETE','STOPPED_SAFE'];
const TYPES=new Set(['free_trial','subscription','intro_discount','bundle_addon','one_time','other_unknown']);
const NEXT={BOUNDARY:new Set(['OFFER_TYPE','STOPPED_SAFE']),OFFER_TYPE:new Set(['HEADLINE','STOPPED_SAFE']),HEADLINE:new Set(['COMMITMENT_CHECK','STOPPED_SAFE']),COMMITMENT_CHECK:new Set(['DECISION','STOPPED_SAFE']),DECISION:new Set(['COMPLETE','STOPPED_SAFE']),COMPLETE:new Set(),STOPPED_SAFE:new Set()};
const ALLOWED={offerType:new Set([...TYPES,null]),headlineClear:new Set(['yes','no','unknown',null]),billingPattern:new Set(['one_time','recurring','unclear','not_applicable',null]),renewalShown:new Set(['yes','no','unknown','not_applicable',null]),timingShown:new Set(['yes','no','unknown','not_applicable',null]),conditionShown:new Set(['yes','no','unknown','not_applicable',null]),addonsObserved:new Set(['yes','no','unknown','not_applicable',null]),decision:new Set(['clear_continue_outside','not_clear_wait','no_longer_want','need_help_leave',null])};
const blank=()=>({schemaVersion:1,stage:'BOUNDARY',offerType:null,headlineClear:null,billingPattern:null,renewalShown:null,timingShown:null,conditionShown:null,addonsObserved:null,decision:null});
const stepLabel=document.querySelector('#stepLabel'),question=document.querySelector('#question'),explain=document.querySelector('#explain'),choices=document.querySelector('#choices'),stopButton=document.querySelector('#stopButton'),storageStatus=document.querySelector('#storageStatus');
let state=blank(),storageAvailable=true,transitionLock=false;
function checksOrdered(s){const a=[s.billingPattern,s.renewalShown,s.timingShown,s.conditionShown,s.addonsObserved];let gap=false;for(const v of a){if(v===null)gap=true;else if(gap)return false}return true}
function checked(s){return [s.billingPattern,s.renewalShown,s.timingShown,s.conditionShown,s.addonsObserved].every(v=>v!==null)}
function clearEnough(s){if(s.headlineClear!=='yes')return false;if(s.billingPattern==='one_time')return s.renewalShown==='not_applicable'&&s.timingShown==='not_applicable'&&['yes','not_applicable'].includes(s.conditionShown)&&['yes','no','not_applicable'].includes(s.addonsObserved);if(s.billingPattern==='recurring')return s.renewalShown==='yes'&&s.timingShown==='yes'&&s.conditionShown==='yes'&&['yes','no','not_applicable'].includes(s.addonsObserved);return false}
function validState(s){if(!s||s.schemaVersion!==1||!STAGES.includes(s.stage))return false;if(!Object.entries(ALLOWED).every(([k,a])=>a.has(s[k]??null)))return false;if(!checksOrdered(s))return false;if(['BOUNDARY','OFFER_TYPE','STOPPED_SAFE'].includes(s.stage))return true;if(!TYPES.has(s.offerType))return false;if(s.stage==='HEADLINE')return true;if(s.headlineClear===null)return false;if(s.stage==='COMMITMENT_CHECK')return true;if(!checked(s))return false;if(s.stage==='DECISION')return true;if(s.stage==='COMPLETE'){if(s.decision===null)return false;if(s.decision==='clear_continue_outside'&&!clearEnough(s))return false;return true}return false}
function discard(){try{localStorage.removeItem(KEY);return true}catch{storageAvailable=false;return false}}
function load(){let raw;try{raw=localStorage.getItem(KEY)}catch{storageAvailable=false;state=blank();return}if(!raw)return;let parsed;try{parsed=JSON.parse(raw)}catch{state=blank();discard();return}if(validState(parsed)){state=parsed;return}state=blank();discard()}
function persist(){if(!storageAvailable)return false;try{localStorage.setItem(KEY,JSON.stringify(state));return true}catch{storageAvailable=false;return false}}
function storageNote(){storageStatus.textContent=storageAvailable?'':'Progress will not be saved on this browser. You can continue in memory, but a reload will reset the drill.'}
function commitCandidate(candidate){if(!validState(candidate))return false;state=candidate;persist();return true}
function transition(expected,next,patch={}){if(transitionLock||state.stage!==expected||!NEXT[expected]?.has(next))return false;transitionLock=true;const ok=commitCandidate({...state,...patch,stage:next});transitionLock=false;if(ok)render();return ok}
function patch(expected,values){if(transitionLock||state.stage!==expected)return false;transitionLock=true;const ok=commitCandidate({...state,...values});transitionLock=false;if(ok)render();return ok}
function button(label,action,primary=false){const b=document.createElement('button');b.type='button';b.className=`choice${primary?' primary':''}`;b.textContent=label;b.addEventListener('click',action);choices.appendChild(b)}
function clearStage(){choices.replaceChildren();stopButton.hidden=['COMPLETE','STOPPED_SAFE'].includes(state.stage);storageNote()}
function renderBoundary(){stepLabel.textContent='0 / Start';question.textContent='Inspect one ordinary digital offer.';explain.textContent='Use one offer you can already see. Do not buy, cancel, sign up, or enter payment details for this drill. You are only checking what commitment the offer actually shows.';button('START CHECK',()=>transition('BOUNDARY','OFFER_TYPE'),true)}
function renderType(){stepLabel.textContent='1 / Offer type';question.textContent='What kind of offer is this?';explain.textContent='Choose only the category. Keep the merchant, app, exact price, and offer text outside Clove.';for(const [label,value] of [['FREE TRIAL','free_trial'],['SUBSCRIPTION / MEMBERSHIP','subscription'],['INTRODUCTORY DISCOUNT','intro_discount'],['ONE-TIME DIGITAL PURCHASE','one_time'],['OTHER / NOT SURE','other_unknown']])button(label,()=>transition('OFFER_TYPE','HEADLINE',{offerType:value}))}
function renderHeadline(){stepLabel.textContent='2 / Headline';question.textContent='Is the headline clear about what you get right now?';explain.textContent='Answer only whether the headline itself is understandable. This does not decide whether the full commitment is clear.';button('YES — CLEAR',()=>transition('HEADLINE','COMMITMENT_CHECK',{headlineClear:'yes'}),true);button('NO — NOT CLEAR',()=>transition('HEADLINE','COMMITMENT_CHECK',{headlineClear:'no'}));button("I'M NOT SURE",()=>transition('HEADLINE','COMMITMENT_CHECK',{headlineClear:'unknown'}))}
function renderCommitment(){stepLabel.textContent='3 / Commitment';const s=state;
  if(s.billingPattern===null){question.textContent='Is the commitment one-time or recurring?';explain.textContent='Check the offer or terms outside Clove. Do not enter the amount here.';button('ONE-TIME',()=>patch('COMMITMENT_CHECK',{billingPattern:'one_time'}),true);button('RECURRING',()=>patch('COMMITMENT_CHECK',{billingPattern:'recurring'}));button('UNCLEAR',()=>patch('COMMITMENT_CHECK',{billingPattern:'unclear'}));button('NOT APPLICABLE',()=>patch('COMMITMENT_CHECK',{billingPattern:'not_applicable'}));return}
  if(s.renewalShown===null){question.textContent='If it renews, is the renewal clearly shown?';explain.textContent='For a truly one-time offer, choose NOT APPLICABLE. Otherwise answer only what is visibly disclosed.';button('YES — RENEWAL SHOWN',()=>patch('COMMITMENT_CHECK',{renewalShown:'yes'}),true);button('NO — NOT SHOWN',()=>patch('COMMITMENT_CHECK',{renewalShown:'no'}));button("I'M NOT SURE",()=>patch('COMMITMENT_CHECK',{renewalShown:'unknown'}));button('NOT APPLICABLE',()=>patch('COMMITMENT_CHECK',{renewalShown:'not_applicable'}));return}
  if(s.timingShown===null){question.textContent='Is the renewal or trial-end timing clearly shown?';explain.textContent='For a truly one-time offer, choose NOT APPLICABLE.';button('YES — TIMING SHOWN',()=>patch('COMMITMENT_CHECK',{timingShown:'yes'}),true);button('NO — NOT SHOWN',()=>patch('COMMITMENT_CHECK',{timingShown:'no'}));button("I'M NOT SURE",()=>patch('COMMITMENT_CHECK',{timingShown:'unknown'}));button('NOT APPLICABLE',()=>patch('COMMITMENT_CHECK',{timingShown:'not_applicable'}));return}
  if(s.conditionShown===null){question.textContent='Are cancellation or minimum-term conditions shown?';explain.textContent='Do not interpret the law or fairness. Check only whether relevant conditions are visible enough for you to understand the commitment.';button('YES — CONDITIONS SHOWN',()=>patch('COMMITMENT_CHECK',{conditionShown:'yes'}),true);button('NO — NOT SHOWN',()=>patch('COMMITMENT_CHECK',{conditionShown:'no'}));button("I'M NOT SURE",()=>patch('COMMITMENT_CHECK',{conditionShown:'unknown'}));button('NOT APPLICABLE',()=>patch('COMMITMENT_CHECK',{conditionShown:'not_applicable'}));return}
  if(s.addonsObserved===null){question.textContent='Did you see optional add-ons or extras?';explain.textContent='You are checking whether extra items are visibly separate from the main commitment, not judging the seller.';button('YES — OPTIONAL ADD-ONS SEEN',()=>patch('COMMITMENT_CHECK',{addonsObserved:'yes'}));button('NO — NO OPTIONAL ADD-ONS SEEN',()=>patch('COMMITMENT_CHECK',{addonsObserved:'no'}),true);button("I'M NOT SURE",()=>patch('COMMITMENT_CHECK',{addonsObserved:'unknown'}));button('NOT APPLICABLE',()=>patch('COMMITMENT_CHECK',{addonsObserved:'not_applicable'}));return}
  transition('COMMITMENT_CHECK','DECISION')}
function finish(decision){return transition('DECISION','COMPLETE',{decision})}
function renderDecision(){stepLabel.textContent='4 / Decision';question.textContent='What do you do with the offer?';const clear=clearEnough(state);explain.textContent=clear?'The commitment you checked is clear enough for you to make your own decision outside Clove. Clove is not recommending the purchase.':'At least one part of the commitment is unclear. Leaving it uncommitted is a complete result.';if(clear)button('CLEAR ENOUGH — CONTINUE OUTSIDE CLOVE',()=>finish('clear_continue_outside'),true);else button('NOT CLEAR — DO NOT COMMIT YET',()=>finish('not_clear_wait'),true);button('NO LONGER WANT IT',()=>finish('no_longer_want'));button('NEED HELP — LEAVE SAFELY',()=>finish('need_help_leave'))}
function renderComplete(){stepLabel.textContent='Complete';question.textContent='CHECK COMPLETE';if(state.decision==='clear_continue_outside')explain.textContent='You separated the headline from the commitment. If you continue, do it outside Clove and use your own judgment. No purchase was made here.';else if(state.decision==='not_clear_wait')explain.textContent='The commitment was not clear enough. Leaving it uncommitted is the result; you can inspect it again later.';else if(state.decision==='no_longer_want')explain.textContent='You decided the offer is not worth continuing. Nothing else is required.';else explain.textContent='You chose to leave and get help or more context before committing. Nothing was purchased or cancelled here.'}
function renderStopped(){stepLabel.textContent='Stopped';question.textContent='STOPPED SAFELY';explain.textContent='The drill stopped. Nothing was purchased, cancelled, or changed by Clove. You can leave now.'}
function render(){clearStage();if(state.stage==='BOUNDARY')renderBoundary();else if(state.stage==='OFFER_TYPE')renderType();else if(state.stage==='HEADLINE')renderHeadline();else if(state.stage==='COMMITMENT_CHECK')renderCommitment();else if(state.stage==='DECISION')renderDecision();else if(state.stage==='COMPLETE')renderComplete();else renderStopped()}
stopButton.addEventListener('click',()=>{if(!['COMPLETE','STOPPED_SAFE'].includes(state.stage))transition(state.stage,'STOPPED_SAFE')});
load();render();
})();
```

### digital-stewardship-05.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#07111f">
<meta name="description" content="CloveLearn Digital Stewardship: pause before a high-consequence share and consider who else could see it later.">
<title>Future-Audience Check — CloveLearn</title>
<style>
:root{--bg:#07111f;--panel:#0c1928;--panel2:#102235;--line:#28425c;--text:#edf5ff;--muted:#9fb2c7;--accent:#5eead4;--accent2:#8fc5ff;--warn:#f4c56a;--max:720px}*{box-sizing:border-box}html{background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}body{margin:0;min-height:100dvh;background:radial-gradient(circle at 50% -20%,#16334d 0,var(--bg) 42%)}button{font:inherit;cursor:pointer}.shell{width:min(var(--max),calc(100% - 28px));margin:0 auto;padding:24px 0 64px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:22px}.brand{font-size:11px;font-weight:900;letter-spacing:.16em;color:var(--accent)}.phase{font-size:10px;color:var(--muted);letter-spacing:.08em;text-align:right}.hero{padding:22px 0 18px}h1{font-size:clamp(40px,9vw,66px);line-height:.95;letter-spacing:-.045em;margin:0 0 16px}.lead{font-size:clamp(17px,3vw,21px);color:#cad9e8;margin:0;max-width:620px}.card{background:rgba(12,25,40,.95);border:1px solid var(--line);border-radius:18px;padding:22px;margin:14px 0;box-shadow:0 16px 45px rgba(0,0,0,.18)}.step{font-size:10px;font-weight:900;letter-spacing:.14em;color:var(--accent);text-transform:uppercase;margin-bottom:8px}h2{font-size:26px;line-height:1.15;margin:0 0 10px}.explain{color:var(--muted);font-size:14px;margin:0 0 18px;max-width:610px}.choices{display:grid;gap:10px}.choice,.stop{width:100%;min-height:44px;border:1px solid var(--line);border-radius:12px;background:var(--panel2);color:var(--text);padding:13px 15px;font-weight:850;text-align:left;letter-spacing:.02em}.choice:hover,.choice:focus-visible,.stop:hover,.stop:focus-visible{border-color:var(--accent2);outline:3px solid rgba(143,197,255,.25);outline-offset:2px}.choice.primary{border-color:var(--accent);background:#0b2a30;color:#eafffb}.stop{margin-top:14px;background:transparent;color:var(--muted);text-align:center}.status{font-size:12px;color:var(--warn);min-height:20px;margin:10px 0 0}.privacy{font-size:11px;color:#89a0b7;margin-top:14px;line-height:1.55}.safety{border-left:4px solid var(--warn);padding:12px 14px;background:#19170f;color:#ead8aa;border-radius:0 10px 10px 0;font-size:12px;margin:14px 0}.footer{margin-top:28px;font-size:10px;color:#71869c;line-height:1.6}[hidden]{display:none!important}@media(max-width:520px){.shell{width:min(100% - 20px,var(--max));padding-top:16px}.top{align-items:flex-start}.card{padding:17px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
</style>
</head>
<body>
<main class="shell">
<header class="top"><div class="brand">CLOVELEARN / DIGITAL STEWARDSHIP</div><div class="phase">DS-I5 BUILD CANDIDATE<br>NOT PUBLIC</div></header>
<section class="hero"><h1>FUTURE-AUDIENCE CHECK.</h1><p class="lead">Think once about who else could see a high-consequence share later.</p></section>
<section class="card" aria-labelledby="question"><div id="stepLabel" class="step">Start</div><h2 id="question">Keep the actual content outside Clove.</h2><p id="explain" class="explain"></p><div id="choices" class="choices"></div><button id="stopButton" class="stop" type="button">STOP</button><p id="status" class="status" role="status" aria-live="polite"></p></section>
<p class="privacy"><strong>Ephemeral by design:</strong> Keep the content, identity, recipient, account, and platform outside Clove. Your choices exist only while this page is open. Reloading or leaving resets the check.</p>
<div class="safety"><strong>Adults only:</strong> Do not use this drill for material involving anyone under 18 or to process or facilitate non-consensual intimate material. Clove does not inspect, receive, send, delete, redact, or judge the content.</div>
<p class="footer">Deleting an original later does not guarantee every copy is gone. Professional or relationship consequences from public or redistributed sexualized content are context-dependent, not inevitable. This check does not predict what will happen to you.</p>
<noscript><section class="card"><h2>JavaScript is off.</h2><p class="explain">This interactive check cannot run without JavaScript. Nothing has been saved or sent. You can leave safely.</p></section></noscript>
</main>
<script src="digital-stewardship-05.js" defer></script>
</body>
</html>
```

### digital-stewardship-05.js

```javascript
(() => {
'use strict';
const STAGES=['BOUNDARY','COPYABILITY','AUDIENCE_WIDENING','FUTURE_CONTEXT','DECISION','COMPLETE','STOPPED_SAFE'];
const ANSWERS=new Set(['yes','no','unsure',null]);
const DECISIONS=new Set(['wait','share_less','do_not_share','share_outside','need_help',null]);
const NEXT={BOUNDARY:new Set(['COPYABILITY','STOPPED_SAFE']),COPYABILITY:new Set(['AUDIENCE_WIDENING','STOPPED_SAFE']),AUDIENCE_WIDENING:new Set(['FUTURE_CONTEXT','STOPPED_SAFE']),FUTURE_CONTEXT:new Set(['DECISION','STOPPED_SAFE']),DECISION:new Set(['COMPLETE','STOPPED_SAFE']),COMPLETE:new Set(),STOPPED_SAFE:new Set()};
const blank=()=>({stage:'BOUNDARY',copyability:null,audienceWidening:null,futureContext:null,decision:null});
const stepLabel=document.querySelector('#stepLabel'),question=document.querySelector('#question'),explain=document.querySelector('#explain'),choices=document.querySelector('#choices'),stopButton=document.querySelector('#stopButton'),status=document.querySelector('#status');
let state=blank(),transitionLock=false;
function validState(s){if(!s||!STAGES.includes(s.stage)||!ANSWERS.has(s.copyability??null)||!ANSWERS.has(s.audienceWidening??null)||!ANSWERS.has(s.futureContext??null)||!DECISIONS.has(s.decision??null))return false;if(['BOUNDARY','COPYABILITY','STOPPED_SAFE'].includes(s.stage))return true;if(s.copyability===null)return false;if(s.stage==='AUDIENCE_WIDENING')return true;if(s.audienceWidening===null)return false;if(s.stage==='FUTURE_CONTEXT')return true;if(s.futureContext===null)return false;if(s.stage==='DECISION')return true;if(s.stage==='COMPLETE')return s.decision!==null;return false}
function transition(expected,next,patch={}){if(transitionLock||state.stage!==expected||!NEXT[expected]?.has(next))return false;transitionLock=true;const candidate={...state,...patch,stage:next};if(!validState(candidate)){transitionLock=false;return false}state=candidate;transitionLock=false;render();return true}
function button(label,action,primary=false){const b=document.createElement('button');b.type='button';b.className=`choice${primary?' primary':''}`;b.textContent=label;b.addEventListener('click',action);choices.appendChild(b)}
function clearStage(){choices.replaceChildren();status.textContent='';stopButton.hidden=['COMPLETE','STOPPED_SAFE'].includes(state.stage)}
function answerButtons(expected,next,key){button('YES',()=>transition(expected,next,{[key]:'yes'}),true);button('NO',()=>transition(expected,next,{[key]:'no'}));button("I'M NOT SURE",()=>transition(expected,next,{[key]:'unsure'}))}
function renderBoundary(){stepLabel.textContent='0 / Boundary';question.textContent='Keep the actual content outside Clove.';explain.textContent='Use this only for your own adult sharing decision. Do not describe, paste, upload, or identify the content or anyone involved. This check considers possible future audiences without deciding that harm will occur.';button('START CHECK',()=>transition('BOUNDARY','COPYABILITY'),true)}
function renderCopyability(){stepLabel.textContent='1 / Copyability';question.textContent='Could another person or device retain a copy after you share it?';explain.textContent='Think about screenshots, downloads, forwarding, backups, or another device. You do not need to tell Clove what the material is.';answerButtons('COPYABILITY','AUDIENCE_WIDENING','copyability')}
function renderAudience(){stepLabel.textContent='2 / Audience';question.textContent='Could the audience become wider than the people you intend?';explain.textContent='This can happen through forwarding, reposting, account changes, shared devices, or other copying. A YES or UNSURE answer does not prove that widening will happen.';answerButtons('AUDIENCE_WIDENING','FUTURE_CONTEXT','audienceWidening')}
function renderFuture(){stepLabel.textContent='3 / Future context';question.textContent='If a different future audience saw it, could that matter to you?';explain.textContent='Consider only whether a changed context could matter to you later. Professional, relationship, or reputational consequences are context-dependent, not inevitable.';answerButtons('FUTURE_CONTEXT','DECISION','futureContext')}
function finish(decision){return transition('DECISION','COMPLETE',{decision})}
function renderDecision(){stepLabel.textContent='4 / Decision';question.textContent='What do you want to do now?';const uncertain=[state.copyability,state.audienceWidening,state.futureContext].includes('unsure');const anyYes=[state.copyability,state.audienceWidening,state.futureContext].includes('yes');if(uncertain)explain.textContent='Something remains uncertain. Uncertainty does not prove harm, and you do not have to resolve it by sharing now.';else if(anyYes)explain.textContent='At least one future-audience risk could matter. That does not mean harm is inevitable. The decision remains yours.';else explain.textContent='You did not identify one of these three risks. That does not guarantee a share cannot create a different risk or future consequence.';button('WAIT',()=>finish('wait'),true);button('SHARE LESS OUTSIDE CLOVE',()=>finish('share_less'));button('DO NOT SHARE',()=>finish('do_not_share'));button('SHARE OUTSIDE CLOVE — MY DECISION',()=>finish('share_outside'));button('NEED HELP — LEAVE SAFELY',()=>finish('need_help'))}
function renderComplete(){stepLabel.textContent='Complete';question.textContent='CHECK COMPLETE';if(state.decision==='wait')explain.textContent='You chose to wait. Nothing was sent or changed by Clove.';else if(state.decision==='share_less')explain.textContent='You chose to reduce what you share outside Clove. Clove did not inspect or alter the material.';else if(state.decision==='do_not_share')explain.textContent='You chose not to share. No further action is required here.';else if(state.decision==='share_outside')explain.textContent='Sharing outside Clove is your decision. These three answers do not guarantee safety or predict every possible future consequence.';else explain.textContent='You chose to leave and get more help or context before deciding. Nothing was sent by Clove.'}
function renderStopped(){stepLabel.textContent='Stopped';question.textContent='STOPPED SAFELY';explain.textContent='The check stopped. Nothing was saved, sent, uploaded, deleted, or changed by Clove.'}
function render(){clearStage();if(state.stage==='BOUNDARY')renderBoundary();else if(state.stage==='COPYABILITY')renderCopyability();else if(state.stage==='AUDIENCE_WIDENING')renderAudience();else if(state.stage==='FUTURE_CONTEXT')renderFuture();else if(state.stage==='DECISION')renderDecision();else if(state.stage==='COMPLETE')renderComplete();else renderStopped()}
stopButton.addEventListener('click',()=>{if(!['COMPLETE','STOPPED_SAFE'].includes(state.stage))transition(state.stage,'STOPPED_SAFE')});
render();
})();
```

### digital-stewardship-06.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#07111f">
<meta name="description" content="CloveLearn Digital Stewardship: inspect account recovery readiness without changing account state.">
<title>Recovery Readiness — CloveLearn</title>
<style>
:root{--bg:#07111f;--panel:#0c1928;--panel2:#102235;--line:#28425c;--text:#edf5ff;--muted:#9fb2c7;--accent:#5eead4;--accent2:#8fc5ff;--warn:#f4c56a;--max:720px}*{box-sizing:border-box}html{background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}body{margin:0;min-height:100dvh;background:radial-gradient(circle at 50% -20%,#16334d 0,var(--bg) 42%)}button{font:inherit;cursor:pointer}.shell{width:min(var(--max),calc(100% - 28px));margin:0 auto;padding:24px 0 64px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:22px}.brand{font-size:11px;font-weight:900;letter-spacing:.16em;color:var(--accent)}.phase{font-size:10px;color:var(--muted);letter-spacing:.08em;text-align:right}.hero{padding:22px 0 18px}h1{font-size:clamp(40px,9vw,66px);line-height:.95;letter-spacing:-.045em;margin:0 0 16px}.lead{font-size:clamp(17px,3vw,21px);color:#cad9e8;margin:0;max-width:620px}.card{background:rgba(12,25,40,.95);border:1px solid var(--line);border-radius:18px;padding:22px;margin:14px 0;box-shadow:0 16px 45px rgba(0,0,0,.18)}.step{font-size:10px;font-weight:900;letter-spacing:.14em;color:var(--accent);text-transform:uppercase;margin-bottom:8px}h2{font-size:26px;line-height:1.15;margin:0 0 10px}.explain{color:var(--muted);font-size:14px;margin:0 0 18px;max-width:610px}.choices{display:grid;gap:10px}.choice,.stop{width:100%;min-height:44px;border:1px solid var(--line);border-radius:12px;background:var(--panel2);color:var(--text);padding:13px 15px;font-weight:850;text-align:left;letter-spacing:.02em}.choice:hover,.choice:focus-visible,.stop:hover,.stop:focus-visible{border-color:var(--accent2);outline:3px solid rgba(143,197,255,.25);outline-offset:2px}.choice.primary{border-color:var(--accent);background:#0b2a30;color:#eafffb}.stop{margin-top:14px;background:transparent;color:var(--muted);text-align:center}.status{font-size:12px;color:var(--warn);min-height:20px;margin:10px 0 0}.privacy{font-size:11px;color:#89a0b7;margin-top:14px;line-height:1.55}.safety{border-left:4px solid var(--warn);padding:12px 14px;background:#19170f;color:#ead8aa;border-radius:0 10px 10px 0;font-size:12px;margin:14px 0}.footer{margin-top:28px;font-size:10px;color:#71869c;line-height:1.6}[hidden]{display:none!important}@media(max-width:520px){.shell{width:min(100% - 20px,var(--max));padding-top:16px}.top{align-items:flex-start}.card{padding:17px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
</style>
</head>
<body>
<main class="shell">
<header class="top"><div class="brand">CLOVELEARN / DIGITAL STEWARDSHIP</div><div class="phase">DS-I6 BUILD CANDIDATE<br>NOT PUBLIC</div></header>
<section class="hero"><h1>RECOVERY READINESS.</h1><p class="lead">Inspect whether you could recover one account later without changing anything now.</p></section>
<section class="card" aria-labelledby="question"><div id="stepLabel" class="step">Start</div><h2 id="question">Inspect one account you are authorized to use.</h2><p id="explain" class="explain"></p><div id="choices" class="choices"></div><button id="stopButton" class="stop" type="button">STOP</button><p id="status" class="status" role="status" aria-live="polite"></p></section>
<p class="privacy"><strong>Ephemeral by design:</strong> Do not enter the service, username, contact details, password, passkey, PIN, authentication code, recovery code, or backup code into Clove. Your choices exist only while this page is open and are not sent anywhere.</p>
<div class="safety"><strong>Inspect only. Change nothing.</strong> Do not log out, start a password reset, remove or replace a recovery method, disable two-factor authentication, rotate codes, revoke sessions, or delete the account. If normal access is unavailable, use the service's official help or recovery route outside Clove.</div>
<p class="footer">Adults only. No answer proves that this account is secure or compromised. This drill checks recovery readiness only; it does not certify security or perform an account change.</p>
<noscript><section class="card"><h2>JavaScript is off.</h2><p class="explain">This interactive inspection cannot run without JavaScript. Nothing has been saved or sent. You can leave safely.</p></section></noscript>
</main>
<script src="digital-stewardship-06.js" defer></script>
</body>
</html>
```

### digital-stewardship-06.js

```javascript
(() => {
'use strict';
const STAGES=['BOUNDARY','NORMAL_ACCESS','RECOVERY_SETTINGS','RECOGNIZABLE_METHOD','SECOND_ROUTE','DECISION','COMPLETE','STOPPED_SAFE'];
const ANSWERS=new Set(['yes','no','unsure',null]);
const DECISIONS=new Set(['ready_enough','update_later','official_help','need_help',null]);
const NEXT={BOUNDARY:new Set(['NORMAL_ACCESS','STOPPED_SAFE']),NORMAL_ACCESS:new Set(['RECOVERY_SETTINGS','DECISION','STOPPED_SAFE']),RECOVERY_SETTINGS:new Set(['RECOGNIZABLE_METHOD','DECISION','STOPPED_SAFE']),RECOGNIZABLE_METHOD:new Set(['SECOND_ROUTE','STOPPED_SAFE']),SECOND_ROUTE:new Set(['DECISION','STOPPED_SAFE']),DECISION:new Set(['COMPLETE','STOPPED_SAFE']),COMPLETE:new Set(),STOPPED_SAFE:new Set()};
const blank=()=>({stage:'BOUNDARY',normalAccess:null,settingsFound:null,recognizableMethod:null,secondRoute:null,decision:null});
const stepLabel=document.querySelector('#stepLabel'),question=document.querySelector('#question'),explain=document.querySelector('#explain'),choices=document.querySelector('#choices'),stopButton=document.querySelector('#stopButton'),status=document.querySelector('#status');
let state=blank(),transitionLock=false;
function decisionReady(s){if(s.normalAccess===null)return false;if(s.normalAccess!=='yes')return s.settingsFound===null&&s.recognizableMethod===null&&s.secondRoute===null;if(s.settingsFound===null)return false;if(s.settingsFound!=='yes')return s.recognizableMethod===null&&s.secondRoute===null;return s.recognizableMethod!==null&&s.secondRoute!==null}
function validState(s){if(!s||!STAGES.includes(s.stage)||!ANSWERS.has(s.normalAccess??null)||!ANSWERS.has(s.settingsFound??null)||!ANSWERS.has(s.recognizableMethod??null)||!ANSWERS.has(s.secondRoute??null)||!DECISIONS.has(s.decision??null))return false;if(['BOUNDARY','NORMAL_ACCESS','STOPPED_SAFE'].includes(s.stage))return true;if(s.normalAccess===null)return false;if(s.stage==='RECOVERY_SETTINGS')return s.normalAccess==='yes';if(s.stage==='RECOGNIZABLE_METHOD')return s.normalAccess==='yes'&&s.settingsFound==='yes';if(s.stage==='SECOND_ROUTE')return s.normalAccess==='yes'&&s.settingsFound==='yes'&&s.recognizableMethod!==null;if(s.stage==='DECISION')return decisionReady(s);if(s.stage==='COMPLETE'){if(!decisionReady(s)||s.decision===null)return false;if(s.decision==='ready_enough')return s.normalAccess==='yes'&&s.settingsFound==='yes'&&s.recognizableMethod==='yes'&&s.secondRoute==='yes';return true}return false}
function transition(expected,next,patch={}){if(transitionLock||state.stage!==expected||!NEXT[expected]?.has(next))return false;transitionLock=true;const candidate={...state,...patch,stage:next};if(!validState(candidate)){transitionLock=false;return false}state=candidate;transitionLock=false;render();return true}
function button(label,action,primary=false){const b=document.createElement('button');b.type='button';b.className=`choice${primary?' primary':''}`;b.textContent=label;b.addEventListener('click',action);choices.appendChild(b)}
function clearStage(){choices.replaceChildren();status.textContent='';stopButton.hidden=['COMPLETE','STOPPED_SAFE'].includes(state.stage)}
function answerButtons(expected,onYes,onNo,onUnsure){button('YES',onYes,true);button('NO',onNo);button("I'M NOT SURE",onUnsure)}
function renderBoundary(){stepLabel.textContent='0 / Boundary';question.textContent='Inspect one account you are authorized to use.';explain.textContent='Inspect only. Change nothing. Keep the service and every credential, code, contact detail, and recovery value outside Clove. This is a readiness check, not a security test.';button('START INSPECTION',()=>transition('BOUNDARY','NORMAL_ACCESS'),true)}
function renderNormal(){stepLabel.textContent='1 / Normal access';question.textContent='Can you access this account normally right now?';explain.textContent='Do not log out to test recovery. Answer from your current normal access only. If access is unavailable or uncertain, this inspection stops before recovery settings.';answerButtons('NORMAL_ACCESS',()=>transition('NORMAL_ACCESS','RECOVERY_SETTINGS',{normalAccess:'yes'}),()=>transition('NORMAL_ACCESS','DECISION',{normalAccess:'no'}),()=>transition('NORMAL_ACCESS','DECISION',{normalAccess:'unsure'}))}
function renderSettings(){stepLabel.textContent='2 / Settings';question.textContent='Can you locate its recovery or security settings without changing anything?';explain.textContent='Inspection only. Do not start a reset, remove a method, disable two-factor authentication, rotate codes, or change the account.';answerButtons('RECOVERY_SETTINGS',()=>transition('RECOVERY_SETTINGS','RECOGNIZABLE_METHOD',{settingsFound:'yes'}),()=>transition('RECOVERY_SETTINGS','DECISION',{settingsFound:'no'}),()=>transition('RECOVERY_SETTINGS','DECISION',{settingsFound:'unsure'}))}
function renderMethod(){stepLabel.textContent='3 / Recovery method';question.textContent='Does at least one listed recovery method look like something you still control?';explain.textContent='Do not enter the address, phone number, code, or method into Clove. Answer only whether at least one visible method looks recognizable and still under your control.';answerButtons('RECOGNIZABLE_METHOD',()=>transition('RECOGNIZABLE_METHOD','SECOND_ROUTE',{recognizableMethod:'yes'}),()=>transition('RECOGNIZABLE_METHOD','SECOND_ROUTE',{recognizableMethod:'no'}),()=>transition('RECOGNIZABLE_METHOD','SECOND_ROUTE',{recognizableMethod:'unsure'}))}
function renderSecond(){stepLabel.textContent='4 / Backup route';question.textContent='Is a second independent recovery route or backup option visible?';explain.textContent='Inspect only. Do not reveal or rotate a backup code and do not change a recovery method. A second visible route improves readiness information but does not prove security.';answerButtons('SECOND_ROUTE',()=>transition('SECOND_ROUTE','DECISION',{secondRoute:'yes'}),()=>transition('SECOND_ROUTE','DECISION',{secondRoute:'no'}),()=>transition('SECOND_ROUTE','DECISION',{secondRoute:'unsure'}))}
function finish(decision){return transition('DECISION','COMPLETE',{decision})}
function renderDecision(){stepLabel.textContent='5 / Decision';question.textContent='What is the safest next step?';const allYes=state.normalAccess==='yes'&&state.settingsFound==='yes'&&state.recognizableMethod==='yes'&&state.secondRoute==='yes';if(state.normalAccess!=='yes'){explain.textContent='Normal access is unavailable or uncertain. Do not test recovery from Clove. Use the service’s official help or recovery route outside Clove, or get help before changing anything.';button('USE OFFICIAL HELP / RECOVERY OUTSIDE CLOVE',()=>finish('official_help'),true);button('NEED HELP BEFORE CHANGING ANYTHING',()=>finish('need_help'));return}if(state.settingsFound!=='yes'){explain.textContent='Recovery settings were unavailable or uncertain. That does not prove a security problem. Record only that recovery readiness needs attention later; make no change in this drill.';button('NEEDS A RECOVERY UPDATE LATER',()=>finish('update_later'),true);button('USE OFFICIAL HELP / RECOVERY OUTSIDE CLOVE',()=>finish('official_help'));button('NEED HELP BEFORE CHANGING ANYTHING',()=>finish('need_help'));return}if(allYes){explain.textContent='Normal access, a recognizable recovery method, and a second route were visible. That is enough for this inspection only; it is not a security guarantee.';button('READY ENOUGH FOR NOW',()=>finish('ready_enough'),true);button('NEEDS A RECOVERY UPDATE LATER',()=>finish('update_later'));button('NEED HELP BEFORE CHANGING ANYTHING',()=>finish('need_help'));return}explain.textContent='One or more recovery details were missing or uncertain. That does not prove compromise. Make no change here; plan a recovery update later or get official help before changing anything.';button('NEEDS A RECOVERY UPDATE LATER',()=>finish('update_later'),true);button('USE OFFICIAL HELP / RECOVERY OUTSIDE CLOVE',()=>finish('official_help'));button('NEED HELP BEFORE CHANGING ANYTHING',()=>finish('need_help'))}
function renderComplete(){stepLabel.textContent='Complete';question.textContent='INSPECTION COMPLETE';if(state.decision==='ready_enough')explain.textContent='The visible recovery setup was ready enough for this inspection. This is not a security guarantee, and Clove changed nothing.';else if(state.decision==='update_later')explain.textContent='You identified a recovery-readiness gap or uncertainty. Plan any update later through the service itself, after verifying what you intend to change.';else if(state.decision==='official_help')explain.textContent='Use the service’s official help or recovery route outside Clove. Clove does not provide bypass instructions or perform recovery.';else explain.textContent='You chose to get help before changing anything. Nothing was reset, removed, disabled, revoked, deleted, saved, or sent by Clove.'}
function renderStopped(){stepLabel.textContent='Stopped';question.textContent='STOPPED SAFELY';explain.textContent='The inspection stopped. Nothing was saved, sent, reset, removed, disabled, revoked, or deleted by Clove.'}
function render(){clearStage();if(state.stage==='BOUNDARY')renderBoundary();else if(state.stage==='NORMAL_ACCESS')renderNormal();else if(state.stage==='RECOVERY_SETTINGS')renderSettings();else if(state.stage==='RECOGNIZABLE_METHOD')renderMethod();else if(state.stage==='SECOND_ROUTE')renderSecond();else if(state.stage==='DECISION')renderDecision();else if(state.stage==='COMPLETE')renderComplete();else renderStopped()}
stopButton.addEventListener('click',()=>{if(!['COMPLETE','STOPPED_SAFE'].includes(state.stage))transition(state.stage,'STOPPED_SAFE')});
render();
})();
```

# Part V — Release-integrity evidence

The production file list and preflight below were both executed inside a detached worktree of Candidate A itself, not the evaluation branch. Candidate A reproduces the previously verified 302-file public path set exactly, while all DS-00 through DS-06 runtime files remain forbidden sentinels.

```json
{
  "public_surface_comparison": {
    "baseline_commit": "a2b7d8a35832a2eb75e0a8d8948ba1d2586032d1",
    "candidate_commit": "3c0883a94e5a816df87d31f90f51280f023845d6",
    "baseline_count": 302,
    "candidate_count": 302,
    "added": [],
    "removed": []
  },
  "production_preflight": {
    "status": "PASS",
    "included_count": 302,
    "excluded_count": 881,
    "hardening_excluded_count": 112,
    "required_files": [
      "index.html",
      "mission-001.html",
      "mission-001-app.js",
      "mission-private-store.js"
    ],
    "forbidden_sentinels": [
      "docs/CLOVE_V2_PROJECT_CONTROL.md",
      "tests/static/mission-001-contract.test.mjs",
      "workers/insights/src/contracts.ts",
      ".github/workflows/f1-verify.yml",
      "agent/cost-constitution.json",
      "new-work/F2F3_GOLD_KEY_v0.3.1.csv",
      "master-map.md",
      "clovelearn-test-harness.html",
      "digital-stewardship-00.html",
      "digital-stewardship-00.js",
      "digital-stewardship-01.html",
      "digital-stewardship-01.js",
      "digital-stewardship-02.html",
      "digital-stewardship-02.js",
      "digital-stewardship-03.html",
      "digital-stewardship-03.js",
      "digital-stewardship-04.html",
      "digital-stewardship-04.js",
      "digital-stewardship-05.html",
      "digital-stewardship-05.js",
      "digital-stewardship-06.html",
      "digital-stewardship-06.js"
    ],
    "mission_runtime": [
      "mission-001-app.js",
      "mission-001.html",
      "mission-private-store.js"
    ],
    "errors": []
  }
}
```
