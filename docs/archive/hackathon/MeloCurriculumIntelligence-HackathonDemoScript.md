# Melo Curriculum Intelligence — Hackathon Demo Script

**Total runtime:** ~3:00
**Tone:** confident, natural, product-focused
**Audience:** hackathon judges
**Maximum video duration:** 3 minutes

**Prep note:** Start on Admin → Academic Knowledge → Curriculum Intelligence with a ready indexed scheme-of-work source, one pre-approved topic already available for the teacher segment if live generation is slow, and teacher planning open in a second tab.

---

## Core story

Schools possess schemes of work as PDFs or scanned institutional documents, but teachers still manually recreate weekly topics and objectives.

Melo transforms an approved curriculum source into:

1. Evidence-backed weekly curriculum proposals
2. Source-page citations
3. Human administrative review and editing
4. Approved academic topics
5. Existing teacher lesson-generation workflows
6. A Curriculum Readiness Map

## Important distinctions

- This is not merely document upload or lesson-plan generation.
- The curriculum document configures the school’s academic structure.
- AI output is never authoritative without human approval.
- Approved units reuse Melo’s existing knowledge-topic and planning infrastructure.
- OpenRouter is the provider layer.
- The submitted production extraction run uses the required GPT model through OpenRouter.
- GPT interprets inconsistent curriculum structure and proposes schema-constrained units; deterministic code validates academic context, evidence, duplicates, permissions, and approval.
- Codex was used to inspect, architect, implement, test, debug, and deploy the feature.

---

## 1. Timestamped narration + screen actions + captions

### 0:00–0:20 — Problem and product introduction

| | |
|---|---|
| **Narration** | “Schools already have schemes of work — PDFs, scanned institutional documents. Teachers still retype weekly topics and objectives by hand. Melo Curriculum Intelligence turns an approved curriculum source into structured school data: weekly proposals with source-page evidence, admin review, approved academic topics, and a readiness map — without making AI the authority.” |
| **Screen actions** | Hold a static title card or open Admin home. Optional: briefly show a curriculum PDF thumbnail, then cut to the Curriculum Intelligence page header. Do not start extraction yet. |
| **Caption** | `From scheme of work → reviewed academic plan` |

---

### 0:20–0:50 — Select an indexed curriculum source

| | |
|---|---|
| **Narration** | “This is not a generic document upload. We start from a school-owned curriculum source that is already extracted and indexed. The admin sets subject, level, and term — the academic context the source will configure.” |
| **Screen actions** | Go to **Academic Knowledge → Curriculum Intelligence**. In the left rail **New proposal**: open **Ready curriculum source** and select the prepared scheme of work; set **Subject**, **Level**, and **Term**. Pause so judges can read the helper line: *Nothing becomes a school topic until an administrator approves it.* |
| **Caption** | `Indexed source + academic context` |

---

### 0:50–1:20 — Extract weekly proposals with evidence

| | |
|---|---|
| **Narration** | “GPT reads the document’s inconsistent structure and proposes schema-constrained weekly units: week, title, objectives, and confidence. Melo then reconciles every citation against the exact extracted pages sent to the model. GPT interprets; deterministic code verifies; neither can publish a topic.” |
| **Screen actions** | Click **Extract proposal**. Show the review queue generating, then settle on the unit list. Scroll slowly through 2–3 unit cards. Hover or point at **Pages …** and the excerpt block on one card. |
| **Caption** | `Evidence-backed weekly proposals` |

---

### 1:20–1:50 — Edit and approve one unit

| | |
|---|---|
| **Narration** | “Every unit needs a human decision. We can edit title, objectives, or duration, reject weak units, or approve a correct one. Approval is the only step that creates an academic topic.” |
| **Screen actions** | Click **Edit** on one unit → right-rail **Inspector** opens. Make a small, visible edit (e.g. tighten a title or objective) → **Save**. Click **Approve** → confirmation dialog: *Approve this curriculum topic?* → **Approve topic**. Show toast: *Topic approved*. |
| **Caption** | `Human approval required` |

---

### 1:50–2:20 — Show the approved topic in teacher planning

| | |
|---|---|
| **Narration** | “Approved units reuse Melo’s existing knowledge-topic and planning infrastructure. No parallel curriculum database — teachers pick up the topic in the workflows they already use.” |
| **Screen actions** | Switch to the **Teacher** app → **Planning**. Select the matching class, subject, and term. Open the topic selector and highlight the newly approved topic (and any inherited curriculum source if visible). Do not invent a new teacher UI. |
| **Caption** | `Approved topic → existing planning` |

---

### 2:20–2:40 — Show generated teaching material

| | |
|---|---|
| **Narration** | “From that approved topic, the teacher generates teaching material through Melo’s existing lesson-generation path — now grounded in the school’s reviewed curriculum structure.” |
| **Screen actions** | From planning, open the existing lesson / artifact generation flow for that topic. Show a completed lesson plan, note, or generated artifact already tied to the topic (pre-generate if needed so this segment stays under 20 seconds). |
| **Caption** | `Existing lesson generation, curriculum-aligned` |

---

### 2:40–2:52 — Show Curriculum Readiness Map

| | |
|---|---|
| **Narration** | “The Readiness Map reports preparation evidence from real Melo records — plans, assessments, and published resources — not a claim that a lesson was taught.” |
| **Screen actions** | Admin → **Curriculum Readiness**. Set subject, level, and term. Show summary stats and the evidence table row for the approved topic. |
| **Caption** | `Readiness from real school records` |

---

### 2:52–3:00 — Codex contribution and close

| | |
|---|---|
| **Narration** | “Codex inspected the existing monorepo, designed and implemented this integration, wrote its tests, and debugged real citation and source-link failures. GPT provides document intelligence through OpenRouter; Melo keeps the evidence and the human decision.” |
| **Screen actions** | Hold the Readiness Map full-frame, or cut to a clean end card with product name. |
| **Caption** | `Curriculum intelligence, not just AI upload` |

---

## 2. Spoken script (continuous, ~450 words / ~3 min)

```text
[0:00]
Schools already have schemes of work — PDFs, scanned institutional documents.
Teachers still retype weekly topics and objectives by hand.
Melo Curriculum Intelligence turns an approved curriculum source into structured school data:
weekly proposals with source-page evidence, admin review, approved academic topics,
and a readiness map — without making AI the authority.

[0:20]
This is not a generic document upload.
We start from a school-owned curriculum source that is already extracted and indexed.
The admin sets subject, level, and term — the academic context the source will configure.

[0:50]
GPT reads the document's inconsistent structure and proposes schema-constrained weekly units:
week, title, objectives, and confidence.
Melo then reconciles every citation against the exact extracted pages sent to the model.
GPT interprets; deterministic code verifies academic context, evidence, permissions, and duplicates.
Neither can publish a topic.

[1:20]
Every unit needs a human decision.
We can edit title, objectives, or duration, reject weak units, or approve a correct one.
Approval is the only step that creates an academic topic.

[1:50]
Approved units reuse Melo’s existing knowledge-topic and planning infrastructure.
No parallel curriculum database —
teachers pick up the topic in the workflows they already use.

[2:20]
From that approved topic, the teacher generates teaching material
through Melo’s existing lesson-generation path —
now grounded in the school’s reviewed curriculum structure.

[2:40]
The Curriculum Readiness Map
It reports preparation evidence from real Melo records —
plans, assessments, published resources —
not a claim that a lesson was taught.

[2:52]
Codex inspected the existing monorepo, designed and implemented this integration,
wrote its tests, and debugged real citation and source-link failures.
GPT provides document intelligence through OpenRouter;
Melo keeps the evidence and the human decision.
```

---

## 3. Five recommended screenshots

| # | Capture | Why judges care |
|---|---------|-----------------|
| **1** | Curriculum Intelligence left rail: ready source + subject/level/term + *Extract proposal* | Proves indexed source + academic context, not bare upload |
| **2** | Review queue unit card with **Pages**, supporting excerpt, confidence | Shows evidence-backed proposals |
| **3** | Approval dialog: *Approve this curriculum topic?* | Makes human authority explicit |
| **4** | Teacher Planning with the approved topic selected | Shows reuse of existing topic/planning infrastructure |
| **5** | Curriculum Readiness Map: summary stats + evidence row for the topic | Closes the loop with preparation visibility |

---

## 4. Concise Devpost elevator pitch

**Melo Curriculum Intelligence** turns a school’s scheme of work into reviewed academic structure — not another upload button or one-off lesson generator.

Admins select an already indexed curriculum source, set subject, level, and term, and extract weekly unit proposals with source-page citations. Nothing becomes school truth until an administrator edits, rejects, or approves each unit. Approved units become Melo’s existing knowledge topics, so teachers keep using current planning and lesson-generation workflows. A Curriculum Readiness Map then shows preparation evidence from real records — plans, assessments, published resources — without claiming lessons were taught.

AI proposes; humans approve. OpenRouter is the provider layer; the production extraction model is the required GPT model. Codex was used end-to-end to inspect, architect, implement, test, debug, and deploy the feature.

---

## Recording tips (keep under 3:00)

1. **Pre-warm extraction** once before recording if the live model run is slow; in the take, either run a short extraction or cut from click → ready queue.
2. **Pre-generate** one teaching artifact for the approved topic so 2:20–2:40 is show, not wait.
3. **Do not** show provider/model IDs in the UI (they stay server-side); say OpenRouter + GPT only in the closing line.
4. **Do not** claim “taught,” silent topic creation, or a separate curriculum DB — stay on the six-step story above.
5. Before recording, confirm the server-side run log names the required production GPT model; do not make that claim over footage generated by the temporary free model.
