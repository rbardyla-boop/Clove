# CloveLearn v2 — Digital Stewardship F0.5 Evidence Unit 02

Status: **EVIDENCE ADJUDICATED / NOT PUBLIC CURRICULUM**  
Date: 2026-08-12  
Parent issue: #148  
Claims: DS-P04, DS-P05

## Purpose

Test two common Digital Stewardship slogans without importing pop-neuroscience or anti-technology folklore:

- whether attention products are deliberately designed to steer and retain behavior;
- whether a free app necessarily means the user is paying with behavioral data.

---

## DS-P04 — Attention products are designed to exploit psychological vulnerabilities

### Original provisional claim

> Attention products are designed to exploit psychological vulnerabilities.

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

### Retired wording

> Behavioral psychologists engineered the dopamine loop in your phone to addict you.

Reason: overgeneralized mechanism and intent claim.

### Curriculum consequence

DS-03 should use an operational test rather than a neuroscience story:

**ATTENTION AAR (After-Action Review)**

1. What did I open the app to do?
2. What actually happened?
3. What mechanism extended the session: recommendation, autoplay, infinite continuation, notification, social response, search drift, or deliberate choice?
4. Was the extra time useful to my stated purpose?
5. Which single setting or friction would make the next use more intentional?

Recommended interventions can be tested directly:

- disable non-human/non-essential notifications;
- remove unnecessary home-screen launch points;
- disable autoplay where available;
- use explicit session/exit criteria;
- compare app versus browser/desktop access;
- retain communication functions without automatically retaining the feed.

No dopamine claim is needed.

---

## DS-P05 — Free apps generally monetize behavioral data

### Original provisional claim

> Free apps generally monetize behavioral data.

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

### Curriculum consequence

Replace the original immutable rule with:

> **FREE IS A PRICE. FIND THE BUSINESS MODEL.**

For any service, answer:

1. Who pays the company?
2. What event creates revenue?
3. What user data is collected?
4. Which data is needed to provide the service, and which supports personalization, advertising, analytics or other secondary uses?
5. What controls or paid/non-tracked alternatives exist?
6. What would break if tracking/personalization were turned off?

The result can be `AD-FUNDED`, `SUBSCRIPTION`, `TRANSACTION`, `CROSS-SUBSIDIZED`, `PUBLIC/GRANT`, `MIXED`, or `UNKNOWN`.

Unknown is an acceptable answer. Guessing is not.

---

## Unit 02 terminal result

### DS-P04
`SUPPORTED MECHANISM / ORIGINAL INTENT LANGUAGE TOO STRONG`

Recommendation and notification systems demonstrably use behavioral/engagement signals; deceptive design is a documented regulator concern. Universal addiction/dopamine/psychologist intent claims are not established.

### DS-P05
`SUPPORTED FOR SPECIFIC AD-SUPPORTED SERVICES / RETIRE AS UNIVERSAL RULE`

Major ad-supported services monetize advertising and use behavioral information in personalization, but 'free' does not identify a universal data-extraction business model.

## Next evidence unit

Proceed to DS-P06 through DS-P08:

- cloud/platform permanence and deletion limits;
- creator-platform earnings distributions;
- defensible long-term reputation/employment/safety effects;
- no fabricated prevalence or gender-generalization claims.

Public Digital Stewardship curriculum remains unauthorized until #148 reaches a terminal verdict.