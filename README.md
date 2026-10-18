# CyberHELP Asia Trust Platform

One platform, two modules, built for the Singapore market:

- **Module 1 — Cyber Trust Readiness** (this MVP): get organisations ready for CSA's Cyber Essentials and Cyber Trust marks.
- **Module 2 — AI Assurance** (preview): AI system inventory, explainable risk rating, an AI governance assessment, and authorised manual **and automated** LLM red-teaming.

## What works today (Module 1 MVP)

| Feature | Status |
| --- | --- |
| Sign-up creates a company workspace (tenant) with an Owner | ✅ |
| Email + password login, signed session cookie (12 h), route protection | ✅ |
| Two-step verification (TOTP, RFC 6238) with QR enrolment, replay protection and 8 one-time recovery codes | ✅ |
| Login rate limiting (per email and per IP) | ✅ |
| Team invites by single-use link (7-day expiry), role changes, member removal, last-owner protection | ✅ |
| Invite and password-reset emails sent over SMTP when configured (otherwise the link is shown to copy) | ✅ |
| Self-serve password reset by emailed single-use link (1-hour expiry); no account enumeration | ✅ |
| Security-alert emails to the account holder: sign-in from a new IP, two-step turned off, password changed or reset | ✅ |
| Account settings: change display name and password (current password required) | ✅ |
| Users in several workspaces, with a workspace switcher | ✅ |
| Risk-profile wizard that recommends Cyber Essentials or Cyber Trust (with reasons, overridable) | ✅ |
| Control library: 10 Cyber Essentials controls, 22 Cyber Trust domains, indicative ISO 27001:2022 refs | ✅ draft content |
| Gap assessment: status + notes per control, guidance and evidence hints | ✅ |
| Automatic remediation: gaps create tasks (priority + due date); fixing a control closes them | ✅ |
| Evidence vault: type allowlist, 10 MB limit, SHA-256 hash, tenant-checked download | ✅ |
| Evidence storage on local disk (default) or an S3-compatible bucket (AWS S3, R2, B2, MinIO) — e.g. AWS `ap-southeast-1` for Singapore data residency | ✅ |
| Readiness score overall and by domain; dashboard shows weakest domains | ✅ |
| Printable readiness report (save as PDF from the browser) | ✅ |
| Auditor pack ZIP: report, controls/tasks/activity CSVs, evidence by control, SHA-256 manifest with tamper check | ✅ |
| Policies: 9 policy types mapped to controls; draft from template or with Claude (per-workspace opt-in), edit with preview, owner/admin approval, versioning | ✅ |
| Approved policies filed automatically as evidence for their controls, including in assessments created later | ✅ |
| Activity log of logins, answers, task changes, uploads and downloads | ✅ |
| Roles: owner / admin / contributor / viewer (viewer is read-only) | ✅ |

## AI Assurance (Module 2, preview)

| Feature | Status |
| --- | --- |
| AI system inventory (owner, vendor, model, status) with CSV export | ✅ |
| Explainable risk rating from 6 questions (use, autonomy, tools, data, outside input, scale), live preview, written reasons | ✅ |
| Owner/admin override with a required justification; stale overrides cleared when answers change the rating | ✅ |
| Review cadence by rating (high 6, medium 12, low 24 months) with overdue flags | ✅ |
| Suggested security test areas from the OWASP Top 10 for LLM Applications (2025) | ✅ |
| AI governance assessment: 15 paraphrased controls across MAS's proposed AIRM areas, reusing tasks, evidence and the auditor pack | ✅ draft content |
| Authorised manual red-team engagements: scope, authorisation record, test checklist, findings with evidence, report filed as AIG-09 evidence | ✅ |
| Authorised **automated** LLM red-team runner: ownership-verified target, egress-locked probes mapped to OWASP LLM Top 10, failures become findings | ✅ |

### Automated red-team runner — safety model

The runner can only ever test an endpoint the customer controls, and can never be used to reach
anything else. Every run is gated on all of the following:

1. **Authorisation** — it runs inside an engagement, which already requires an owner/admin to
   confirm authorisation on the record. Configuring and running are owner/admin only.
2. **Ownership verification** — the customer must serve a generated token at
   `https://<target-host>/.well-known/cyberhelp-trust-verification.txt`. A run is allowed only
   after that check passes, and ownership is **re-checked at run time** (a stale verification
   blocks the run).
3. **Egress lockdown** (`src/lib/redteam/ssrf.ts`) — https only; the host must resolve to a
   public address, re-validated at socket-connect time (closes DNS rebinding); private,
   loopback, link-local and cloud-metadata addresses are refused; redirects are refused; time
   and response size are capped; the run has a hard request budget.
4. **Benign probes only** (`src/lib/redteam/probes.ts`) — canary- and planted-fake-secret
   checks for prompt injection (direct/indirect/authority), data-protection, output handling and
   excessive agency, each mapped to an OWASP LLM Top 10 (2025) ID. **No** real harmful or
   jailbreak payloads ship with it; content-safety red-teaming stays human-designed.

A test-only flag, `REDTEAM_ALLOW_INSECURE_TARGETS=1`, additionally allows a **loopback** target
so the e2e suite can point the runner at a local mock — it never relaxes the private/metadata
guards. It defaults off and must never be set in production.

The risk heuristic is CyberHELP's own, not a regulatory formula. MAS's AI risk guidelines were still being finalised
when this was written; verify the AI governance controls (`src/content/ai-governance.ts`) against the final text.

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

### Demo workspace

```bash
npm run db:demo
```

Spins up a fully-populated demo tenant ("Marina Bay Diagnostics Pte Ltd") for a live sales walk-through:
a Cyber Trust assessment with a realistic spread of answers and remediation tasks, evidence, an approved
policy, three AI systems (low/medium/high), an AI governance assessment, and a completed red-team
engagement with findings. Re-running resets it, so the printed login (`demo@cyberhelpasia.com`) always
works. It only touches the demo tenant.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string; empty uses embedded PGlite (dev only) |
| `SESSION_SECRET` | signs the session cookie (required) |
| `MFA_ENC_KEY` | derives the AES-256-GCM key for MFA secrets (required) |
| `APP_URL` | public base URL, used to build invite and reset links (e.g. `https://trust.cyberhelpasia.com`) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | enable AI policy drafting (optional; drafting is also off per workspace until an owner turns it on) |
| `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | outbound email; if unset, invite and reset links are shown in-app to copy instead of emailed |
| `UPLOAD_DIR` | evidence storage directory |

### Operational endpoints

- `GET /healthz` — liveness + database check (`{"status":"ok"}`, or 503 when the database is unreachable)
- `/robots.txt` — disallows `/app/`
- `/sitemap.xml`, `/.well-known/security.txt` (RFC 9116)

## Deploy on the VPS with Docker

The stack (app + PostgreSQL + one-off migrate job) uses the fixed Compose project name `cyberhelpasia-trust`,
so its containers and volumes never clash with other sites on the same server. PostgreSQL is not exposed; the
app listens on `127.0.0.1:${APP_PORT:-3010}`.

```bash
git clone https://github.com/alamgirsg/cyberhelpasia-trust /opt/cyberhelpasia-trust
cd /opt/cyberhelpasia-trust
umask 077
{
  echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
  echo "SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')"
  echo "MFA_ENC_KEY=$(openssl rand -base64 48 | tr -d '\n')"
  echo "APP_PORT=3010"
  echo "ANTHROPIC_API_KEY="
} > .env
docker compose up -d --build
```

Add your Anthropic key to `.env` on the server only (never in chat or git). Back up `.env` somewhere safe:
losing `MFA_ENC_KEY` means every user must set up two-step verification again.

### HTTPS with the Caddy that already runs on the VPS

**Caddy installed on the host:** add a site block and reload Caddy.

```
trust.cyberhelpasia.com {
  reverse_proxy 127.0.0.1:3010
}
```

**Caddy running in Docker:** attach the app to Caddy's network, then proxy to the alias `trust-app`.

```bash
echo "CADDY_NETWORK=<caddy network name>" >> .env
docker compose -f docker-compose.yml -f docker-compose.caddy-network.yml up -d
```

```
trust.cyberhelpasia.com {
  reverse_proxy trust-app:3000
}
```

DNS: add an `A` record `trust` → the VPS IP address in the DNS zone of `cyberhelpasia.com`. Caddy obtains the
certificate automatically once the name resolves.

Update: `git pull && docker compose up -d --build` (migrations run automatically). For production customer data,
host in a Singapore region (see the PRD).

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
- Password reset: tokens are stored only as SHA-256 hashes, expire in 1 hour and are single-use; completing a reset
  clears the session cookie. The "forgot password" form returns the same message whether or not the account exists
  (no enumeration) and is rate limited per email.
- Invite and reset links are emailed when SMTP is configured; otherwise the link is shown in-app to send manually.
- Auditor pack: every evidence file is re-hashed on export and compared with the hash taken at upload; mismatches are flagged
  in the manifest, README and report. CSV cells starting with = + - @ are prefixed with ' to block formula injection.
- AI drafting is off per workspace until an owner/admin turns it on. Only the fields on the draft form and the
  policy outline are sent; organisation details are fenced in the prompt as data. Output is stripped of HTML and
  rendered without `dangerouslySetInnerHTML`, so script in AI output or edits is shown as text. Nothing is approved
  without a person: only owners/admins can approve, and they approve exactly the text on screen.
- Before enabling AI for customers, confirm your Anthropic data-retention terms and say in your privacy notice that
  Anthropic processes draft-form inputs.
- Evidence files are stored under random names (never the client file name) with mode 0600.
- Security headers: X-Frame-Options DENY, nosniff, strict referrer policy.
- Security-alert emails go to the account holder on a sign-in from a new IP, two-step being turned
  off, or a password change/reset — best-effort (quiet no-op if email isn't configured, and never
  blocking the action). The first sign-in sets the IP baseline silently.

## Backups

`scripts/backup.sh` takes a timestamped, gzipped `pg_dump` of the database (reached inside the `db`
container, which is never exposed off the Docker network) and keeps the newest `RETAIN` (default 14).

```bash
./scripts/backup.sh                 # writes backups/trust-YYYYMMDD-HHMMSS.sql.gz
# restore one:
gunzip -c backups/trust-YYYYMMDD-HHMMSS.sql.gz | docker compose exec -T db psql -U trust -d trust
```

Schedule it daily with cron on the VPS (run from the project directory), and copy the `backups/`
folder off the box (or to object storage) so a host failure can't take the backups with it:

```cron
30 2 * * * cd /path/to/cyberhelpasia-trust && ./scripts/backup.sh >> backups/backup.log 2>&1
```

## Next steps

1. PostgreSQL row-level security as a second isolation layer (needs a request-scoped tenant GUC)
2. Shared rate-limit store (Redis) for multi-instance deployments
3. Off-site backup shipping (the local routine above is in place)
4. Billing and plans

## Tests

Playwright (Python) end-to-end tests:

- `tests/e2e_smoke.py` (13 checks): sign-up, risk profile, gap assessment, automatic tasks, evidence upload/download,
  report, activity log, tenant isolation, login/logout.
- `tests/e2e_team_mfa.py` (19 checks): MFA enrolment, TOTP login, replay rejection, single-use recovery codes, invites,
  roles, viewer read-only, last-owner protection, joining a second workspace with MFA, workspace switching.
- `tests/e2e_policies.py` (15 checks): runs a fake Claude API and checks AI opt-in, exactly what is sent, prompt fencing,
  output cleaning, provider errors, contributor limits, XSS-safe preview, approval, evidence filing, versioning.
  Start the app with `ANTHROPIC_API_KEY=test-key ANTHROPIC_BASE_URL=http://localhost:4010`.
- `tests/e2e_engagements.py` (8 checks): authorisation gate, scope record, checklist, findings with evidence, viewer limits,
  complete → AIG-09 evidence and auditor pack, isolation.
- `tests/e2e_runner.py` (9 checks): the automated runner against a local mock LLM — ownership
  verification (fails until the token is served), run disabled until verified, a vulnerable
  endpoint producing findings, a hardened endpoint clearing them, SSRF refusals (metadata /
  private / non-https), and owner/admin-only access. Start the app with
  `REDTEAM_ALLOW_INSECURE_TARGETS=1`.
- `tests/e2e_ai.py` (14 checks): AI inventory, live and stored risk rating, server-side validation, override with reason,
  re-rating clears stale overrides, review, CSV export with formula guard, AI governance assessment, roles, isolation.
- `tests/e2e_export.py` (10 checks): auditor pack contents, duplicate file names, formula-injection guard, tamper detection,
  activity log entry, 401/404 isolation. Needs the same `UPLOAD_DIR` as the server.
- `tests/e2e_account.py` (8 checks): `/healthz`, robots and security.txt, invite email captured and accepted via the
  emailed link, forgot-password no-enumeration, reset link single-use, account rename and password change. Start the app
  with `EMAIL_CAPTURE_FILE` (a writable path) and `APP_URL` so the test can read captured mail and follow the links.

- `tests/e2e_alerts.py` (5 checks): security-alert emails — a sign-in from a new IP alerts (and the
  first sign-in sets the baseline silently), and password change, two-step turn-off and password
  reset each alert the owner. Start the app with `EMAIL_CAPTURE_FILE` and `APP_URL`.

- `tests/e2e_storage.py` (3 checks): runs a mock S3 endpoint and checks that evidence uploads write
  the exact bytes to the bucket, the auditor pack reads them back with integrity verified, and direct
  download streams from the bucket. Start the app with `STORAGE_DRIVER=s3` and the `S3_*` vars.

104 checks across the ten suites.

```bash
pip install playwright && playwright install chromium
BASE=http://localhost:3000 python tests/e2e_smoke.py
BASE=http://localhost:3000 python tests/e2e_team_mfa.py
BASE=http://localhost:3000 UPLOAD_DIR=./uploads python tests/e2e_export.py
BASE=http://localhost:3000 UPLOAD_DIR=./uploads python tests/e2e_policies.py
BASE=http://localhost:3000 python tests/e2e_ai.py
BASE=http://localhost:3000 python tests/e2e_engagements.py
REDTEAM_ALLOW_INSECURE_TARGETS=1 BASE=http://localhost:3000 python tests/e2e_runner.py
EMAIL_CAPTURE_FILE=/tmp/mail.jsonl BASE=http://localhost:3000 python tests/e2e_account.py
EMAIL_CAPTURE_FILE=/tmp/mail.jsonl BASE=http://localhost:3000 python tests/e2e_alerts.py
S3_MOCK_PORT=4570 BASE=http://localhost:3000 python tests/e2e_storage.py
```

Start the server with a matching `EMAIL_CAPTURE_FILE` and `APP_URL` for the account suite, with
`ANTHROPIC_API_KEY=test-key ANTHROPIC_BASE_URL=http://localhost:4010` for the policies suite, and with
`REDTEAM_ALLOW_INSECURE_TARGETS=1` for the runner suite (test-only; never set it in production). Sign-up is rate limited
to 10 per hour per IP; restart the server between full runs of all suites.
