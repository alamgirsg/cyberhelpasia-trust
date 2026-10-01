# CyberHELP Asia Trust Platform

One platform, two modules, built for the Singapore market:

- **Module 1 — Cyber Trust Readiness** (this MVP): get organisations ready for CSA's Cyber Essentials and Cyber Trust marks.
- **Module 2 — AI Assurance** (next phase): AI use-case inventory, risk scoring and LLM red-teaming mapped to MAS and IMDA expectations.

## What works today (Module 1 MVP)

| Feature | Status |
| --- | --- |
| Sign-up creates a company workspace (tenant) with an Owner | ✅ |
| Email + password login, signed session cookie (12 h), route protection | ✅ |
| Two-step verification (TOTP, RFC 6238) with QR enrolment, replay protection and 8 one-time recovery codes | ✅ |
| Login rate limiting (per email and per IP) | ✅ |
| Team invites by single-use link (7-day expiry), role changes, member removal, last-owner protection | ✅ |
| Users in several workspaces, with a workspace switcher | ✅ |
| Risk-profile wizard that recommends Cyber Essentials or Cyber Trust (with reasons, overridable) | ✅ |
| Control library: 10 Cyber Essentials controls, 22 Cyber Trust domains, indicative ISO 27001:2022 refs | ✅ draft content |
| Gap assessment: status + notes per control, guidance and evidence hints | ✅ |
| Automatic remediation: gaps create tasks (priority + due date); fixing a control closes them | ✅ |
| Evidence vault: type allowlist, 10 MB limit, SHA-256 hash, tenant-checked download | ✅ |
| Readiness score overall and by domain; dashboard shows weakest domains | ✅ |
| Printable readiness report (save as PDF from the browser) | ✅ |
| Activity log of logins, answers, task changes, uploads and downloads | ✅ |
| Roles: owner / admin / contributor / viewer (viewer is read-only) | ✅ |

## Content notice — read before showing to customers

The control titles and guidance are **CyberHELP's own paraphrased wording**, not CSA text. SS 712:2025 is a paid standard.
Before customer use:

1. Buy SS 712:2025 and verify each domain and control against it.
2. Add tier applicability (CTM Levels 1–5) per control.
3. Check ISO/IEC 27001:2022 references against CSA's official mapping.

Content lives in `src/content/frameworks.ts`; re-run `npm run db:seed` after editing.

## Run locally (no database install needed)

```bash
npm install
cp .env.example .env      # then empty DATABASE_URL to use the embedded PGlite database
npm run db:setup          # migrations + control library
npm run dev               # http://localhost:3000
```

With `DATABASE_URL` empty the app uses an embedded PGlite database in `./.data` (development only).

## Deploy on the VPS with Docker

```bash
cat > .env <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SESSION_SECRET=$(openssl rand -base64 48)
MFA_ENC_KEY=$(openssl rand -base64 48)
EOF
docker compose up -d --build
```

The app listens on `127.0.0.1:3000`; put Caddy or Nginx in front for HTTPS, e.g. with Caddy:

```
trust.cyberhelpasia.com {
  reverse_proxy 127.0.0.1:3000
}
```

For production customer data, host in a Singapore region (see the PRD).

## Project layout

```
src/content/frameworks.ts   control library (CE + CTM)
src/db/schema.ts            Drizzle schema (tenants, users, assessments, tasks, evidence, audit)
src/app/actions/            server actions (auth, assessments, evidence)
src/app/app/                signed-in workspace pages
src/lib/                    session, auth context, scoring, recommendation logic
drizzle/                    SQL migrations
scripts/                    migrate + seed
```

## Security notes

- Every query is filtered by `tenant_id` from the server-side session; cross-tenant access returns 404 (tested).
- Passwords: bcrypt cost 12, minimum 12 characters. Unknown emails get the same timing as wrong passwords.
- MFA secrets are AES-256-GCM encrypted with a key derived from `MFA_ENC_KEY`; recovery codes and invite tokens are stored only as SHA-256 hashes.
- After the password step, a 5-minute "MFA pending" token is issued; it cannot be used as a session.
- Rate limits are in memory (one app instance). Move them to Redis before running several instances.
- Invite links are shown to the admin to send; email delivery is a later step.
- Evidence files are stored under random names (never the client file name) with mode 0600.
- Security headers: X-Frame-Options DENY, nosniff, strict referrer policy.

## Next steps

1. Email delivery for invites and security alerts
2. AI policy generator with human approval
3. Auditor pack ZIP export (report + evidence)
4. PostgreSQL row-level security as a second isolation layer
5. S3-compatible evidence storage (Singapore region)
6. Module 2: AI Assurance

## Tests

Playwright (Python) end-to-end tests:

- `tests/e2e_smoke.py` (13 checks): sign-up, risk profile, gap assessment, automatic tasks, evidence upload/download,
  report, activity log, tenant isolation, login/logout.
- `tests/e2e_team_mfa.py` (19 checks): MFA enrolment, TOTP login, replay rejection, single-use recovery codes, invites,
  roles, viewer read-only, last-owner protection, joining a second workspace with MFA, workspace switching.

```bash
pip install playwright && playwright install chromium
BASE=http://localhost:3000 python tests/e2e_smoke.py
BASE=http://localhost:3000 python tests/e2e_team_mfa.py
```
