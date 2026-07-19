# Alongside — AI Care Copilot (MVP)

> We bring the expertise. Caregivers bring companionship. Adult children gain peace of mind.

Alongside is a caregiver-facing app with an AI Care Copilot at its center: expert-backed answers
in the moment, condition-specific playbooks for high-stakes situations, automatic risk alerts,
and a one-tap daily digest to the family on WhatsApp/text.

Built from the product plan in [PLAN.md](./PLAN.md) (derived from the Alongside Product Roadmap
spreadsheet and module assignment docs).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The SQLite database (`data/alongside.db`) is created and seeded on
first run.

### Demo accounts

| Role | Login | Password |
|---|---|---|
| Caregiver (onboarded, with data) | `siti@example.com` | `alongside-demo` |
| Ops / internal tool | `ops@alongside.app` | `alongside-ops` |

To walk the full **invite → signup → onboarding** flow, open
`http://localhost:3000/invite/demo-invite-token` in a private window (or create a new elder in
the ops tool, which auto-generates a fresh invitation link).

### AI mode

Copy `.env.example` to `.env.local` and set an API key. The copilot checks providers in this
order:

1. **DeepSeek** — `DEEPSEEK_API_KEY` (+ optional `DEEPSEEK_MODEL`, default `deepseek-v4-flash`)
2. **Anthropic Claude** — `ANTHROPIC_API_KEY`
3. **No key** — a deterministic guidance engine keeps every flow working offline.

The safety pipeline (emergency escalation, playbook matching, contraindication checks) is
rules-based and runs identically in all three modes — emergency-category questions never receive
generated advice.

## Deploying (Vercel + GitHub)

The repo is set up for the standard GitHub → Vercel flow so the whole group can collaborate:

1. **Fork or clone** this repo, commit, and open PRs as usual.
2. **Import to Vercel**: [vercel.com/new](https://vercel.com/new) → Import the GitHub repo →
   framework auto-detects as Next.js — no build settings needed.
3. **Set environment variables** in Vercel → Project → Settings → Environment Variables:
   - `DEEPSEEK_API_KEY` — the group's DeepSeek key
   - `DEEPSEEK_MODEL` — `deepseek-v4-flash`
   - `SESSION_SECRET` — any long random string
4. Deploy. Every push to `main` auto-deploys; PRs get preview URLs.

> **Pilot storage caveat:** on Vercel the SQLite database lives in ephemeral `/tmp` storage — it
> re-seeds itself with fresh demo data on each cold start, which is perfect for demos but does
> not persist. For real persistence, swap `src/lib/db.ts` to a hosted database (Turso is the
> most direct fit since it speaks SQLite; Postgres also works).

## MVP feature map

- **Sign up & Login** — invitation-only signup, forgot/reset password, login rate limiting, server-side session revocation
- **Sign out** — with confirmation
- **Onboarding** — guided feature intro → elder profile review + confirm → add observations → all set
- **Elder Preference & Notes** — preference profile + categorized notes (question/update/observation/urgent) with search
- **AI Care Copilot** — chat with suggestion chips, conversation history, personalized answers
- **Condition-Specific Care Playbooks** — 8 reviewed playbooks, surfaced mid-conversation, step check-off, personalized with contraindication notes, browsable library
- **Alerts & Escalation** — pre-generation risk classifier, emergency/warning tiers, history, share-with-family
- **Daily Family Digest** — auto-drafted from the day's notes/alerts/care steps, edit + approve before send, simulated WhatsApp delivery + preview, history
- **Product tracking** — events on every key interaction, visible in the ops tool
- **Internal ops tool** (`/ops`) — elder intake auto-creates the caregiver invitation; pilot roster; event log

## Notes

- Digest delivery is simulated behind a provider seam (`sendDigestAction`) — the WhatsApp
  Business API integration lands there when approved.
- Password reset links are surfaced in-app during the pilot (no email service wired up).
- `data/` (SQLite) is gitignored; delete it to reset to a fresh seeded state.
