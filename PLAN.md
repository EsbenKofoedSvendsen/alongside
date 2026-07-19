# Alongside — MVP Build Plan

> An AI care copilot that turns compassionate companions into confident caregivers.
> **We bring the expertise. Caregivers bring companionship. Adult children gain peace of mind.**

Sources: *Alongside Product Roadmap.xlsx* (User Story Map, Product Backlog, MoSCoW, RICE, 6-month Roadmap, Assumptions) and *The Girlies: All Module Assignment* (personas, problem statement, VPC, competitive landscape, roadmap & user-story-map write-ups).

---

## 1. Product summary

**The problem.** Families are forced into a tradeoff when hiring elder care: choose the clinically excellent caregiver, or the one their parent actually likes. Elders almost always pick chemistry; adult children feel pressured to pick credentials. Meanwhile caregivers — often with no formal medical training — carry high-stakes responsibility (medication, mobility, emergencies) guided only by experience, and adult children depend on ad-hoc WhatsApp updates for visibility.

**The solution.** A caregiver-facing mobile app with an AI Care Copilot at its center. The copilot gives clinically grounded, in-the-moment guidance personalized to the elder's profile; condition-specific playbooks turn expert frameworks into step-by-step actions; risk detection warns before harm happens; and a daily digest reaches the family on WhatsApp/text — a channel they already use, so **adult children install nothing**.

**The three-sided model.**
| Role | Persona | Relationship to product |
|---|---|---|
| **User** | Siti, 45 — live-in caregiver, no formal training, deeply trusted | Uses the app daily; copilot is her expert-in-pocket |
| **Buyer** | Maya, 35 — working adult daughter, guilt + limited time | Pays; receives the daily digest via WhatsApp/text |
| **Beneficiary** | The elder (late 70s–80s) | Gets safer care + a companion who can focus on connection |

**Key scoping decisions (from the backlog notes):**
- **Caregiver-side app only** for MVP — no adult-children-facing app. The sales/ops team enters the elder's profile through an **internal tool**, which auto-creates a caregiver invitation. This is how onboarding starts.
- Caregiver Notes is **merged into Elder Preference & Notes** (notes about what works feed the elder's preferences).
- Family-Caregiver Messaging is a **Won't-have** (WhatsApp already does that job).
- MVP is free pilot (50 families); Plan Entitlements/paywall is MMP work (November+), out of MVP scope.

## 2. MVP scope (MoSCoW Must-haves, RICE-ordered)

Build order follows average RICE score within Must-haves:

| # | Feature | RICE | What ships |
|---|---|---|---|
| 1 | Sign up & Login | 13.2 | Invite-link signup, email+password, forgot/reset password, brute-force rate limiting |
| 2 | Sign out | 10.7 | Logout with confirmation, session revocation |
| 3 | Onboarding | 6.5 | Welcome → 3–4 guided feature intros → pre-filled elder profile review → confirm read → fill preference gaps → "you're all set" |
| 4 | Elder Preference Profile (& Notes) | 6.0 / 4.8 | Routine, foods, music, hobbies, dislikes, calming strategies, mobility limits, communication style + categorized notes (question/update/observation/urgent), search |
| 5 | AI Care Copilot | 5.3 | Chat with suggestion chips, personalized answers from elder profile, conversation history, clear escalation to humans for emergencies |
| 6 | Alerts and Escalation | 4.1 | Pre-response risk classifier, distinct red-flag UI, emergency guidance, alert history, caregiver-controlled share-with-family |
| 7 | Daily Family Digest | 3.75 | Auto-drafted from the day's notes/alerts/chats → caregiver reviews & edits (nothing sends without approval) → delivered to family WhatsApp/text → history |
| 8 | Condition-Specific Care Playbooks | 3.2 | Step-by-step guidance surfaced mid-conversation ("This looks like sundowning — walk through it together?"), step check-off, progress persistence, personalization + contraindication check, browsable playbook library |
| 9 | Product tracking | — | Event tracking on every key interaction (funnel, drop-offs) |
| + | Internal ops tool | — | Sales/ops enters elder profile + family contacts → invitation auto-created (the two ops user stories in the backlog) |

**Acceptance bar (from Module 9):** a copilot response is accepted when it answers, routes emergency-category questions to an escalation message instead of generating advice, and never contradicts a stated contraindication in the elder's profile. A digest is accepted when the caregiver can review and edit before sending.

## 3. Architecture & stack

Per the assumptions sheet: 2 engineers, AI-accelerated, 1-month cycle, wireframes/HIPAA presumed done — so the build optimizes for speed with a clean seam to harden later.

- **Framework:** Next.js 15 (App Router) + TypeScript — one repo serves the mobile-first caregiver PWA, the ops tool, and the API.
- **Styling:** Tailwind CSS; warm, high-touch mobile-first design (bottom tab nav, large targets); app shell max-width ~430px.
- **Database:** SQLite via better-sqlite3 (zero-ops for pilot scale of 50 users; schema designed to port to Postgres).
- **Auth:** email+password (bcrypt), JWT session in httpOnly cookie, login rate limiting, token revocation on logout.
- **AI layer:** Anthropic Claude (claude-sonnet-5) when `ANTHROPIC_API_KEY` is set; a deterministic rules-based fallback engine otherwise so the product works end-to-end in demo mode. Both paths share the same safety pipeline:
  1. **Escalation classifier** runs *before* generation — emergency-category input (chest pain, unconsciousness, stroke signs, serious falls, choking…) returns an escalation template (call emergency services), never generated advice, and files an alert.
  2. **Playbook matcher** — trigger keywords/intents map the message to a candidate playbook, offered as a card mid-conversation.
  3. **Contraindication resolver** — elder profile vs. playbook steps checked before response assembly; conflicting steps are flagged/substituted.
  4. **Personalized generation** — elder profile + preferences + recent notes injected into the system prompt; LLM constrained to plain-language, non-diagnostic guidance.
- **Digest delivery:** WhatsApp Business API is stubbed behind a `DeliveryProvider` interface — pilot mode simulates delivery with status tracking (sent/failed/retry) and renders the WhatsApp-style message preview.
- **Analytics:** `events` table + `track()` helper; fired on signup, onboarding steps, chat, playbook trigger/completion/"need more help", alert share, digest edit/send — the metrics named in the roadmap (core-flow completion, onboarding completion, digest edit rate, playbook completion).

## 4. Data model

```
users            id, email, password_hash, name, role (caregiver|ops), onboarded_at
elders           id, name, age, photo_emoji, conditions[], care_needs, routine, bio
preferences      elder_id, favorite_foods, music, hobbies, routines, dislikes,
                 calming_strategies, mobility_limits, communication_style, updated_at/by
care_circle      elder_id ↔ user_id (caregiver assignment)
family_contacts  id, elder_id, name, relationship, channel (whatsapp|sms), phone, is_digest_recipient
invitations      id, token, elder_id, invitee_name, status (pending|accepted), created_by
conversations    id, user_id, elder_id, title, created_at
messages         id, conversation_id, role, kind (text|playbook_offer|playbook|escalation), content, meta(json)
playbooks        id, slug, title, category, summary, triggers[], steps[](title, detail, caution?),
                 contraindications[], reviewed_by, version
playbook_runs    id, playbook_id, user_id, elder_id, conversation_id, checked_steps[], status
notes            id, elder_id, author_id, category (question|update|observation|urgent), content, shareable
alerts           id, elder_id, severity (emergency|warning), title, detail, source_message_id,
                 shared_with_family, created_at
digests          id, elder_id, caregiver_id, date, draft, final, status (draft|sent|failed), sent_at, recipients(json)
events           id, user_id, name, props(json), created_at
sessions/resets  token management for auth
```

## 5. Screens

**Caregiver app** (mobile-first, bottom nav: Copilot · Playbooks · Elder · Alerts · Digest)
1. `/welcome` — what Alongside is and why you were invited
2. `/invite/[token]` — accept invitation → signup
3. `/login`, `/forgot-password`, `/reset-password`
4. `/onboarding` — guided intro (copilot, playbooks, alerts, digest) → elder profile review + confirm → add observations → "you're all set"
5. `/copilot` — chat: suggestion chips, elder context header, escalation treatment, inline playbook cards with step check-off, conversation drawer/history
6. `/playbooks`, `/playbooks/[slug]` — browsable library by condition category, search, step detail
7. `/elder` — preference profile sections + notes tab (composer w/ category, list, search)
8. `/alerts` — history, severity badges, share-with-family action
9. `/digest` — today's auto-draft, edit, send confirmation, WhatsApp preview, history
10. `/settings` — profile, sign out w/ confirmation

**Internal ops tool** (`/ops`, ops role only)
11. Elder intake form (profile + preferences + family contacts) → invitation auto-generated with copyable link; invitation & pilot roster list; simple event log view.

## 6. Seed content

- **8 playbooks** (dementia/sundowning, wandering, medication refusal, post-fall response, swallowing difficulty, refusing to eat, UTI-linked confusion, agitation de-escalation) — each with triggers, 4–7 steps, cautions, contraindications, review attribution. Content is pilot-grade, clearly labeled "not medical advice."
- **Demo data:** ops account, one caregiver invitation, elder "Ibu Lastri, 82" with rich preferences (mirrors the Siti/Jakarta persona), family contact (Maya, WhatsApp), sample notes so the first digest has substance.

## 7. Out of scope (deliberately)

Per MoSCoW/roadmap: Caregiver Micro-Lessons, metrics dashboard (Sep); Care Quality Record (Oct); Plan Entitlements + Stripe, Daily Dashboard, Task Tracking (Nov); Activity Library (Dec); Family-Caregiver Messaging (never — WhatsApp wins). The schema leaves room: notes/digests/alerts are retained for the future Care Quality Record read path.

## 8. Risks & mitigations

- **AI safety:** emergency queries must never get generated advice → rules-based classifier runs pre-generation on both AI and fallback paths; visible disclaimer; escalation template always includes local emergency guidance.
- **Clinical content liability:** playbooks carry review attribution + version fields (the backlog's "biggest scope variable" — admin CRUD deferred; content ships as reviewed seed data).
- **WhatsApp API approval gates delivery** (flagged in roadmap dependencies) → provider interface + simulated mode keeps the pilot unblocked.
- **No API key at runtime** → deterministic fallback keeps every flow demoable.
