# Legal Compliance, Security & Risk Management for Software Applications

> As of May 2026. Covers general software/SaaS; not specific to any one codebase.
> Implementation notes are ordered **free/cheapest first**. Paid alternatives follow for scale.

---

## 0. Day 0 Compliance Stack (Cheapest Path to Production-Ready)

The table below is the minimum viable stack for a small team shipping a real product. Everything here is either free or under $50/month until you hit meaningful scale.

| Layer | Free Option | Paid Upgrade (when you outgrow it) | Monthly Cost (free tier) |
|---|---|---|---|
| **AU Privacy Policy (APPs + GDPR)** | Termly or Iubenda — select "Australia" jurisdiction | Termly Pro+ $20/site | $0 |
| Privacy policy + ToS (general) | Termly (1 policy free) | Termly Pro+ $20/site | $0 |
| Cookie consent | CookieYes (5K pageviews/mo) | CookieYes Pro $20 | $0 |
| Auth + MFA | Clerk (10K MAU) or Supabase Auth (50K MAU) | WorkOS for enterprise SSO | $0 |
| Secrets management | Doppler (free tier) or Infisical (self-host) | Doppler Team $7/user/mo | $0 |
| SAST | Semgrep OSS + GitHub Dependabot | Semgrep Team $40/dev/mo | $0 |
| WAF / DDoS | Cloudflare Free | Cloudflare Pro $20/mo | $0 |
| Logging / SIEM | Axiom (500 GB/mo free) or Better Stack (3 GB free) | Axiom $25/mo | $0 |
| Container scanning | Trivy (OSS) | Snyk Container $25/dev/mo | $0 |
| Accessibility testing | axe-core OSS + Lighthouse (Chrome DevTools) | axe DevTools Pro $40/dev/mo | $0 |
| **UGC content moderation** | OpenAI Moderation API (free tier) + in-app flag/block UI | AWS Rekognition for image moderation | $0 |
| Incident runbook | Markdown file in repo (include NDB notification template) | Incident.io Team $310/10 eng | $0 |
| **NDB breach notification** | OAIC notification runbook as markdown in repo | — | $0 |
| Pen testing | OWASP ZAP (free DAST) | Oneleet/Cobalt $15K–30K/yr | $0 |
| SOC 2 | N/A — defer until enterprise sales require it | Vanta $12K/yr, Oneleet $15K/yr | — |

**Estimated day-0 cash outlay: $0.** Graduate each line item when you hit the free-tier ceiling or when a customer requires it.

---

## 1. Food App–Specific Requirements

A food discovery and review app has compliance obligations that generic SaaS guides don't cover. These are on top of — not instead of — the legal and security layers in §2–§4.

---

### 1.1 User-Generated Content (UGC) Compliance

Reviews, posts, photos, and social feeds make your platform a publisher in the eyes of several laws.

- **ACCC fake review laws (AU)**: Businesses cannot solicit, publish, or remove reviews in a misleading way. You cannot incentivise reviews without clear disclosure, and you cannot selectively remove negative reviews. ACCC has active enforcement history against platforms and brands.
- **Australian Consumer Law (ACL) §18**: Misleading or deceptive conduct — a fake or manipulated review system creates direct liability for your platform.
- **FTC endorsement guidelines (US, for global expansion)**: Incentivised or paid reviews must be clearly disclosed. Applies when US users see the content.
- **EU Omnibus Directive (EU)**: Platforms must verify that reviews come from genuine purchasers and disclose how verification works.
- **Defamation risk**: Restaurant reviews containing false statements of fact can expose the platform to defamation claims — especially in AU where defamation law is plaintiff-friendly. Implement a transparent dispute process and take it seriously.
- **Online Safety Act 2021 (AU)**: The eSafety Commissioner can issue removal notices for harmful content (harassment, serious abuse). There is no equivalent of Section 230 in Australia — you cannot rely on it as a shield. Implement tiered moderation: AI auto-flag → human review queue.
- **DMCA / equivalent takedown**: For copyrighted images and text in user-submitted posts, you need a documented process to receive and action takedown notices.

> **→ Implement**
> 1. Build an AI auto-moderation pipeline (OpenAI Moderation API — free tier) as the first pass; route flagged content to a human review queue.
> 2. Publish a review dispute policy in your ToS — restaurants and users need a clear path to flag a review for investigation.
> 3. Add a DMCA/takedown contact email + a committed SLA (e.g., 5 business days) to your ToS and footer.
> 4. Implement an in-app "flag this review" button before app store submission — both Apple and Google require it for UGC apps.

---

### 1.2 Restaurant Data, Rankings & Algorithm Transparency

If you rank, sort, or score restaurants, you have disclosure obligations toward the businesses listed.

- **ACCC guidance + EU Platform-to-Business (P2B) Regulation**: Platforms must disclose the main parameters that determine ranking to listed businesses. You don't have to reveal a secret formula, but you must explain what factors matter (e.g., review score, recency, distance, responsiveness).
- **Anti-manipulation**: Define and enforce rules against review stuffing, competitor sabotage, and undisclosed paid placements. A business paying to rank higher without disclosure is a misleading practice under ACL.
- **Data accuracy**: If you scrape or aggregate restaurant data (hours, addresses, menus, photos), stale data is a consumer complaint waiting to happen. A customer showing up to a closed restaurant based on your app is a real risk.
- **Third-party data source agreements**: Google Places, Yelp, and similar APIs have specific ToS around caching limits, attribution requirements, and commercial use restrictions. Violating these can result in API key termination.
- **Listing rights**: You have no legal obligation to list a restaurant, but removal must be consistent with your published ToS to avoid claims of discriminatory or arbitrary conduct.

> **→ Implement**
> 1. Publish a plain-language help page explaining how rankings work (key factors, not weights).
> 2. Build a self-serve "claim your listing" portal so restaurant owners can correct their data — this reduces your data accuracy liability.
> 3. Log all ranking algorithm changes with timestamps; required if you ever face a dispute from a restaurant claiming they were unfairly demoted.
> 4. Review the caching and attribution requirements of every third-party API you use before launch.

---

### 1.3 Location Services & GPS Privacy

Location data is the most sensitive data type your app is likely to collect.

- **AU Privacy Act APP 3**: Location is personal information. You must only collect it to the extent necessary for the function the user is actively using. Collecting precise GPS when suburb-level would suffice is a breach of the data minimisation principle.
- **Background location**: Do not collect background location without explicit, informed opt-in and a clearly articulated use case. Most food discovery features do not need background location.
- **Location history retention**: Do not store precise location history longer than operationally necessary. Recommended: anonymise or delete precise coordinates after the session ends; retain only coarse location (suburb or postcode) for analytics if needed.
- **GDPR (global expansion)**: Location data is personal data; persistent precise location is treated as near-special-category data under GDPR guidance — explicit consent is the only safe legal basis.

> **→ Implement**
> 1. Request location permission contextually (when the user taps "Find restaurants near me"), not on app launch.
> 2. Offer a manual suburb/postcode entry as an alternative — this is required for accessibility and reduces friction for users who decline location access.
> 3. Document your retention period explicitly in your privacy policy (e.g., "We do not retain your precise GPS coordinates after your session ends").
> 4. Anonymise or aggregate location data before it enters any analytics pipeline.

---

### 1.4 Food Safety Data Display

If you display health inspection scores, food safety ratings, or allergen information, you take on accuracy obligations.

- **Health inspection scores**: These come from state and local council datasets. Date-stamp every score and link to the authoritative government source. A prominently displayed score with no date misleads users.
- **Allergen information**: Allergen accuracy is the restaurant's legal responsibility under the Food Standards Australia New Zealand (FSANZ) framework, not yours. But if you display allergen data from menus or user submissions, add a clear disclaimer that this information is provided by the restaurant and may not reflect current menu items. Do not create an implied warranty of accuracy.
- **FSANZ compliance**: You are not a food business and FSANZ standards do not directly bind you — but presenting user-submitted allergen data as reliable could expose you to negligence claims if a user has an allergic reaction.

> **→ Implement**
> 1. Date-stamp all third-party data (inspection scores, ratings) at ingest, and show the date to users.
> 2. Add a disclaimer on any page displaying food safety or allergen data: "Information is provided by the restaurant and may not be current. Contact the restaurant to confirm."
> 3. Link directly to the relevant council, FSANZ, or state health authority source.

---

### 1.5 App Store Compliance (Apple / Google Play)

App stores are regulatory gatekeepers — failing their requirements means your app doesn't ship.

- **Apple Privacy Nutrition Labels**: Every data type you collect must be accurately declared in your App Store Connect listing, categorised by whether it's linked to identity and whether it's used for tracking. This includes data collected by third-party SDKs (analytics, crash reporting, advertising). You must update your labels whenever you add a new data category or SDK.
- **Google Play Data Safety form**: Equivalent to Apple's labels; must be accurate and kept current. Google now cross-checks your declared data practices against the permissions your app requests.
- **UGC content policy**: Both Apple (§5.6) and Google Play require apps with user-generated content to provide: (a) a method for users to flag offensive content, (b) a method to block other users, and (c) a moderation process. You must have all three before submission.
- **Age rating — alcohol content**: If your app lists bars, cocktail bars, or restaurant menus with alcohol, apply a 17+ age rating (Apple) and appropriate Google Play content rating. Consider gating explicit alcohol content behind an age confirmation.
- **In-app purchase revenue share**: When you add payments, both stores take 15–30%. This affects your pricing model significantly.

> **→ Implement**
> 1. Before your first app store submission, audit every SDK in your app and map it to the Apple and Google data disclosure forms. Missing a tracking SDK is a common reason for app rejection.
> 2. Implement the in-app content reporting flow (flag content, block user) before submission — retrofitting this after rejection costs a full review cycle.
> 3. Review [Apple App Store Review Guideline §5.6](https://developer.apple.com/app-store/review/guidelines/#user-generated-content) and the [Google Play UGC Policy](https://support.google.com/googleplay/android-developer/answer/9876714) before building your moderation UI.

---

### 1.6 Payment Readiness (Future-Proofing)

Payments are not live yet, but architectural and regulatory decisions made now determine how hard it is to add them.

- **PCI-DSS**: When payments go live, use a tokenisation provider (Stripe, Braintree, Adyen) and never let raw card data touch your servers. This limits your PCI-DSS scope to SAQ A (the simplest self-assessment). Stripe's Connect product is purpose-built for marketplace payments where money flows restaurant → platform → consumer.
- **Australian Financial Services Licence (AFSL)**: If you collect money on behalf of restaurants and hold it in a platform account before paying out, you may be operating as a payment facilitator — which requires either an AFSL or registration under a licensing exemption. Get legal advice before going live with payouts.
- **GST / tax reporting**: Restaurant payouts may trigger GST withholding and reporting obligations. Engage an accountant before enabling payouts.

> **→ Implement (now, before payments are built)**
> 1. Add a `payments` table stub to your database schema — even just `id, user_id, amount, currency, status, created_at`. Retrofitting a payment data model into a live app is painful.
> 2. Create a Stripe account and choose Stripe Connect as your payment architecture now. The integration can sit dormant until you're ready.
> 3. Add a note to your architecture docs: "PCI-DSS scope = SAQ A, using Stripe tokenisation. No card data ever touches our servers."

---

## 2. Legal & Compliance Layer

### 2.1 Privacy Laws (Data Protection)

These are the non-negotiable legal floors. Violating them brings fines, lawsuits, and reputational damage.

#### Australian Privacy Act 1988 + Australian Privacy Principles (AU — primary market)

The Australian Privacy Act and its 13 Australian Privacy Principles (APPs) are your primary compliance floor. They apply to any organisation with annual turnover over $3M AUD, any organisation that trades in personal information, health service providers, and government contractors. Even if you are below the $3M threshold, ACCC and courts still apply ACL and tort law to privacy-related harms.

**Key APPs for a food app:**

| APP | Principle | What it means for you |
|---|---|---|
| APP 1 | Open & transparent management | Publish a clear Privacy Policy that covers all data practices |
| APP 3 | Collection of solicited personal info | Only collect what's necessary; location is personal information |
| APP 5 | Notification at collection | Tell users what you collect and why at the point of collection |
| APP 6 | Use & disclosure | Only use data for the primary purpose it was collected for, unless consent or a legal exception applies |
| APP 7 | Direct marketing | Must allow opt-out from marketing; cannot use sensitive data for targeting |
| APP 11 | Security of personal information | Take reasonable steps to protect personal information from misuse, interference, and loss |
| APP 12 | Access | Users can request access to personal information you hold about them |
| APP 13 | Correction | Users can request correction of inaccurate, out-of-date, or incomplete information |

**Notifiable Data Breaches (NDB) scheme**: If a breach is likely to result in serious harm to any individual, notify the Office of the Australian Information Commissioner (OAIC) and affected individuals as soon as practicable — target within 30 days of becoming aware.

**Spam Act 2003**: Consent is required before sending commercial electronic messages (email, SMS, push notifications with commercial content). Every message must include an unsubscribe mechanism that works within 5 business days. Keep consent records.

**Online Safety Act 2021**: The eSafety Commissioner can issue removal notices for seriously harmful online content. Implement a clear escalation and takedown process before launch.

**Fines**: Up to $50M AUD for serious or repeated privacy breaches (Privacy Act reforms, effective 2024). The OAIC also has new powers to conduct assessments without a complaint trigger.

> **→ Implement**
> 1. Use **Termly** or **Iubenda** to generate your Privacy Policy — select "Australia" in the jurisdiction selector so the APPs are covered alongside GDPR.
> 2. Add a data access and correction request form to your app or website. A Typeform or simple email process is sufficient for early stage.
> 3. Build a NDB response runbook (markdown file in your repo) before launch: who decides if a breach is notifiable, who contacts the OAIC, and what the notification template looks like.
> 4. Register with the OAIC once you cross the $3M revenue threshold: [oaic.gov.au](https://www.oaic.gov.au)
> 5. Subscribe to OAIC privacy guidance updates — they regularly publish position papers on AI, location data, and biometrics.

---

#### GDPR (EU — applies to any app with EU users)
- Lawful basis for every data processing activity (consent, legitimate interest, contract, legal obligation)
- Privacy policy disclosing: what data, why, how long, who it's shared with
- User rights: access, rectification, erasure ("right to be forgotten"), portability, objection
- Data Protection Officer (DPO) required if processing at scale or sensitive data
- Data Protection Impact Assessments (DPIAs) for high-risk processing (AI, profiling, sensitive data)
- 72-hour breach notification to supervisory authority; notify users if high risk
- Data Processing Agreements (DPAs) with every vendor/processor
- Fines: up to €20M or 4% of global annual revenue

#### CCPA / CPRA (California — applies broadly to US companies)
- As of Jan 1 2026: mandatory opt-out confirmation for data sales/sharing
- Enhanced data access rights (historical data back to Jan 2022)
- Mandatory risk assessments starting Jan 1 2026 (attestation due Apr 2028)
- Cybersecurity audits phased by revenue tier (2028–2030 deadlines)
- Applies if: revenue >$26.6M/yr OR 50%+ revenue from data OR 100,000+ CA consumers/households
- Fines: up to $7,500 per intentional violation

#### US State Privacy Law Wave (2026)
20 US states now have comprehensive privacy laws as of March 2026. Indiana, Kentucky, Rhode Island, Oregon, Virginia, Connecticut, Utah all have laws in effect or taking effect in 2026. Core rights are similar to GDPR: access, deletion, correction, opt-out of profiling.

**Minimum action**: Your privacy policy, consent mechanisms, and data subject request workflows must satisfy the strictest applicable law — usually GDPR if you have any EU users.

#### HIPAA (US — healthcare data)
Only applies if you handle Protected Health Information (PHI), but critical when it does:
- Privacy Rule: minimum necessary standard, patient rights, Notice of Privacy Practices
- Security Rule: administrative, physical, and technical safeguards for ePHI
- Business Associate Agreements (BAAs) required with all vendors touching PHI
- Breach notification: affected individuals + HHS within 60 days
- No opt-out — strict liability, civil and criminal penalties

#### COPPA (US — children under 13)
- Verifiable parental consent before collecting any data from under-13 users
- No behavioral advertising to children
- Updated 2024 rules take effect 2026, adding stricter consent requirements

#### PCI-DSS (payment card data)
- If you take payments, you must be PCI-DSS compliant (Level 1–4 based on volume)
- Don't store raw card data — use a tokenization provider (Stripe, Braintree, etc.)
- Annual assessments, network scans, penetration tests

> **→ Implement (free-first)**
>
> **Privacy policy + ToS:**
> 1. **Termly** (free for 1 policy) — questionnaire-driven, covers GDPR + CCPA, embed via `<script>` tag. Upgrade to Pro+ ($20/site/month) for unlimited policies and cookie scanning. [termly.io](https://termly.io)
> 2. **Iubenda** (~$29/year) — EU attorney-reviewed clauses; better GDPR depth and App Store compatibility. [iubenda.com](https://www.iubenda.com)
>
> **Cookie consent (GDPR opt-in / CCPA opt-out):**
> 1. **CookieYes** (free up to 5K pageviews/month) — auto-blocking of non-essential cookies, GDPR/CCPA/LGPD templates, single `<script>` embed. Paid from $10/month. [cookieyes.com](https://www.cookieyes.com)
> 2. **Osano** (free up to 5K visitors/month) — includes a "No Fines" pledge at Plus ($199/month). Better for multi-jurisdiction. [osano.com](https://www.osano.com)
>
> **Data Subject Access Request (DSAR) automation (when volume warrants):**
> - **Osano** data privacy module handles DSAR workflows — included in paid tiers.
> - **Transcend** — API-first DSAR automation for higher volumes; custom pricing.
>
> **Note:** Do not copy-paste generic privacy policy templates. Termly and Iubenda generate policies based on your actual data practices. Using a template without customization is a GDPR violation waiting to happen.

---

### 2.2 AI-Specific Laws (new and critical in 2026)

#### EU AI Act (fully applicable Aug 2, 2026)
Risk-tiered framework:

| Risk Level | Examples | Requirements |
|---|---|---|
| **Unacceptable** (banned) | Social scoring, subliminal manipulation, real-time biometric surveillance (with narrow exceptions) | Prohibited outright |
| **High-risk** | Employment AI, education, credit scoring, law enforcement, safety-critical systems | Risk management system, data governance, technical documentation, human oversight, conformity assessment |
| **Limited-risk** | Chatbots, deepfakes, emotion recognition | Transparency obligations (disclose it's AI) |
| **Minimal-risk** | AI spam filters, recommendation engines | Voluntary codes of practice |

Penalties: Up to €40M or 7% of global revenue for prohibited practices; up to €20M or 4% for other violations.

**Key requirements for high-risk AI**:
- Documented risk management system throughout lifecycle
- Training data governance (quality, bias testing, documentation)
- Technical documentation and audit logs
- Human oversight mechanisms
- Accuracy, robustness, cybersecurity measures
- DPIAs required (high-risk AI + personal data)

#### Other AI Regulations
- **US Executive Orders / NIST AI RMF**: Voluntary but increasingly referenced in procurement
- **Colorado AI Act**: Transparency for consequential decisions using AI (employment, lending, housing)
- Multiple US states following with similar bills in 2026

> **→ Implement (free-first)**
>
> 1. **Determine your risk tier first** — most startups fall into Limited-risk (chatbots) or Minimal-risk. High-risk classification usually only applies if your AI makes consequential decisions about people (hiring, credit, healthcare).
> 2. **Minimal-risk / Limited-risk day-1 action:** Add a clear "This response is generated by AI" disclosure to any AI-generated output shown to users. This is a legal requirement, not just best practice.
> 3. **NIST AI RMF self-assessment** (free) — [nist.gov/artificial-intelligence](https://www.nist.gov/artificial-intelligence) provides a free framework and playbook. Complete this before pursuing enterprise or government contracts.
> 4. **For high-risk AI:** Start documenting your data governance, model cards, and testing methodology now in your repo. Tools like **Model Cards Toolkit** (Google, free OSS) and **Hugging Face Model Cards** help structure this.

---

### 2.3 Accessibility

#### WCAG 2.1 Level AA (ADA / Section 508 / EAA)
- US ADA Title II: mandatory for state/local government sites (deadline extended to Apr 2027–2028)
- European Accessibility Act (EAA): mandatory for private-sector apps/services in EU by Jun 2025 (already in effect)
- WCAG 2.1 Level AA is the minimum standard everywhere

**POUR Principles**:
- **Perceivable**: All non-text content has alt text; captions for audio/video; sufficient color contrast (4.5:1)
- **Operable**: Full keyboard navigation; no keyboard traps; skip links; no seizure-triggering content
- **Understandable**: Consistent navigation; clear error messages; language declared in HTML
- **Robust**: Valid HTML; ARIA roles used correctly; works with assistive technologies

**Practical note**: Automated scans (axe, Lighthouse) catch ~30–40% of issues; manual testing + screen reader testing required for the rest.

> **→ Implement (free-first)**
>
> **Automated testing (free):**
> 1. **axe-core** (open-source, zero false positives) — add to your test suite: `npm install --save-dev axe-core jest-axe`. Catches ~30% of WCAG issues automatically on every CI run.
>    ```bash
>    npm install --save-dev axe-core jest-axe @axe-core/playwright
>    ```
> 2. **Lighthouse** (built into Chrome DevTools, free) — run `Accessibility` audit on every page; score of 100 is the target. Also available as a CLI: `npm install -g lighthouse`.
> 3. **pa11y** (free CLI) — quick page-level WCAG 2.1 AA audit: `npx pa11y https://yourapp.com`
>
> **Manual testing (free):**
> - **NVDA** (Windows, free screen reader) and **VoiceOver** (macOS, built-in) — test keyboard nav and screen reader flow monthly.
> - **WebAIM Color Contrast Checker** (free web tool) — check all color combinations.
>
> **Paid options (when you need a full audit or legal coverage):**
> - **axe DevTools Pro** ($40/dev/month) — includes guided manual testing workflow and remediation guides.
> - **AudioEye** ($49/month) — SaaS overlay with AI-assisted auto-remediation; no code changes needed. Good for teams without dedicated frontend capacity.
>
> **Easiest path to compliance:** Use an accessible component library (see Section 2.3.1 below) so ARIA roles and keyboard nav are built in from day 1, then add axe-core to your CI pipeline.

---

### 2.3.1 Accessible UI Component Libraries & Dependency Maintenance

Building on top of an accessible component library means you inherit WCAG-compliant ARIA roles, keyboard navigation, and focus management without writing it from scratch.

#### Free, Accessible Component Libraries

| Library | Stack | Accessibility Approach | Install |
|---|---|---|---|
| **shadcn/ui** | React + Tailwind | Built on Radix UI primitives; copy-paste components into your repo | `npx shadcn@latest init` |
| **Radix UI** | React | Unstyled accessible primitives; full keyboard nav + ARIA out of the box | `npm install @radix-ui/react-dialog` (per component) |
| **Headless UI** | React / Vue | By Tailwind Labs; unstyled, fully accessible | `npm install @headlessui/react` |
| **React Aria** | React | By Adobe; enterprise-grade accessibility; handles complex interactions (date pickers, comboboxes) | `npm install react-aria react-stately` |
| **Ariakit** | React | Accessible component system with composable primitives | `npm install @ariakit/react` |
| **Chakra UI** | React | Accessible by default with theming; heavier bundle than Radix | `npm install @chakra-ui/react` |
| **Mantine** | React | Full-featured components, accessible, built-in dark mode | `npm install @mantine/core @mantine/hooks` |

**Recommendation for most teams:** Start with **shadcn/ui** (components are copied directly into your codebase — no black-box dependency, fully customizable) or **Radix UI** (primitives only, bring your own styles).

**For complex data grids / tables:**
- **TanStack Table** (free, headless) — `npm install @tanstack/react-table`
- **AG Grid Community** (free tier) — `npm install ag-grid-react`

**For date pickers (notoriously complex for accessibility):**
- **React Aria DatePicker** (free) — most accessible date picker available
- **react-day-picker** (free) — simpler API, reasonable accessibility

#### How to Cleanly Maintain UI Dependencies

**The problem:** UI libraries update frequently; major versions break APIs; security patches need fast adoption; unused packages accumulate.

**Automated update strategy (free):**

1. **Renovate Bot** (free, open-source by Mend) — the best automated dependency management tool. Smarter than Dependabot: groups related updates, understands monorepos, respects semantic versioning, and auto-merges patch/minor updates.
   - Install: add a `renovate.json` to your repo root, then install via [GitHub App](https://github.com/apps/renovate) (free).
   - Minimal config:
     ```json
     {
       "$schema": "https://docs.renovatebot.com/renovate-schema.json",
       "extends": ["config:recommended"],
       "packageRules": [
         {
           "matchUpdateTypes": ["patch", "minor"],
           "automerge": true
         }
       ]
     }
     ```
   - Renovate will open grouped PRs for `@radix-ui/*`, `@mantine/*`, etc. rather than one PR per package.

2. **GitHub Dependabot** (free, built into GitHub) — simpler than Renovate; good fallback. Enable in `.github/dependabot.yml`:
   ```yaml
   version: 2
   updates:
     - package-ecosystem: "npm"
       directory: "/"
       schedule:
         interval: "weekly"
       groups:
         radix-ui:
           patterns: ["@radix-ui/*"]
         mantine:
           patterns: ["@mantine/*"]
   ```

**Manual hygiene (weekly / before releases):**
```bash
# See what's outdated
npm outdated

# Check for vulnerabilities
npm audit

# Auto-fix non-breaking security issues
npm audit fix

# Interactive upgrade (choose what to bump)
npx npm-check-updates -i
```

**Lock file discipline:**
- Always commit `package-lock.json` or `yarn.lock` / `pnpm-lock.yaml`
- Never delete and regenerate your lock file during a PR — it hides dependency changes
- Use `npm ci` in CI (not `npm install`) — installs exactly what's in the lock file

**Removing unused packages:**
```bash
npx depcheck
```
`depcheck` lists packages in `package.json` that are not imported anywhere. Run before each major release.

**Tracking breaking changes:**
- Subscribe to release notes on GitHub for your core UI library (shadcn/ui, Radix, etc.)
- shadcn/ui has a changelog at [ui.shadcn.com/changelog](https://ui.shadcn.com/changelog)
- For Radix UI: check individual package changelogs at [radix-ui.com/primitives/docs/overview/releases](https://www.radix-ui.com/primitives/docs/overview/releases)

---

### 2.4 Legal Documents Every App Needs

| Document | What It Covers | When Required |
|---|---|---|
| **Privacy Policy** | Data collection, use, sharing, retention, user rights, contact | Required by GDPR, CCPA, most app stores, virtually every jurisdiction |
| **Terms of Service / EULA** | Acceptable use, IP rights, liability limits, dispute resolution, account termination | Legally required if you want to enforce your rules; required by app stores |
| **Cookie Banner / Consent Management** | Opt-in consent for non-essential cookies (GDPR), opt-out for US | Required for EU users (GDPR, ePrivacy Directive); opt-out mechanism for US |
| **Data Processing Agreement (DPA)** | Controller–processor responsibilities | Required by GDPR for every vendor that processes user data |
| **Business Associate Agreement (BAA)** | PHI handling obligations | Required by HIPAA for vendors touching health data |
| **Acceptable Use Policy (AUP)** | What users can't do with your platform | Best practice; required for enterprise contracts |

**Privacy policy must disclose in 2026**:
- Categories of data collected and methods (forms, cookies, tracking pixels, APIs)
- Purpose and legal basis for processing
- Third-party recipients and links to their policies
- Data retention periods
- AI/automated decision-making (mandatory disclosure now in most jurisdictions)
- User rights and how to exercise them
- Contact details (DPO email if applicable)
- Last updated date; review at least annually

> **→ Implement (free-first)**
>
> 1. Generate Privacy Policy + ToS with **Termly** (free tier). Takes 20 minutes via questionnaire. Link to them in your app footer, sign-up page, and app store listing.
> 2. Set a calendar reminder to review annually (or when you add a new data category or vendor).
> 3. When a vendor (e.g., Stripe, Mixpanel, OpenAI) processes user data on your behalf, request or sign their DPA. Most major vendors have a self-serve DPA signing process in their dashboard or legal portal.
> 4. For GDPR DPAs with your own downstream clients: use the **European Commission's Standard Contractual Clauses** (free template from [ec.europa.eu](https://commission.europa.eu/law/law-topic/data-protection_en)) as the base.

---

## 3. Technical Security Measures

### 3.1 Authentication & Access Control
- **Multi-Factor Authentication (MFA)**: Mandatory for admin/privileged accounts; strongly recommended for all users
- **Password policies**: Minimum 12 chars; check against breached password databases (HaveIBeenPwned API); no periodic forced rotation (NIST 800-63B)
- **OAuth 2.0 / OIDC**: Use standards-based auth; don't roll your own
- **RBAC / ABAC**: Role-based or attribute-based access control; principle of least privilege everywhere
- **Session management**: Short-lived tokens; invalidate on logout; Secure + HttpOnly + SameSite cookie flags
- **Privileged Access Management (PAM)**: Separate credentials for prod systems; just-in-time access

> **→ Implement (free-first)**
>
> **Never build auth from scratch.** Use a managed provider.
>
> **Free tier options:**
> 1. **Clerk** (free up to 10K MAU) — best developer experience for React/Next.js. Pre-built `<SignIn>`, `<SignUp>`, and `<UserButton>` components. MFA, social login, magic links included.
>    ```bash
>    npm install @clerk/nextjs
>    ```
>    Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to your secrets manager. Wrap your app in `<ClerkProvider>`. Done in under an hour.
>
> 2. **Supabase Auth** (free up to 50K MAU) — best if you're using Supabase for Postgres. Row Level Security integrates natively with auth. `npm install @supabase/supabase-js`
>
> **When you need enterprise SSO / SAML (paid):**
> - **WorkOS** ($125/connection/month) — purpose-built for enterprise SAML, SCIM directory sync. Required for closing deals with large companies that mandate SSO.
> - **Auth0** ($0.07/MAU) — most compliance certifications (HIPAA, FedRAMP); use when healthcare or government contracts are in scope.
>
> **HaveIBeenPwned password check (free API):**
> ```js
> // Check password against breached databases on signup
> import { pwnedPassword } from 'hibp';
> const count = await pwnedPassword(plaintextPassword);
> if (count > 0) throw new Error('Password found in data breach');
> ```

---

### 3.2 Encryption
- **In transit**: TLS 1.2 minimum, TLS 1.3 preferred; HSTS; no mixed content
- **At rest**: AES-256 for databases and file storage; encrypt backups
- **Key management**: Use a KMS (AWS KMS, Google Cloud KMS, HashiCorp Vault); rotate keys; never hardcode secrets
- **Secrets management**: No secrets in code or env vars in plain text; use a secrets manager

> **→ Implement (free-first)**
>
> **TLS (free via your host/CDN):** Cloudflare's free tier handles TLS termination and auto-renewal. Alternatively, use **Let's Encrypt** (free) with `certbot` for self-managed servers.
>
> **Secrets management:**
> 1. **Doppler** (free tier, no user limit for small teams) — dashboard UI, CLI, and native CI/CD integrations. Syncs secrets to Vercel, Railway, GitHub Actions automatically.
>    ```bash
>    brew install dopplerhq/cli/doppler
>    doppler setup  # links your project
>    doppler run -- node server.js  # injects secrets as env vars
>    ```
> 2. **Infisical** (free cloud tier; fully self-hostable OSS) — open-source alternative to Doppler, supports dynamic secrets and secret rotation.
>    ```bash
>    npm install -g @infisical/cli
>    infisical init
>    infisical run -- npm start
>    ```
> 3. **AWS Secrets Manager** (~$0.40/secret/month) — good if you're AWS-native, but requires IAM setup. No free tier beyond the 30-day trial.
>
> **What not to do:**
> - Never commit `.env` files to git. Add `.env*` to `.gitignore` on day 1.
> - Never hardcode API keys, even in "private" repos. Use secret scanning (see 2.4) to catch accidents.
> - `process.env.MY_SECRET` in code is fine — the secret is injected at runtime by your secrets manager, never stored in the repo.

---

### 3.3 OWASP Top 10 Mitigations (2021, still current)

| Risk | Mitigation |
|---|---|
| Broken Access Control | Enforce server-side; deny by default; test every endpoint |
| Cryptographic Failures | TLS everywhere; use bcrypt/argon2 for passwords; don't use MD5/SHA-1 |
| Injection (SQL, LDAP, OS) | Parameterized queries; ORM; input validation; WAF |
| Insecure Design | Threat modeling; security design reviews; STRIDE |
| Security Misconfiguration | Hardened configs; disable default accounts; regular scanning |
| Vulnerable Components | SCA tools (Snyk, Dependabot); automated dependency updates |
| Auth Failures | MFA; account lockout; no credential stuffing |
| Software & Data Integrity | Code signing; verified CI/CD pipelines; SBOMs |
| Security Logging & Monitoring Failures | Centralized logging; alerts on anomalies; retention policies |
| SSRF | Validate/restrict outbound requests; network segmentation |

> **→ Implement (free-first)**
>
> **Password hashing (free library):**
> ```bash
> npm install argon2   # preferred (argon2id)
> # or
> npm install bcrypt   # widely used, acceptable
> ```
>
> **SQL injection prevention (free — use your ORM's built-in parameterization):**
> ```js
> // WRONG — never do this
> db.query(`SELECT * FROM users WHERE id = ${userId}`);
>
> // RIGHT — parameterized query
> db.query('SELECT * FROM users WHERE id = $1', [userId]);
>
> // RIGHT — ORM (Prisma, Drizzle, TypeORM all do this automatically)
> prisma.user.findUnique({ where: { id: userId } });
> ```
>
> **Rate limiting + account lockout (free libraries):**
> ```bash
> npm install express-rate-limit  # for Express APIs
> npm install @upstash/ratelimit  # for edge/serverless (free Upstash Redis tier)
> ```
>
> **SSRF protection — restrict outbound fetches:**
> ```bash
> npm install ssrf-req-filter  # drop-in fetch wrapper that blocks private IPs
> ```

---

### 3.4 Secure Software Development Lifecycle (SSDLC)
- **Design phase**: Threat modeling (STRIDE/DREAD/PASTA); security requirements defined upfront
- **Development**: Secure coding guidelines; peer code reviews; no secrets in source control
- **Testing**: SAST (Semgrep, CodeQL, Checkmarx); DAST (OWASP ZAP, Burp Suite); dependency scanning (SCA); secret scanning (GitGuardian, TruffleHog)
- **Pre-release**: Penetration testing (at least annually; before major releases); vulnerability remediation SLAs
- **Post-release**: Vulnerability disclosure program / bug bounty; patch management process

> **→ Implement (free-first)**
>
> **SAST — Static code analysis (free):**
> 1. **Semgrep OSS** (free) — fastest SAST with community rule sets covering OWASP Top 10. Add to CI in minutes:
>    ```yaml
>    # .github/workflows/semgrep.yml
>    - uses: semgrep/semgrep-action@v1
>      with:
>        config: "p/default p/owasp-top-ten p/nodejs"
>    ```
> 2. **GitHub CodeQL** (free for all repos) — deep semantic analysis. Enable in GitHub repo Settings → Code Security → Code scanning. Or add `.github/workflows/codeql.yml`.
>
> **Dependency scanning (free):**
> - **GitHub Dependabot** — enable in repo Settings → Security. Sends PRs for vulnerable dependencies automatically. Zero configuration.
> - **`npm audit`** — run in CI: `npm audit --audit-level=high` fails the build on high/critical vulnerabilities.
>
> **Secret scanning (free):**
> - **GitHub Secret Scanning** (free for all repos) — detects committed API keys, tokens, and credentials. Enable in repo Settings → Security.
> - **TruffleHog** (free OSS) — pre-commit hook to prevent secrets reaching the repo:
>    ```bash
>    pip install trufflehog
>    trufflehog git file://. --only-verified
>    ```
>
> **DAST — Dynamic testing (free):**
> - **OWASP ZAP** (free) — run against your staging environment: `docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://staging.yourapp.com`
>
> **Pen testing (paid, defer until pre-launch or first enterprise customer):**
> - **Oneleet** ($15K–30K/year, bundled with SOC 2) — YC's most popular; pen test included in compliance platform subscription.
> - **Cobalt PTaaS** — standalone pen test without SOC 2 subscription; custom pricing.

---

### 3.5 Infrastructure & Cloud Security
- **Network segmentation**: VPCs; private subnets for databases; no direct internet access to backend services
- **Firewall / WAF**: Web Application Firewall for public-facing apps; DDoS protection (Cloudflare, AWS Shield)
- **Container security**: Scan images (Trivy, Snyk); no root in containers; read-only filesystems where possible; signed images
- **Cloud hardening**: CIS Benchmarks for your cloud provider; disable unused services; MFA on cloud accounts; SCPs/IAM guardrails
- **Patch management**: Critical patches: 24–72h; high: 7 days; medium: 30 days
- **Backup & recovery**: Automated backups; tested restore procedures; off-site/cross-region copies; defined RPO/RTO

> **→ Implement (free-first)**
>
> **WAF + DDoS (free):**
> - **Cloudflare Free** — point your DNS to Cloudflare. Unmetered DDoS protection and basic WAF rules are included on the free plan. Upgrade to Pro ($20/month) for advanced WAF rules and bot management.
>
> **Container scanning (free):**
> 1. **Trivy** (free OSS) — single binary, scans images, filesystems, IaC, and secrets:
>    ```bash
>    # Install
>    brew install trivy
>
>    # Scan a local image before pushing
>    trivy image myapp:latest
>
>    # In CI (GitHub Actions)
>    - uses: aquasecurity/trivy-action@master
>      with:
>        image-ref: 'myapp:latest'
>        severity: 'CRITICAL,HIGH'
>        exit-code: '1'
>    ```
> 2. **Snyk Container** ($25/dev/month) — adds base image upgrade recommendations and auto-fix PRs on top of Trivy-level scanning.
>
> **Dockerfile hardening (free, just follow these rules):**
> ```dockerfile
> # Run as non-root
> RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
> USER appuser
>
> # Use specific digest tags, not :latest
> FROM node:20.11.0-alpine3.19@sha256:<digest>
>
> # Don't copy .env or secrets into the image
> COPY --chown=appuser:appgroup . .
> ```
>
> **Cloud IAM (free — just policy discipline):**
> - Every service account gets only the permissions it needs (principle of least privilege).
> - Never use root/admin credentials in CI. Create dedicated IAM roles with scoped permissions.
> - Enable MFA on all cloud console accounts, especially root.

---

### 3.6 Security Monitoring & Detection
- **Centralized logging**: Aggregate app, infra, and security logs (SIEM — Splunk, Elastic, Datadog)
- **Log retention**: 12 months minimum (SOC 2 / ISO 27001 requirement; some regulations require longer)
- **Alerting**: Anomaly detection; failed login spikes; privilege escalation; data exfiltration patterns
- **Endpoint detection**: EDR on all endpoints (CrowdStrike, SentinelOne)
- **Vulnerability scanning**: Continuous scanning of infra and containers; tracked in a vulnerability register

> **→ Implement (free-first)**
>
> **Centralized logging:**
> 1. **Axiom** (free: 500 GB ingest/month, 30-day retention) — best free tier; SQL-like queries, dashboards, alerts. Integrates with Vercel, Cloudflare Workers, Next.js, OpenTelemetry.
>    ```bash
>    npm install @axiomhq/js
>    ```
>    ```js
>    import { Axiom } from '@axiomhq/js';
>    const axiom = new Axiom({ token: process.env.AXIOM_TOKEN });
>    axiom.ingest('my-dataset', [{ level: 'info', message: 'user logged in', userId }]);
>    ```
> 2. **Better Stack** (free: 3 GB logs + 10 uptime monitors + incident management) — combines log management + uptime monitoring + on-call alerts in one product. Good if you want simplicity over raw query power.
>
> **Paid options when you outgrow the free tier:**
> - **Axiom** paid ($25/month usage-based) — still cheap at moderate scale
> - **Datadog** ($0.10/compressed GB + indexing fees) — full observability but gets expensive fast; best when you need APM + SIEM together
>
> **Minimum alerts to set up from day 1 (free in any logging tool):**
> - 5+ failed logins for the same user in 5 minutes → alert
> - Any login from a new country → alert
> - Privilege escalation event (e.g., user assigned admin role) → alert
> - 500 error rate spikes above baseline → alert
> - Any access to secrets manager outside business hours → alert

---

### 3.7 Compliance Certifications (Trust Signals)

| Certification | What It Demonstrates | When to Pursue |
|---|---|---|
| **SOC 2 Type II** | Security controls operating effectively over 6–12 months | Required by most enterprise buyers; US-focused |
| **ISO 27001** | Formal ISMS with documented policies, risk treatment, and auditable continual improvement | Required for EU enterprise sales; globally recognized |
| **ISO 27701** | Privacy extension to ISO 27001 | Valuable if heavy personal data processing |
| **HIPAA attestation** | HIPAA safeguards in place | Required for healthcare customers |
| **PCI-DSS** | Payment card security controls | Required if processing payments directly |
| **CSA STAR** | Cloud security assurance | Useful for cloud-native SaaS |

> **→ Implement (cheapest path)**
>
> **Defer SOC 2 until a prospect asks for it.** Pursuing it before you need it burns $7.5K–15K/year for no immediate revenue return. The right trigger is: "We can't sign a contract until you have a SOC 2 report."
>
> **When you're ready, use a compliance automation platform — don't do it manually:**
> 1. **Vanta** ($12K+/year) — best balance of integrations (200+) and usability; fastest path to Type I. Connects to AWS, GitHub, Okta, Slack via OAuth.
> 2. **Oneleet** ($15K–30K/year) — bundles SOC 2 + pen testing + vCISO in one subscription. Best value if you need pen testing anyway. YC's most popular compliance platform.
> 3. **Drata** ($7.5K+/year) — best for multi-framework (SOC 2 + ISO 27001 + HIPAA simultaneously); good white-glove onboarding.
> 4. **Secureframe** ($7.5K+/year) — strong UX; good for SOC 2 Type I as a first milestone.
>
> **Typical timeline with automation tools:**
> - SOC 2 Type I: 4–8 weeks (point-in-time snapshot of controls)
> - SOC 2 Type II: 6–12 months observation period after Type I (controls must operate continuously)

---

## 4. Risk Management

### 4.1 Risk Management Framework

Use a structured framework rather than ad hoc responses. NIST RMF and ISO 31000 are the most widely adopted.

**Core cycle (ISO 31000)**:
1. **Identify** — catalog assets, threats, and vulnerabilities (risk register)
2. **Analyze** — likelihood × impact scoring (qualitative or quantitative)
3. **Evaluate** — prioritize against risk appetite/tolerance thresholds
4. **Treat** — mitigate, accept, transfer (insurance), or avoid
5. **Monitor & Review** — continuous; reassess when environment changes
6. **Communicate** — report to stakeholders; board-level risk reporting

**Risk register essentials**: Risk ID, description, category (security/legal/operational/reputational), likelihood (1–5), impact (1–5), risk score, owner, current controls, treatment plan, residual risk, review date.

> **→ Implement (free-first)**
>
> A risk register is a spreadsheet, not a tool purchase. Start with a Google Sheet or Notion table. Columns: Risk ID, Description, Category, Likelihood (1–5), Impact (1–5), Score (L×I), Owner, Current Controls, Treatment, Residual Risk, Review Date.
>
> Review it quarterly. When SOC 2 becomes relevant, your compliance automation platform (Vanta, Drata) will manage this for you.

---

### 4.2 Privacy Risk Assessments (DPIAs / PIAs)
- Required by GDPR (Article 35) for high-risk processing
- Required by CCPA for certain data uses (attestation due 2028)
- Mandatory under EU AI Act for high-risk AI using personal data
- Conduct before launching any new feature that: processes sensitive data, uses profiling/AI, involves large-scale processing, or monitors individuals systematically
- Document: purpose, necessity, proportionality, risks to individuals, mitigation measures, sign-off

> **→ Implement (free-first)**
>
> The ICO (UK Information Commissioner's Office) provides a **free DPIA template** and screening checklist: [ico.org.uk/for-organisations/guidance-on-key-data-protection-themes/guidance-on-dpia](https://ico.org.uk/for-organisations/guidance-on-key-data-protection-themes/guidance-on-dpia/)
>
> For day-1 teams: complete a DPIA as a markdown doc in your repo before launching any AI feature or feature that processes sensitive user data. Lightweight — takes 2–4 hours — and satisfies the GDPR documentation requirement.

---

### 4.3 Third-Party / Vendor Risk Management
- Maintain a vendor inventory with data access classification
- Conduct security questionnaires before onboarding (SIG Lite, CAIQ, or custom)
- Require SOC 2 / ISO 27001 reports from vendors with access to sensitive data
- Review vendor sub-processors (critical for GDPR compliance)
- Include security and data protection requirements in contracts
- Continuously monitor: vendor security ratings (SecurityScorecard, BitSight); breach news alerts
- Offboarding: revoke access, confirm data deletion, retrieve assets

> **→ Implement (free-first)**
>
> 1. **Vendor inventory** — a Google Sheet is sufficient. Columns: Vendor, Data accessed (PII / financial / none), SOC 2 available (Y/N), DPA signed (Y/N), Last reviewed.
> 2. Before adding a new SaaS vendor, check: (a) Do they have a SOC 2 Type II report? (b) Is their DPA available on their site? Most major vendors (AWS, Stripe, OpenAI, Twilio, Vercel) publish DPAs in their legal portals.
> 3. **Google Alerts** (free) — set alerts for `"[vendor name]" + "data breach"` to get notified of incidents affecting your vendors.
> 4. When you outgrow manual tracking, **Osano Vendor Risk** or **SecurityScorecard** automate continuous monitoring.

---

### 4.4 Incident Response Plan

Every software product needs a documented IRP before an incident happens.

**Phases (NIST 800-61r2)**:
1. **Preparation** — tools, playbooks, training, contact lists, communication templates
2. **Detection & Analysis** — identify, classify severity, preserve evidence
3. **Containment** — short-term (isolate); long-term (patch/remediate)
4. **Eradication** — remove malware/unauthorized access; patch root cause
5. **Recovery** — restore systems; verify clean state; monitor for reoccurrence
6. **Post-incident review** — root cause analysis; lessons learned; update controls

**Breach Notification Timelines (2026)**:

| Regulation | Notification Deadline |
|---|---|
| GDPR | 72 hours to supervisory authority; "without undue delay" to affected users if high risk |
| HIPAA | 60 days to HHS; 60 days to individuals; 60 days to media if >500 in a state |
| CCPA / US State Laws | 24–72 hour requirements now exist in 24+ US states |
| CIRCIA (US critical infrastructure) | 72-hour report to CISA; 24-hour for ransomware payments |
| SEC Reg S-P | Written IRP required; customer notification; compliance by Jun 2026 |

**IRP must include**:
- Severity classification matrix
- Roles and responsibilities (Incident Commander, Legal, PR, Engineering)
- Communication templates (internal, customer-facing, regulatory)
- Evidence preservation procedures (chain of custody)
- Jurisdiction-specific notification checklists

> **→ Implement (free-first)**
>
> **Day 1: A markdown file in your repo.** An IRP does not require a tool. Start with a `INCIDENT_RESPONSE.md` in your repository root. Minimum content:
> - Severity levels (P0–P3) and what triggers each
> - Who is the on-call engineer and how to reach them
> - Escalation chain (engineering → CTO → legal → CEO)
> - Customer notification template
> - Breach regulator notification checklist (GDPR 72h, etc.)
>
> **Free status page:** **instatus.com** (free for 1 status page, 3 components) or **Statuspage.io** (free developer plan) — gives customers visibility during incidents.
>
> **When the team grows (paid):**
> - **Incident.io** (~$310/month for 10 engineers) — Slack-native; incident timelines, runbooks, retrospectives, on-call scheduling, and status pages in one product.
> - **Rootly** (similar pricing) — best for complex conditional workflow automation per incident type.
> - **Avoid PagerDuty** for small teams — pricing (~$41/user/month on Business) makes it $24K+/year for a 50-person org before add-ons.
> - **Avoid Opsgenie** — being sunset April 5, 2027.

---

### 4.5 Business Continuity & Disaster Recovery (BCP/DR)
- Define RPO (Recovery Point Objective) and RTO (Recovery Time Objective) per service tier
- Automated backups with tested restore procedures (test at least quarterly)
- Multi-region or multi-AZ deployments for high-availability requirements
- Failover runbooks; game day exercises (simulated outages)
- Dependency mapping: know your single points of failure

> **→ Implement (free-first)**
>
> Most managed databases (Supabase, Neon, PlanetScale, RDS, Firestore) include automated backups at no extra cost. Enable them on day 1. Verify that your retention period is at least 7 days (30 days for compliance).
>
> Document your RPO and RTO in your IRP/runbook, even if the answer is "24 hours / 4 hours" for an early-stage product. Knowing the number forces you to verify your backup restore actually works.

---

### 4.6 Data Governance
- **Data classification**: Public / Internal / Confidential / Restricted — governs handling, access, and retention
- **Data inventory / mapping**: Know what data you hold, where it lives, who can access it, why you have it
- **Retention & deletion policies**: Define retention periods per data type; automated deletion schedules; honor deletion requests (GDPR Art. 17, CCPA)
- **Data minimization**: Only collect what you need; don't retain beyond need — both a GDPR requirement and a risk reduction strategy
- **Audit trails**: Immutable logs of who accessed/changed sensitive data; required for SOC 2, ISO 27001, HIPAA

> **→ Implement (free-first)**
>
> 1. **Data inventory = a Google Sheet.** Columns: Data type, Location (DB table/S3 bucket), Who can access, Why collected, Retention period, Deletion mechanism.
> 2. **Soft deletes** in your ORM — never hard-delete user data immediately; mark as `deleted_at` and run a scheduled job to purge after the retention period. This satisfies both GDPR right-to-erasure and your own data lifecycle policy.
> 3. **Audit log table** — add a simple `audit_logs` table (entity_type, entity_id, action, actor_id, timestamp) to your database from day 1. Cheap to add early, expensive to retrofit.

---

## 5. AI Agent vs Human Responsibility Matrix

This app is being built primarily by AI agents. This section defines who is accountable for what — so nothing falls through the cracks between "the AI will handle it" and "someone will handle it."

The rule of thumb: **AI automates the detection and the draft; humans own the decision and the signature.**

---

### 5.1 What AI Agents Can Automate

| Category | Task | Tool / Method |
|---|---|---|
| **Code generation** | Write features, tests, migrations, CI pipelines | Claude Code, Copilot, Cursor |
| **SAST** | Static security scanning on every PR | Semgrep OSS, GitHub CodeQL |
| **Secret scanning** | Detect committed API keys and credentials | GitHub Secret Scanning, TruffleHog |
| **Dependency updates** | Open PRs for vulnerable/outdated packages | Renovate Bot, Dependabot |
| **Dependency auditing** | Fail CI on high/critical vulnerabilities | `pnpm audit --audit-level=high` in CI |
| **SBOM generation** | Generate and scan software bill of materials | Syft + Grype in CI |
| **License scanning** | Block non-approved licenses from entering the repo | `license-checker` in CI |
| **Container scanning** | Scan Docker images before push to registry | Trivy in CI (GitHub Actions) |
| **DAST** | Dynamic security scan against staging environment | OWASP ZAP (scheduled weekly) |
| **Accessibility testing** | Automated WCAG 2.1 AA checks in CI | axe-core + Playwright, Lighthouse CI |
| **Performance regression** | Block PRs that regress Core Web Vitals | Lighthouse CI assertions |
| **Error monitoring** | Capture, group, and alert on exceptions automatically | Sentry (auto-instrumentation) |
| **Uptime monitoring** | Alert on downtime or elevated latency | BetterStack or UptimeRobot |
| **Security alerting** | Alert on failed login spikes, privilege escalation | Axiom alert rules |
| **UGC content moderation** | Auto-flag spam, profanity, and NSFW images | OpenAI Moderation API, AWS Rekognition |
| **Fake review detection** | Pattern-detect coordinated review bombing | ML classifier on review velocity, IP clustering, text similarity |
| **Restaurant data validation** | Detect stale hours, duplicate listings, missing required fields | Scheduled validation job |
| **Ranking calculation** | Compute and update restaurant scores | Automated ranking pipeline (cron) |
| **Privacy policy drafting** | Generate initial policy draft from a data-practice questionnaire | Termly (requires human review before publish) |
| **Changelog / release notes** | Generate from conventional commit history | `release-please` or Changesets |
| **ADR drafting** | Draft Architecture Decision Records from design context | AI agent (requires human sign-off before status = Accepted) |

---

### 5.2 What Humans Must Do Manually

These tasks cannot be delegated to AI — they require legal authority, accountability, judgment about risk appetite, or verified human identity.

| Category | Task | Why Human Required |
|---|---|---|
| **Legal sign-off** | Review and approve Privacy Policy, ToS, and AUP before publish | Legal accuracy and liability — a wrong clause creates real exposure |
| **DPA signing** | Sign Data Processing Agreements with vendors | Contractual obligation; requires a person with authority to bind the company |
| **Vendor security review** | Evaluate new vendors before onboarding | Requires judgment about business relationship and risk tolerance |
| **NDB notification** | Notify OAIC and affected individuals after a qualifying breach | Regulatory obligation; notification must be signed by a responsible officer |
| **DPIA sign-off** | Approve Data Protection Impact Assessments | GDPR Art. 35 requires documented human approval |
| **Risk register review** | Quarterly review and risk treatment decisions | Risk appetite is a business decision — cannot be delegated |
| **Incident commander** | Lead P0/P1 incident response | Requires authority to take action: take systems offline, notify customers, engage PR |
| **Regulatory correspondence** | Respond to OAIC, ACCC, or court requests | Requires legal representation; auto-responses to regulators create liability |
| **Content moderation escalations** | Final rulings on borderline or legally risky content | Defamation risk, legal threats, and cultural nuance require human judgment |
| **Restaurant dispute resolution** | Respond when a restaurant disputes a review, ranking, or listing decision | Relationship management + legal risk of getting it wrong |
| **App store submissions** | Submit builds and respond to App Store reviewer feedback | Requires a verified human Apple/Google developer account |
| **Pen test engagement** | Scope, hire, and brief penetration testers; review findings report | Requires human judgment on scope and remediation priority |
| **SOC 2 / ISO 27001** | Engage audit firm, respond to evidence requests, sign management assertion | Requires authority, legal knowledge, and personal accountability |
| **Security awareness training** | Deliver and track completion of mandatory security training | Requires human participation and acknowledgement |
| **Board-level risk reporting** | Present risk posture and treatment decisions to stakeholders | Requires personal accountability and authority |
| **Payment provider KYC** | Complete Stripe/Adyen business verification and identity checks | Identity verification requires real, named persons |
| **Emergency change approval** | Authorise a hotfix that bypasses the standard code review process | Requires a named accountable person; must be documented |
| **DPO appointment** | Appoint a Data Protection Officer if GDPR requires it | A legal role with statutory obligations — cannot be filled by an AI agent |

---

### 5.3 Hybrid Tasks (AI Assists, Human Approves)

| Task | What AI Does | What Human Does |
|---|---|---|
| **Threat modeling** | Generates a STRIDE threat list from the architecture diagram or PRD | Reviews the list, adds business context and attack scenarios, signs off |
| **DPIA** | Drafts the privacy risk assessment for a new AI feature or data flow | Reviews accuracy, adds risk treatment decisions, formally approves |
| **Privacy policy updates** | Flags new data categories introduced by new features or SDKs | Reviews, updates the published policy, communicates changes to users |
| **Vulnerability remediation** | Proposes fix code for a detected CVE or SAST finding | Reviews the fix for correctness and unintended side effects, approves merge |
| **Incident post-mortem** | Drafts the root cause analysis and action item list from logs | Reviews facts for accuracy, approves publication, owns follow-through |
| **ADR writing** | Drafts the decision record from context in the codebase and PR | Reviews, edits for accuracy, commits the record with status = Accepted |
| **Accessibility remediation** | Generates a code fix for an axe-core or Lighthouse flagged issue | Tests the fix with a real screen reader before merging |
| **Content policy updates** | Identifies emerging abuse patterns in moderation queue | Reviews patterns, decides policy change, communicates update to users |
| **NDB assessment** | Analyses breach scope and affected data from logs | Makes the final call on whether the breach triggers notification obligations |

---

## 6. Operational Compliance

### 6.1 Policies & Documentation (required for SOC 2 / ISO 27001)
- Information Security Policy
- Acceptable Use Policy
- Access Control Policy
- Incident Response Policy
- Vulnerability Management Policy
- Change Management Policy
- Business Continuity / DR Policy
- Vendor Risk Management Policy
- Data Classification and Handling Policy
- Employee Security Awareness Training records

> **→ Implement (free-first)**
>
> **Free policy templates:** SANS Institute publishes free, attorney-reviewed policy templates at [sans.org/information-security-policy](https://www.sans.org/information-security-policy/). Download, customize for your company, and store in Notion or Google Drive.
>
> When you start a SOC 2 engagement, your compliance automation platform (Vanta, Drata) will generate all required policies automatically and track employee acknowledgement.

---

### 6.2 Security Awareness Training
- Annual training for all staff (SOC 2 / ISO 27001 requirement)
- Phishing simulation programs
- Role-specific training: developers → secure coding; finance → BEC/wire fraud; all → data handling
- Track completion; document for auditors

> **→ Implement (free-first)**
>
> 1. **Google's Phishing Quiz** (free) — [phishingquiz.withgoogle.com](https://phishingquiz.withgoogle.com) — run this with the team as a baseline.
> 2. **Cybrary** (free tier) — free security awareness courses covering phishing, password hygiene, and data handling.
> 3. **KnowBe4** (paid) — industry standard for phishing simulations; required by many enterprise auditors. Pricing from ~$20/user/year. Only necessary when SOC 2 Type II requires documented training records.

---

### 6.3 Change Management
- All production changes go through a review process (peer review, testing, approval)
- Separation of duties: developer who writes code shouldn't be the only approver
- Rollback plans for every deployment
- Emergency change process for critical security patches

> **→ Implement (free-first)**
>
> **GitHub branch protection rules (free):** Require at least 1 reviewer on every PR to `main`. Enable "Require status checks to pass before merging" (your CI must be green). These two rules satisfy most SOC 2 change management requirements at zero cost.
>
> Document your emergency change process in your runbook: a single paragraph saying "For critical security patches, the CTO can approve and merge directly; document in Slack and create a retroactive review issue within 24 hours."

---

### 6.4 Penetration Testing & Vulnerability Disclosure
- Annual pen test minimum; before major releases or significant architecture changes
- Use qualified testers (CREST, OSCP-certified, reputable firm)
- Vulnerability Disclosure Policy (VDP): a published channel for security researchers to report bugs
- Bug bounty program (HackerOne, Bugcrowd) for mature products

> **→ Implement (free-first)**
>
> **Vulnerability Disclosure Policy (free):** Add a `SECURITY.md` to your GitHub repo. GitHub will automatically show a "Report a vulnerability" button. Minimum content: email address for security reports, expected response time, what's in/out of scope.
>
> **Free VDP template:** [securitytxt.org](https://securitytxt.org) generates a `security.txt` file for your `.well-known/` directory, which is the standard way for researchers to find your disclosure policy.
>
> **Pen testing:** Start with OWASP ZAP (free DAST) against your staging environment. When you need a formal attestation for enterprise sales, use Oneleet (bundled with SOC 2) or Cobalt (standalone).

---

## 7. Compliance by Product Stage

### Early-Stage / MVP
**Minimum viable compliance ($0 tooling cost):**
- **AU Privacy Policy covering the 13 APPs** — use Termly or Iubenda with "Australia" jurisdiction selected (free)
- Privacy policy + Terms of Service via Termly (free)
- Cookie consent via CookieYes (free tier)
- TLS via Cloudflare (free) or Let's Encrypt
- No secrets in code — use Doppler or Infisical (free)
- OWASP Top 10 mitigations via Semgrep OSS + `npm audit` in CI (free)
- MFA on admin accounts — enforce in Clerk or Supabase Auth (free)
- `SECURITY.md` + `security.txt` for vulnerability disclosure (free)
- Basic IRP as a markdown file in repo, including **NDB notification runbook** (free)
- GDPR/CCPA basics: privacy policy + cookie consent covers most small-scale requirements
- **Restaurant data disclaimer** on all third-party data (hours, menus, health scores) — timestamp and link to source
- **UGC moderation** — OpenAI Moderation API auto-flagging + in-app "flag this review" button (required by app stores)
- **App store data disclosure forms** — Apple Privacy Nutrition Labels and Google Play Data Safety form completed before submission
- **Location data policy** — document in privacy policy: what you collect, when, retention period, and that precise GPS is not retained after session

### Growth Stage
Add:
- SOC 2 Type I (Vanta/Oneleet — first enterprise customer will demand it)
- Formal vulnerability management program
- Annual pen test (bundled with SOC 2 via Oneleet, or Cobalt standalone)
- DPAs signed with all vendors processing user data
- Data inventory and classification (start as a spreadsheet)
- Security awareness training program (Cybrary free, or KnowBe4 paid)
- Formal IRP with Incident.io or Rootly
- Centralized logging beyond free tier (Axiom paid or Datadog)
- **OAIC registration** once annual revenue crosses $3M AUD
- **NDB response runbook** reviewed and tested with a tabletop exercise
- **Spam Act consent records** — ensure all marketing email/push opt-in is logged with timestamp and mechanism

### Enterprise / Regulated
Add:
- SOC 2 Type II (6–12 month observation period)
- ISO 27001 certification (required for EU enterprise sales)
- Full DPIAs for high-risk features
- EU AI Act compliance program (if applicable)
- HIPAA / PCI-DSS if applicable vertical
- Third-party risk program (Osano Vendor Risk or SecurityScorecard)
- Board-level risk reporting
- DPO appointment (if GDPR requires)
- WCAG 2.1 AA accessibility audit (axe DevTools Pro or AudioEye)
- WorkOS for enterprise SSO/SAML

---

## 8. Key Principle: Privacy & Security by Design

The single most important meta-principle across all frameworks:

> **Build compliance in, don't bolt it on.**

- Conduct threat modeling and privacy impact assessments at design time, not after
- Default settings should be the most privacy-protective option (GDPR Art. 25)
- Data minimization from day one: if you don't collect it, you can't lose it or misuse it
- Security controls designed into architecture (zero-trust, least privilege) rather than perimeter-only defenses
- Audit trails and logging designed into the data model upfront

This reduces remediation cost by 6–100x compared to retrofitting, and is an explicit legal requirement under GDPR and the EU AI Act.

---

## 9. System Hygiene & App Setup: End-to-End Guide

> Must-haves, should-haves, and nice-to-haves for shipping a production-ready app from day 1. Free options listed first.

---

### 9.1 Project Structure & Monorepo

#### Must-Have
**Package manager: pnpm** — fastest installs, strict dependency isolation, disk-efficient. Lock in a version:
```json
"packageManager": "pnpm@9.x"
```

**`.node-version`** — commit a pinned Node version (works with `fnm` and `nvm`):
```
22.11.0
```

**`.editorconfig`** — consistent indentation/line endings across all editors:
```ini
root = true
[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

**`.gitattributes`** — prevents Windows CRLF line-ending corruption:
```
* text=auto eol=lf
*.png binary
*.jpg binary
```

**Recommended folder structure (full-stack TypeScript / Next.js):**
```
apps/
  web/          # Next.js app
  api/          # Separate API server (if needed)
packages/
  ui/           # Shared component library
  db/           # Prisma/Drizzle schema + migrations
  config/       # Shared ESLint, TS, Tailwind configs
  types/        # Shared TypeScript types
  utils/        # Shared utilities
docs/
  adr/          # Architecture Decision Records
```

#### Should-Have
**Turborepo + pnpm workspaces** — add when you have 3+ packages and build times are hurting. Enable remote caching immediately (teams report 70–90% CI time reduction):
```bash
npx create-turbo@latest
```

```json
// turbo.json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "test": { "dependsOn": ["^build"] },
    "lint": {}
  }
}
```

Remote cache: set `TURBO_TOKEN` + `TURBO_TEAM` env vars — Vercel provides this free.

#### Nice-to-Have
**Nx** — upgrade from Turborepo when you need enforced architectural boundaries between packages, code generators (`nx generate`), or distributed CI across multiple machines. Skip for small/medium teams.

---

### 9.2 Code Quality Tooling

#### Must-Have
**TypeScript strict mode** — enable from day 1; retrofitting `strict` into an existing codebase is painful:
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "skipLibCheck": true,
    "target": "ES2022",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "moduleDetection": "force",
    "isolatedModules": true
  }
}
```

`noUncheckedIndexedAccess` is the highest-value flag not included in `strict` — forces you to check `arr[0]` before using it.

**ESLint v9 flat config** — the `.eslintrc` format is deprecated. All new projects use `eslint.config.mjs`:
```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
    }
  },
  { ignores: ["dist/", "node_modules/", "**/*.d.ts"] }
]);
```

**Husky + lint-staged** — runs linting only on staged files, not the whole repo:
```bash
npm install -D husky lint-staged && npx husky init
```

`.husky/pre-commit`:
```sh
npx lint-staged
```

`package.json`:
```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix --cache", "prettier --write"],
  "*.{css,json,md}": ["prettier --write"]
}
```

**commitlint + conventional commits** — required if you use Changesets or semantic-release for releases:
```bash
npm install -D @commitlint/cli @commitlint/config-conventional
```

`commitlint.config.js`: `export default { extends: ["@commitlint/config-conventional"] };`

`.husky/commit-msg`: `npx --no -- commitlint --edit "$1"`

#### Should-Have
**Biome** — replaces Prettier (and many ESLint rules) with a single Rust binary that's 10–25× faster. 97% Prettier-compatible. Best for pure TypeScript/React/Next.js projects.
```bash
npx @biomejs/biome init
```
**Caveat:** Biome does not support `.vue`, `.svelte`, `.astro`, HTML, or SCSS — keep Prettier for those stacks.

#### Nice-to-Have
**Oxlint** — Rust-based ESLint replacement (50–100× faster). Not yet at ESLint ecosystem parity; worth watching for 2026.

---

### 9.3 Testing Strategy

#### Must-Have
**Vitest** — the 2025–2026 community default for unit/integration tests on any TypeScript project. Overtook Jest in developer satisfaction (State of JS 2024). Ships with TypeScript + ESM support; no `ts-jest` or Babel config needed.
```bash
npm install -D vitest @vitest/coverage-v8
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    coverage: { provider: "v8", thresholds: { lines: 70, branches: 70 } }
  }
});
```

**Realistic coverage targets:** 70% lines/branches is defensible for an MVP. 80% is good. 90%+ is usually gaming the metric — focus coverage on business logic, not UI glue.

**MSW v2 (Mock Service Worker)** — network-layer API mocking for tests. Define handlers once in `src/mocks/handlers.ts`; reuse across Vitest, browser dev, and Playwright:
```bash
npm install -D msw
```

#### Should-Have
**Playwright** — the clear 2025–2026 E2E winner over Cypress. Multi-browser (Chrome, Firefox, Safari/WebKit), native parallelism, 23–88% faster than Cypress in benchmarks. Free, MIT licensed.
```bash
npm init playwright@latest
```

Key patterns:
- Use `storageState` to persist login across tests — don't log in on every test
- Use `page.waitForResponse(...)` not `page.waitForTimeout(...)` — no arbitrary sleeps
- Shard with `--shard=1/4` in CI matrix to parallelize

**@testing-library/react** — for component tests. The `*ByRole` queries enforce accessible HTML as a side effect.

#### Nice-to-Have
**Vitest Browser Mode** — runs Vitest tests in a real browser via Playwright. Stable in Vitest 2.x; blurs the line between unit and E2E.

**Playwright Component Testing** — tests React/Vue components in a browser without full E2E setup. Still maturing.

---

### 9.4 CI/CD Pipelines

#### Must-Have
**GitHub Actions** — free: 2,000 min/month (private repos), unlimited for public. Standard in 2025.

**pnpm + Node.js caching:**
```yaml
- uses: pnpm/action-setup@v4
  with: { version: 9 }
- uses: actions/setup-node@v4
  with:
    node-version-file: ".node-version"
    cache: "pnpm"
- run: pnpm install --frozen-lockfile
```

**`--frozen-lockfile` is non-negotiable** — fails if `pnpm-lock.yaml` is out of sync with `package.json`. Prevents silent version drift between local and CI.

**OIDC for cloud credentials** — replace long-lived AWS/GCP secret keys with short-lived tokens:
```yaml
permissions:
  id-token: write
  contents: read
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::123456789:role/GitHubActions
    aws-region: us-east-1
```

**Database migrations in CI** — always use `prisma migrate deploy` (not `dev`) in CI/production. Use the expand/contract pattern for zero-downtime schema changes:
1. **Expand**: add new column (backward-compatible deploy)
2. Deploy code that writes to both old and new columns
3. Backfill data
4. **Contract**: drop old column in a later deploy — never in the same release as the app change

**`npm audit` / `pnpm audit` in CI:**
```yaml
- run: pnpm audit --audit-level=high
```

#### Should-Have
**Path filtering for monorepos** — only run jobs for changed packages:
```yaml
- uses: dorny/paths-filter@v3
  id: changes
  with:
    filters: |
      api: ['apps/api/**', 'packages/db/**']
      web: ['apps/web/**', 'packages/ui/**']
- if: steps.changes.outputs.api == 'true'
  run: pnpm --filter api test
```

**Preview environments (branch deploys):**

| Platform | Preview DB | Cost | Setup effort |
|---|---|---|---|
| Vercel | No (frontend only) | Free | Zero config |
| Railway | Yes — isolated DB per PR | $5/month min | Low |
| Fly.io | Manual setup | Pay-per-use | Medium |

**Deployment platform quick pick:**

| Need | Pick |
|---|---|
| Next.js frontend only | Vercel (free Hobby tier) |
| Full-stack + managed DB, simplest DX | Railway ($5+/month) |
| Lowest compute cost, multi-region | Fly.io |
| Predictable pricing | Render |

#### Nice-to-Have
**Turborepo remote cache in CI** — set `TURBO_TOKEN` + `TURBO_TEAM`; Vercel provides this free for Turborepo projects.

**Matrix builds** for multi-version Node.js testing:
```yaml
strategy:
  matrix:
    node-version: [20, 22]
```

---

### 9.5 Database Hygiene

#### Must-Have
**Connection pooling — always.** Direct connections to PostgreSQL exhaust the connection limit under real load.

- **Serverless (Next.js, Vercel, Cloudflare Workers):** Use **Neon** (HTTP-based pooling built in; free: 0.5 GB storage, 190 compute hours/month) or **Supabase Supavisor** (transaction mode).
- **Persistent backends (Railway, Fly.io):** PgBouncer in transaction mode. Set `default_pool_size = (CPU × 2) + spindles`. Note: transaction mode breaks `LISTEN/NOTIFY`, prepared statements, session-level `SET`, and advisory locks.

**ORM choice — Prisma vs Drizzle:**

| | Prisma | Drizzle |
|---|---|---|
| Schema | `.prisma` DSL (separate file) | TypeScript (co-located with code) |
| Type regeneration | Requires `prisma generate` | Instant — types are the schema |
| Bundle size | Larger (Prisma 7 now pure TS, improved) | Tiny — good for edge/serverless |
| Migration automation | Excellent — generates SQL diffs automatically | Manual validation required |
| Learning curve | Gentler | Steeper |
| **Pick if** | Team new to databases; want automation | Edge runtimes; want SQL-level control |

Avoid TypeORM (stagnant) and Sequelize (legacy).

**Soft deletes — use `deleted_at TIMESTAMPTZ`, not `is_deleted BOOLEAN`:**
```sql
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

-- Partial unique index: uniqueness only on active records
CREATE UNIQUE INDEX users_email_active ON users (email) WHERE deleted_at IS NULL;

-- RLS policy to auto-filter deleted rows
CREATE POLICY hide_deleted ON users USING (deleted_at IS NULL);
```

**Indexing hygiene:**
```sql
-- Enable slow query logging (add to postgresql.conf)
log_min_duration_statement = 500   -- log queries > 500ms

-- Find unused indexes (drop them — they slow writes)
SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;

-- Always use EXPLAIN (ANALYZE, BUFFERS) — not just EXPLAIN
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE user_id = $1;
```

Enable `pg_stat_statements` (ships with Postgres, free): `shared_preload_libraries = 'pg_stat_statements'`

#### Should-Have
**Point-in-time recovery (PITR):**
- Neon: PITR free up to 24h; paid plans extend to 7 days
- Supabase: daily backups free; PITR on Pro ($25/month)
- Self-hosted: WAL-G + S3 for continuous WAL archiving — `pg_dump` nightly is not sufficient for production

**Test your backups.** Restore to staging quarterly. Untested backups are not backups.

#### Nice-to-Have
**pgBadger** — parses PostgreSQL slow query logs into HTML reports. Free OSS. Run weekly.

---

### 9.6 Observability Stack

#### Must-Have
**OpenTelemetry (OTel)** — the vendor-neutral standard as of 2025. Instrument once, swap backends anytime.
```bash
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

`instrumentation.ts` (load before app startup via `--require` or `--import`):
```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

const sdk = new NodeSDK({ instrumentations: [getNodeAutoInstrumentations()] });
sdk.start();
```

Auto-instruments: HTTP, fetch, Express, Fastify, Prisma, pg, Redis, and 200+ more.

**Error tracking — Sentry** (free: 5,000 errors/month + 50 session replays):
```bash
npm install @sentry/nextjs && npx @sentry/wizard@latest -i nextjs
```

> **Note:** Highlight.io was acquired by LaunchDarkly (April 2025) and is shutting down February 28, 2026. Do not start new projects on it.

**Uptime monitoring:**
- **BetterStack** (free: 10 monitors, 3-min check interval, 1 status page)
- **UptimeRobot** (free: 50 monitors, 5-min check interval)

#### Should-Have
**Observability backend — Grafana Cloud free tier** (10K metric series, 50 GB logs, 50 GB traces): managed Prometheus + Loki (logs) + Tempo (traces) + Grafana frontend. Best free tier for a complete stack.

**Tracing backends:**

| Tool | Cost | Best for |
|---|---|---|
| Grafana Tempo | Free (via Grafana Cloud) | Teams already on Grafana stack |
| Jaeger | Free, self-hosted | Deep span-attribute searching; open-source teams |
| Honeycomb | Free: 20M events/month | Best DX; event-based rather than sample-based |

**Minimum alerts to configure from day 1 (free in any logging tool):**
- 5+ failed logins for the same account in 5 minutes
- Login from a new country/region
- Any admin privilege escalation event
- 500 error rate spike above baseline
- Any secrets manager access outside business hours

#### Nice-to-Have
**Real User Monitoring (RUM):**
- **Sentry Performance** — included in Sentry SDK, tracks Core Web Vitals per route
- **Grafana Faro** — open-source RUM agent, feeds into Grafana Cloud
- **Vercel Speed Insights** — free on Vercel; Core Web Vitals broken down per page

---

### 9.7 Performance

#### Must-Have
**Lighthouse CI in GitHub Actions** — catches regressions before merge:
```bash
npm install -g @lhci/cli
```

`.lighthouserc.json`:
```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["warn", {"minScore": 0.8}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}]
      }
    }
  }
}
```

Run against a production build (`pnpm build && pnpm start`), not the dev server.

**Bundle analysis — run before every release:**
- Next.js: `ANALYZE=true pnpm build` with `@next/bundle-analyzer`
- Vite: `rollup-plugin-visualizer`
- Look for: duplicate packages (lodash vs lodash-es), large transitive deps, un-tree-shaken imports

**Image optimization** — `next/image` is mandatory in Next.js. Never use raw `<img>` tags — `next/image` handles WebP/AVIF conversion, lazy loading, and layout shift prevention automatically.

#### Should-Have
**Cloudflare** in front of your origin — free CDN + caching for static assets and API responses. Not optional for global-user SaaS.

**Database query performance baseline:**
1. Enable `pg_stat_statements`
2. Set `log_min_duration_statement = 500`
3. Run `EXPLAIN (ANALYZE, BUFFERS)` on any query >100ms
4. Check for sequential scans on large tables: high `seq_scan` + `idx_scan = 0` → missing index

#### Nice-to-Have
**Cloudflare Image Resizing** ($5/month) — on-the-fly image transforms via URL params; replaces server-side Sharp for most use cases.

---

### 9.8 Developer Experience

#### Must-Have
**`.vscode/settings.json`** (commit this to the repo — applies to everyone):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

**`.vscode/extensions.json`** (prompts teammates to install):
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "ms-vscode.vscode-typescript-next",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

**`.vscode/launch.json`** for debugging:
```json
{
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

**Docker Compose for local services** — run Postgres + Redis locally without cloud accounts:
```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:17-alpine
    environment: { POSTGRES_USER: dev, POSTGRES_PASSWORD: dev, POSTGRES_DB: myapp }
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
volumes:
  postgres_data:
```

**`.env.example`** — committed to repo with all variable names, no values. **`.env.local`** — in `.gitignore`, never committed.

#### Should-Have
**`fnm` (Fast Node Manager)** instead of `nvm` — 40× faster, reads `.node-version` automatically on `cd`:
```bash
brew install fnm
# Add to shell profile:
eval "$(fnm env --use-on-cd)"
```

**Database GUI tools (free):**
- **Beekeeper Studio Community Edition** — best free GUI; Postgres/MySQL/SQLite; open source
- **pgAdmin 4** — free, powerful for advanced Postgres tasks; UI is clunky
- **TablePlus** — best UX but free tier limited to 2 connections

#### Nice-to-Have
**Cursor IDE** — VS Code fork with deep AI integration; 100% extension/settings/keybinding compatible. Migration from VS Code takes minutes. Growing rapidly in 2025–2026.

**LocalStack** — emulates AWS services (S3, SQS, DynamoDB, etc.) locally. Free tier covers most services. Avoids real AWS accounts for local development.

---

### 9.9 Documentation

#### Must-Have
**README minimum structure:**
```md
# Project Name
One-line description.

## Prerequisites
- Node 22.x (see .node-version)
- pnpm 9.x
- Docker (for local services)

## Quick Start
pnpm install
cp .env.example .env.local
docker-compose up -d
pnpm dev

## Architecture Overview
[One paragraph or link to docs/adr/]

## Common Tasks
- Run tests: `pnpm test`
- Add migration: `pnpm db:migrate`
- Build for production: `pnpm build`
```

**Architecture Decision Records (ADRs)** in `docs/adr/` — one file per decision, monotonically numbered:
```
docs/adr/
  0001-use-postgresql.md
  0002-adopt-opentelemetry.md
  0003-monorepo-with-turborepo.md
```

Template (Michael Nygard format — the standard):
```md
# ADR-0001: Use PostgreSQL as Primary Database

## Status
Accepted

## Context
[What forces this decision?]

## Decision
[What did we decide?]

## Consequences
[Trade-offs — positive and negative]
```

ADRs are append-only. When a decision changes, write a new ADR that supersedes the old one and link both.

#### Should-Have
**API documentation — generate from code, never write YAML by hand:**
- **tRPC + `trpc-openapi`** — generates OpenAPI spec from your router automatically
- **Zod + `zod-openapi`** — generates OpenAPI from your validation schemas
- **ts-rest** — contracts-first approach; generates client SDK + OpenAPI spec simultaneously

**Storybook 8** for component documentation — auto-generates prop docs, interactive controls, and usage examples:
```bash
npx storybook@latest init
```

#### Nice-to-Have
**`log4brains`** — CLI tool for managing ADRs with a built-in web UI. Free, open source.

---

### 9.10 Release & Version Management

#### Must-Have
**Semantic versioning** — `MAJOR.MINOR.PATCH`. Only enforced for published packages or external API consumers. Internal apps can deploy from `main` with date-stamped tags.

#### Should-Have
**Changesets** — the 2025 community pick for monorepos. Decouples "what changed" from "commit message format". Each PR includes a `.changesets/*.md` describing the change:
```bash
npm install -D @changesets/cli && npx changeset init
```

Workflow:
1. Dev runs `npx changeset` on feature branch — picks affected packages + bump type + writes description
2. PR includes `.changesets/random-name.md` (reviewable, intentional)
3. Changesets bot creates a "Release PR" that aggregates all pending changesets
4. Merging the Release PR triggers version bumps + publish

**Feature flags — open source (free):**
- **GrowthBook** — free cloud tier + self-hostable; best for A/B testing + flags. `npm install @growthbook/growthbook`
- **Unleash** — free self-hosted via Docker; enterprise-grade progressive delivery; 12K GitHub stars
- **PostHog** — ships feature flags + A/B testing + session replay + product analytics in one tool. Free: 1M events/month. Open source, self-hostable.
- **OpenFeature** — vendor-neutral SDK standard (like OTel for flags); use with GrowthBook or Unleash as the backend

#### Nice-to-Have
**`release-please`** (Google) — reads conventional commits, creates Release PRs with bumped versions and changelogs automatically. Works well for single-repo projects.

---

### 9.11 Dependency Hygiene

#### Must-Have
**Lock file discipline:**
- Always commit `pnpm-lock.yaml`
- CI uses `pnpm install --frozen-lockfile` — fails if lock is out of sync
- Review lock file diffs in PRs that touch `package.json`
- Never delete and regenerate the lock file in a PR

**Weekly hygiene commands:**
```bash
pnpm outdated          # see what's behind
pnpm audit             # check for vulnerabilities
pnpm audit fix         # auto-fix non-breaking security issues
npx depcheck           # find unused packages to remove
```

**Dependabot** (free, GitHub native) — automated PR bot for dependency updates:
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule: { interval: weekly }
    groups:
      dev-dependencies: { patterns: ["@types/*", "eslint*", "vitest*"] }
      radix-ui: { patterns: ["@radix-ui/*"] }
```

#### Should-Have
**License scanning — `license-checker`** (free CLI): fails CI if a non-approved license appears:
```bash
npx license-checker --onlyAllow "MIT;Apache-2.0;ISC;BSD-2-Clause;BSD-3-Clause"
```

**SBOM (Software Bill of Materials)** — becoming a legal requirement under US Executive Order 14028 and EU Cyber Resilience Act (reporting obligations from September 2026):
```bash
brew install syft
syft . -o cyclonedx-json > sbom.json  # generate

brew install grype
grype sbom:./sbom.json                 # check SBOM for known CVEs
```

Syft + Grype are free, open source, and take under 10 minutes to set up in CI.

#### Nice-to-Have
**Renovate Bot** (free, more powerful than Dependabot) — smarter grouping, auto-merge rules, lockfile-only updates, monorepo-aware:
```json
// renovate.json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "packageRules": [
    { "matchUpdateTypes": ["patch", "minor"], "automerge": true }
  ]
}
```
Install via [GitHub App](https://github.com/apps/renovate) — free.

**Socket.dev** — detects malicious packages (supply chain attacks), not just vulnerable ones. Free tier available.

---

### 9.12 Common Mistakes to Avoid

1. **`prisma migrate dev` in production** — it shadows the DB and prompts interactively. Always use `prisma migrate deploy` in CI/production.
2. **No `--frozen-lockfile` in CI** — allows CI to silently install different versions than local dev.
3. **Long-lived cloud credentials as GitHub secrets** — use OIDC for short-lived tokens; long-lived keys are a breach waiting to happen.
4. **Missing partial index on soft-deleted tables** — every query that filters `WHERE deleted_at IS NULL` becomes a full table scan without it.
5. **PgBouncer transaction mode + Prisma without `pgbouncer=true`** — causes prepared statement errors in production; silent locally.
6. **Adopting Highlight.io** — it's shutting down February 2026 after LaunchDarkly acquisition. Use Sentry.
7. **Deploying a CSP without testing in Report-Only mode first** — enforcing CSP without testing breaks your app in production. Always use `Content-Security-Policy-Report-Only` for at least one release cycle first.
8. **Coverage as a vanity metric** — 90% coverage with trivial tests is worse than 60% coverage of critical business logic.
9. **No ADR for major decisions** — six months later, no one remembers why a framework or pattern was chosen.
10. **Skipping SBOM generation** — EU CRA reporting obligations start September 2026. Syft + Grype is a 10-minute setup.
11. **`import.meta.env` / `process.env` accessed directly without validation** — use `@t3-oss/env-nextjs` + Zod to validate all env vars at startup. A missing `DATABASE_URL` should crash the app on boot, not mid-request.
12. **Raw `<img>` tags in Next.js** — always use `next/image`; missing it causes CLS and missed WebP optimisation.

---

### 9.13 Free vs Paid Quick Reference

| Category | Free | Paid (when you outgrow free) |
|---|---|---|
| Monorepo | pnpm + Turborepo (Vercel remote cache free tier) | Nx Cloud |
| Linting/formatting | ESLint v9, Biome, Prettier | — |
| Testing | Vitest, Playwright, MSW, axe-core | Browserstack (cross-browser cloud) |
| CI | GitHub Actions (2,000 min/month) | GitHub Actions larger runners |
| Hosting | Vercel Hobby, Railway trial, Render free | Vercel Pro, Railway $5+, Fly.io |
| Database | Neon free (0.5 GB), Supabase free (500 MB) | Neon paid, Supabase Pro $25/month |
| Error tracking | Sentry free (5K errors/month) | Sentry Team |
| Uptime | BetterStack free (10 monitors), UptimeRobot free (50 monitors) | BetterStack Pro |
| Observability | Grafana Cloud free, Jaeger self-hosted | Honeycomb, Datadog |
| Feature flags | GrowthBook OSS, Unleash OSS, PostHog free | LaunchDarkly |
| SBOM/License | Syft, Grype, license-checker | FOSSA, Snyk |
| DB GUI | Beekeeper Studio CE, pgAdmin | TablePlus |
| Rate limiting | @upstash/ratelimit (10K commands/day free) | Upstash paid |
| CDN/WAF | Cloudflare free | Cloudflare Pro $20/month |
| Secrets | Doppler free, Infisical self-host | Doppler Team $7/user/month |

---

## Sources

- [2026 Data Security and Privacy Compliance Checklist — O'Melveny](https://www.omm.com/insights/alerts-publications/2026-data-security-and-privacy-compliance-checklist-key-us-state-law-updates-ai-rules-coppa-changes-and-global-data-protection-risks/)
- [CCPA Requirements 2026: Complete Compliance Guide — Secure Privacy](https://secureprivacy.ai/blog/ccpa-requirements-2026-complete-compliance-guide)
- [Mobile App Compliance Checklist 2026 — Anzaforge](https://anzaforge.com/blog/mobile-app-compliance-checklist)
- [Top 10 Compliance Standards: SOC 2, GDPR, HIPAA & More — Sprinto](https://sprinto.com/blog/compliance-standards/)
- [OWASP Top 10 in 2026 — Cyberplan](https://cyber-plan.com/en/articles/owasp-top-10-in-2026-the-ten-critical-risks-to-web-applications-explained/)
- [Application Security Frameworks: OWASP, NIST, ISO/IEC — Wiz](https://www.wiz.io/academy/application-security/application-security-frameworks)
- [Key Security Standards of 2026 — Jit.io](https://www.jit.io/resources/security-standards)
- [EU AI Act 2026 Updates — Legalnodes](https://www.legalnodes.com/article/eu-ai-act-2026-updates-compliance-requirements-and-business-risks)
- [EU AI Act Compliance 2026 — Secure Privacy](https://secureprivacy.ai/blog/eu-ai-act-2026-compliance)
- [Focus areas for Privacy by Design 2026 — IAPP](https://iapp.org/news/a/focus-areas-when-implementing-data-protection-by-design-and-by-default-in-2026)
- [GDPR Compliance for Developers 2026 — dasroot.net](https://dasroot.net/posts/2026/02/gdpr-compliance-developers-practical-implementation-2026/)
- [ADA WCAG 2.1 Compliance 2026 — Flockler](https://flockler.com/blog/ada-wcag-accessibility-compliance-2026)
- [SaaS Accessibility Legal Compliance — Accessibility.Works](https://www.accessibility.works/blog/saas-cloud-software-ada-compliance-wcag-testing-auditing/)
- [Incident Response Plan Guide 2026 — Subrosa Cyber](https://subrosacyber.com/en/blog/incident-response-plan-guide)
- [CIRCIA Cyber Reporting — Fisher Phillips](https://www.fisherphillips.com/en/insights/insights/new-federal-cybersecurity-reporting-rules-are-on-their-way)
- [Privacy Policy Checklist 2026 — CookieYes](https://www.cookieyes.com/blog/privacy-policy-checklist/)
- [Effective SaaS Risk Management 2026 — Zluri](https://www.zluri.com/blog/saas-risk-management)
- [HIPAA Website Compliance Checklist — Feroot Security](https://www.feroot.com/blog/hipaa-website-compliance-checklist/)
- [Termly vs iubenda comparison — Cybernews](https://cybernews.com/privacy-compliance-tools/termly-vs-iubenda/)
- [CookieYes vs Cookiebot vs Osano — CookieYes](https://www.cookieyes.com/blog/cookiebot-vs-osano/)
- [Auth providers compared 2026 — gautamkhorana.com](https://gautamkhorana.com/blog/authentication-services-2026-clerk-auth0-supabase-workos/)
- [Best Secret Management Tools 2026 — Infisical](https://infisical.com/blog/best-secret-management-tools)
- [SOC 2 Tools: Vanta vs Drata vs Secureframe — SecureLeap](https://www.secureleap.tech/blog/soc-2-tools-vanta-drata-secureframe-guide-2025)
- [Oneleet Pricing — ComplyJet](https://www.complyjet.com/blog/oneleet-pricing-exposed)
- [Snyk vs CodeQL SAST compared 2026 — DEV Community](https://dev.to/rahulxsingh/snyk-vs-codeql-free-sast-tools-compared-2026-4bp7)
- [Top Container Scanning Tools 2026 — Aikido](https://www.aikido.dev/blog/top-container-scanning-tools)
- [10 Best Logging Tools 2026 — Parseable](https://www.parseable.com/blog/ten-best-logging-tools-2026)
- [PagerDuty alternatives 2025 — Incident.io](https://incident.io/blog/3-best-pagerduty-alternatives-2025-comparison)
- [Top PTaaS Companies 2026 — CyberPress](https://cyberpress.org/best-ptaas-penetration-testing-as-a-service/)
- [2025 Accessibility Testing Tools Compared](https://accessibility-test.org/blog/testing-tools/2025-accessibility-testing-tools-compared-free-vs-paid/)
- [SaaS Security Checklist 2026 — DesignRevision](https://designrevision.com/blog/saas-security-checklist)

**Australian-specific sources:**
- [Australian Privacy Act 1988 + Australian Privacy Principles — OAIC](https://www.oaic.gov.au/privacy/australian-privacy-principles)
- [Notifiable Data Breaches scheme — OAIC](https://www.oaic.gov.au/privacy/notifiable-data-breaches)
- [Spam Act 2003 compliance — ACMA](https://www.acma.gov.au/spam)
- [Online Safety Act 2021 — eSafety Commissioner](https://www.esafety.gov.au/industry/codes)
- [ACCC fake reviews and online reviews guidance](https://www.accc.gov.au/consumers/misleading-claims-and-advertising/fake-reviews)
- [Australian Consumer Law (ACL) — misleading conduct](https://www.accc.gov.au/business/advertising-and-promotions/misleading-or-deceptive-conduct)
- [Food Standards Australia New Zealand (FSANZ)](https://www.foodstandards.gov.au)
- [Privacy Act reform: serious penalties for privacy breaches — Attorney-General's Department](https://www.ag.gov.au/rights-and-protections/privacy)
