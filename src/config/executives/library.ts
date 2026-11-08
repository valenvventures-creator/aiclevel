import type { ExecutiveRoleCode } from "@/types/domain";

/**
 * Starter Executive Library: well-established, general frameworks each role
 * reaches for. Copied into every organization (per executive) the first time
 * its library is read; organizations can turn starters off and add their own
 * playbooks, references and documents. General guidance, not advice for any
 * particular organization — the executive applies it to the organization's
 * own context.
 */
export interface StarterLibraryItem {
  key: string;
  kind: "FRAMEWORK" | "PLAYBOOK" | "REFERENCE";
  title: string;
  content: string;
}

export const STARTER_LIBRARY: Partial<Record<ExecutiveRoleCode, StarterLibraryItem[]>> = {
  CEO: [
    {
      key: "ceo.strategy_kernel",
      kind: "FRAMEWORK",
      title: "Strategy kernel: diagnosis, guiding policy, coherent actions",
      content:
        "A real strategy has three parts. 1) Diagnosis: name the critical challenge plainly — what is actually going on and what makes it hard. 2) Guiding policy: the overall approach that addresses the challenge, including what the organization will not do. 3) Coherent actions: a small set of coordinated, resourced steps that carry out the policy and reinforce each other. Warning signs of a weak strategy: goals restated as strategy, long lists of priorities, fluffy language, and no hard choices. Test: could a competent competitor read it and know what you will and will not do?",
    },
    {
      key: "ceo.decision_types",
      kind: "FRAMEWORK",
      title: "Decision speed: one-way vs two-way doors",
      content:
        "Classify each decision before deciding how much process it deserves. Two-way doors (reversible, limited downside): decide quickly with roughly 70% of the information you would like, delegate them, and set a review date. One-way doors (hard to reverse: large commitments, legal obligations, brand or people decisions with lasting impact): slow down, widen input, write down assumptions and the evidence that would change the call, and name the owner. State the reversibility, cost of delay and cost of being wrong for every major recommendation.",
    },
    {
      key: "ceo.okrs",
      kind: "PLAYBOOK",
      title: "Objectives and key results (OKRs)",
      content:
        "Set 3–5 objectives per quarter: qualitative, ambitious, and clearly tied to strategy. Give each 2–4 key results that are measurable outcomes (not activities), with a baseline, a target and an owner. Review weekly with a confidence score; grade at quarter end (0.6–0.7 on stretch goals is healthy). Keep a short list of what the organization will not pursue this quarter. Common failures: too many OKRs, key results that are tasks, no owner, and no weekly review.",
    },
    {
      key: "ceo.board_update",
      kind: "PLAYBOOK",
      title: "Board and investor update structure",
      content:
        "Lead with a one-paragraph summary: what went well, what did not, and the decision or help needed. Then: key metrics against plan (with trend, not just the current number), cash and runway, progress on the top priorities, risks and how they are being handled, people changes, and specific asks. Report bad news early and plainly, with the plan to address it. Keep it consistent from period to period so trends are visible.",
    },
  ],
  CFO: [
    {
      key: "cfo.thirteen_week_cash",
      kind: "PLAYBOOK",
      title: "13-week cash flow forecast",
      content:
        "Build a rolling weekly view of cash for the next 13 weeks: opening cash, receipts (by customer or stream, with expected collection timing), disbursements (payroll, rent, suppliers, tax, debt service), and closing cash. Update weekly, compare actuals to forecast, and explain variances. Use it to set the minimum cash buffer, time payments, and trigger early action when the buffer is at risk. Runway = cash ÷ average monthly net burn; state which burn figure is used and over what period.",
    },
    {
      key: "cfo.scenarios",
      kind: "FRAMEWORK",
      title: "Scenario planning: base, upside, downside",
      content:
        "Never give a single-point forecast for an important decision. Build three scenarios from explicit drivers (volume, price, conversion, churn, hiring, cost per head). Base: the most likely case. Downside: realistic stress (slower sales, higher churn, delayed raise). Upside: what happens if key bets work. For each, show revenue, burn, cash low point and runway, and the triggers that would move the organization from one plan to another. List every assumption and label estimates as estimates.",
    },
    {
      key: "cfo.saas_metrics",
      kind: "REFERENCE",
      title: "Recurring-revenue unit economics",
      content:
        "Key measures for subscription businesses. CAC payback (months) = customer acquisition cost ÷ (new monthly recurring revenue × gross margin). LTV ≈ average revenue per account × gross margin ÷ churn rate; LTV:CAC of around 3:1 or better is commonly considered healthy. Net revenue retention = (starting recurring revenue + expansion − contraction − churn) ÷ starting recurring revenue. Burn multiple = net burn ÷ net new annual recurring revenue (lower is better). Benchmarks vary by stage and market — say which benchmark is used.",
    },
    {
      key: "cfo.fundraising_readiness",
      kind: "PLAYBOOK",
      title: "Fundraising readiness",
      content:
        "Start raising with at least 9–12 months of runway left; a process usually takes 3–6 months. Prepare: a clear narrative (problem, solution, traction, why now, why this team), a model with scenarios, a use-of-funds plan tied to milestones, a cap table, and a tidy data room (financials, key contracts, corporate documents). Size the raise to reach the next value milestone plus a buffer. Consider dilution, terms beyond valuation (preferences, control rights), and alternatives (revenue-based financing, debt, grants). Securities matters need qualified counsel.",
    },
  ],
  CCO: [
    {
      key: "cco.positioning",
      kind: "FRAMEWORK",
      title: "Positioning",
      content:
        "Define positioning before messaging: 1) competitive alternatives — what customers would do if you did not exist; 2) unique attributes you have that the alternatives lack; 3) the value those attributes deliver, with proof; 4) the customers who care most about that value (best-fit segment); 5) the market category that makes the value obvious. Write it as: For [segment] who [need], [product] is a [category] that [key value], unlike [alternative], because [proof].",
    },
    {
      key: "cco.message_house",
      kind: "PLAYBOOK",
      title: "Message house",
      content:
        "Roof: one core message (a single sentence the audience should remember). Pillars: three supporting messages, each tied to a customer benefit. Foundation: proof points for each pillar — data, customer stories, credentials, third-party validation. Adapt tone and emphasis by audience (customers, investors, employees, media) without changing the core. Test with real audience members and keep the language plain.",
    },
    {
      key: "cco.campaign_brief",
      kind: "PLAYBOOK",
      title: "Campaign brief",
      content:
        "One page covering: objective and the single measurable outcome; target audience and what they currently think, feel and do; the insight; the one message; the proof; channels and timing; budget; success metrics with targets and how they will be measured; mandatory elements and brand constraints; approvals needed. If the brief cannot fit on one page, the campaign is not yet focused enough.",
    },
    {
      key: "cco.crisis_comms",
      kind: "PLAYBOOK",
      title: "Crisis communication",
      content:
        "Move fast but verify. Within the first hours: confirm the facts known and unknown, appoint one spokesperson, align leadership and legal, and issue a holding statement (what happened, that you are acting, when you will update). Then: acknowledge impact on people first, take responsibility where appropriate, explain concrete actions and timelines, and update on schedule. Communicate to employees before or at the same time as the public. Never speculate or mislead. Debrief afterwards and fix the underlying cause.",
    },
  ],
  CHRO: [
    {
      key: "chro.hiring_scorecard",
      kind: "PLAYBOOK",
      title: "Structured hiring with a scorecard",
      content:
        "Before sourcing, write a scorecard: the role's mission, 3–5 measurable outcomes expected in the first year, and the competencies needed to achieve them. Use the same structured questions for every candidate, assign each interviewer specific competencies, score independently before discussing, and check references against the scorecard. Structured interviews predict performance better than unstructured conversations and reduce bias. Keep pay and decisions consistent with employment law; involve qualified counsel for legal questions.",
    },
    {
      key: "chro.raci",
      kind: "FRAMEWORK",
      title: "Clear ownership: RACI",
      content:
        "For each important activity or decision, name who is Responsible (does the work), Accountable (one person who owns the outcome and signs off), Consulted (gives input before) and Informed (told after). Exactly one Accountable person per item. Too many Consulted slows work; no Accountable means nothing ships. Use it for cross-team processes, new initiatives and anything that has dropped between teams.",
    },
    {
      key: "chro.operating_cadence",
      kind: "PLAYBOOK",
      title: "Operating cadence",
      content:
        "Weekly: team priorities and blockers (short, metrics-led), and 1:1s focused on the report's agenda. Monthly: business review against plan and key metrics. Quarterly: goal setting and retrospectives, plus performance and development conversations. Annually: strategy, budget and compensation review. Each meeting needs a purpose, an owner, inputs prepared beforehand, and written decisions and actions afterwards.",
    },
    {
      key: "chro.performance_comp",
      kind: "REFERENCE",
      title: "Performance and compensation basics",
      content:
        "Separate development conversations from pay decisions where possible. Base performance on agreed outcomes and observed behaviours, with regular feedback so year-end holds no surprises. Build pay bands per role level from market data, place people within bands consistently, and document the reasons for exceptions. Review for unexplained pay gaps between groups. Requirements differ by jurisdiction (pay transparency, minimum wage, classification) — confirm locally.",
    },
  ],
  CTO: [
    {
      key: "cto.build_buy",
      kind: "FRAMEWORK",
      title: "Build, buy or partner",
      content:
        "Build when the capability is a core differentiator and you can sustain the team to maintain it. Buy when it is a commodity that a mature vendor does well; compare total cost of ownership over 3 years (licences, integration, maintenance, switching cost). Partner or integrate when speed matters and the capability is adjacent. Score options on strategic fit, cost, time to value, risk (security, vendor lock-in, data ownership) and the team's capacity. Revisit the decision when scale or strategy changes.",
    },
    {
      key: "cto.adr",
      kind: "PLAYBOOK",
      title: "Architecture decision records",
      content:
        "Record each significant technical decision in a short document: context (the problem and constraints), the decision, alternatives considered and why they were rejected, consequences (benefits, costs, risks) and status. Keep them with the code, number them, and never rewrite history — supersede with a new record. They make decisions reviewable, speed up onboarding and stop the same debate recurring.",
    },
    {
      key: "cto.security_baseline",
      kind: "REFERENCE",
      title: "Security baseline",
      content:
        "Minimum controls for a growing organization: single sign-on and multi-factor authentication everywhere; least-privilege access with quarterly reviews; device management and encryption; secrets kept out of code; dependency and vulnerability scanning; encrypted backups with tested restores; logging and alerting on critical systems; an incident response plan with named owners; vendor security reviews; and staff security training. Map the gap to the framework your customers ask about (often SOC 2 or ISO 27001).",
    },
    {
      key: "cto.automation_roi",
      kind: "FRAMEWORK",
      title: "Automation and A.I. return on investment",
      content:
        "Pick candidates by volume × time per task × error cost. Estimate savings conservatively (hours saved × loaded hourly cost, plus error reduction) against build or licence cost, integration effort, ongoing maintenance and change management. Start with a pilot on one process with a baseline and success metric, keep a human review step where errors are costly, and check data privacy and security before connecting systems. Scale only what the pilot proves.",
    },
  ],
  CLO: [
    {
      key: "clo.contract_review",
      kind: "PLAYBOOK",
      title: "Contract review checklist",
      content:
        "Check: parties and authority to sign; scope and deliverables; price, payment terms and late fees; term, renewal (watch auto-renewal) and termination rights; limitation of liability and caps; indemnities; warranties; intellectual property ownership and licences; confidentiality; data protection and security obligations; governing law, venue and dispute resolution; assignment and change of control; and anything unusual or one-sided. Summarise the top risks and proposed changes. Material or unusual terms should be reviewed by qualified counsel.",
    },
    {
      key: "clo.risk_register",
      kind: "FRAMEWORK",
      title: "Risk register",
      content:
        "For each risk record: description, category (legal, regulatory, contractual, reputational, operational), likelihood (1–5), impact (1–5), score, owner, current controls, planned mitigation with dates, and status. Review high scores monthly and the full register quarterly. Escalate risks that are both likely and severe. Keep the language factual and avoid conclusions about legal liability that require a lawyer's opinion.",
    },
    {
      key: "clo.data_protection",
      kind: "REFERENCE",
      title: "Data protection basics",
      content:
        "Know what personal data is collected, why, where it is stored and who can access it (a data map). Have a lawful basis for processing, collect only what is needed, keep it only as long as needed, and secure it. Publish an accurate privacy notice, honour individuals' rights requests, sign data processing agreements with vendors, and have a breach response plan with notification deadlines. Rules differ by jurisdiction (for example GDPR, UK GDPR, US state laws) — confirm which apply.",
    },
    {
      key: "clo.escalation",
      kind: "PLAYBOOK",
      title: "When to bring in qualified counsel",
      content:
        "Recommend a qualified lawyer for: litigation or threatened claims; regulatory investigations or notices; employment terminations with legal risk; fundraising, securities and equity matters; mergers, acquisitions and major contracts; intellectual property disputes; data breaches; and anything involving criminal exposure or significant financial liability. The Chief Legal Officer here is an A.I. adviser that frames issues, checklists and questions for counsel — it does not give legal advice.",
    },
  ],
  CIO: [
    {
      key: "impact.theory_of_change",
      kind: "FRAMEWORK",
      title: "Theory of change",
      content:
        "Work backwards from the long-term impact: the outcomes that must happen first, the outputs (what the organization produces or delivers), the activities that create them, and the inputs needed. State the assumptions that link each step and the evidence for them. Choose a few indicators at each level, especially outcomes, not just outputs. Use it to decide what to fund, what to stop and what to measure.",
    },
    {
      key: "impact.measurement",
      kind: "REFERENCE",
      title: "Impact measurement",
      content:
        "Measure across five dimensions: what outcome occurs; who experiences it (and how underserved they are); how much (scale, depth, duration); contribution (what would have happened anyway); and risk (that impact differs from expectations). Use recognised metric catalogues (for example IRIS+) and reporting frameworks your stakeholders expect. Separate measured results from estimates, and report negative or unintended effects too.",
    },
    {
      key: "impact.stakeholders",
      kind: "PLAYBOOK",
      title: "Stakeholder mapping",
      content:
        "List stakeholders (communities, beneficiaries, employees, customers, partners, funders, regulators), then map each by influence and by how much they are affected. Engage the most affected directly, not only the most influential. Record what each group needs, their concerns, how and how often you will engage, and what you heard and changed as a result.",
    },
    {
      key: "impact.claims_check",
      kind: "PLAYBOOK",
      title: "Authentic impact claims",
      content:
        "Before publishing any impact or sustainability claim: is it specific and measurable; is there evidence; does it cover the whole relevant footprint, not a flattering slice; are offsets or estimates clearly labelled; and would it survive scrutiny from a regulator, journalist or critic? Avoid vague words like 'green' or 'sustainable' without substantiation. Advertising and environmental-claim rules vary by jurisdiction.",
    },
  ],
};
