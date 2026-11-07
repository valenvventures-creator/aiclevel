# Authentication & Authorization

## Providers
- **Production:** Supabase Auth (email/password, email verification, password recovery; magic link and Google/Microsoft/Apple OAuth can be enabled without code changes to the session model). Sessions are httpOnly cookies managed by `@supabase/ssr`; `src/proxy.ts` refreshes them.
- **Demo mode (no Supabase):** identity store (`src/server/auth/identity.ts`) persisted in **Netlify Database** through the shared record store (`src/server/db/records.ts`, table `app_records`, schema in `db/schema.ts`), with scrypt password hashing and an HS256 JWT in an httpOnly, `SameSite=Lax`, `Secure`-in-production cookie (`ta_session`). Because serverless instances share the database, accounts, sessions and the demo organization survive across requests and deploys. Email delivery is simulated: links are shown on screen and labelled. Without `NETLIFY_DB_URL` (unit tests, offline dev, or `TA_STORE=memory`) the store falls back to process memory.
- **Demo organization:** seeded once per database (lock row + completion marker in `app_config`). "Enter the demo C-Suite" signs in without a password check so the shared account cannot be locked out; its password cannot be changed or reset and its sessions cannot be revoked.

Secrets are never stored in localStorage. If `SESSION_SECRET` (≥ 32 chars) is not set, a random signing secret is generated once and stored in the database so every instance verifies the same sessions.

## Flows
| Flow | Implementation |
|---|---|
| Sign up | `signupAction` — Zod (names, email, ≥10-char password with letter+number, confirm, terms, privacy), IP rate limit 5/h, generic duplicate-email message → session → `/onboarding` (or `/invite/[token]`). |
| Log in | `loginAction` — IP 20/15 min + per-account 8/15 min limits, account lockout after 8 failures (demo), constant-time-ish unknown-user path, generic error, `remember` → 30-day cookie else 12h session cookie, safe `next` redirect. |
| Logout | `logoutAction` — clears session + org cookie, audited. |
| Forgot / reset | Always returns the same message (no account enumeration). 30-minute single-use token (hash stored). Reset revokes existing sessions (`sessions_valid_after`). |
| Verify email | Token confirmed by POST button (link scanners can't consume it); resend rate-limited 3/h. Unverified users can use the product but cannot invite members or connect integrations. |
| Invitations | 7-day token, SHA-256 hash stored, role ≤ inviter's assignable roles, email must match, membership created only in the invitation's organization, audited. |

## Authorization
`src/server/auth/permissions.ts` defines ~35 capabilities and a role → capability map:
- **OWNER:** everything, including org deletion, ownership transfer, billing, CEO Leadership Intelligence.
- **ADMIN:** administration except protected owner actions; cannot create Owners/Admins.
- **EXECUTIVE:** broad operational access (verify memory, approve decisions/approvals, manage projects).
- **MEMBER:** standard usage.
- **ADVISOR:** restricted collaboration (use executives, comms) — no team list, no memory writes.
- **VIEWER:** read-only.

Every server action / route handler calls `authorize(capability)` (or `requireContext()` for reads), which resolves the user and organization **server-side**. UI hiding is cosmetic only.

## Audit events
login, logout, failed login, signup, password change/reset, invite, invite accepted, role change, member removal, org/constitution update, executive configuration, prompt publication, provider/credential change, memory create/edit/verify/archive/delete, file upload/delete, session create/run, report creation, Studio job/revision, approval actions, CEO intelligence changes, comms send.

## Account lifecycle (architected)
User deletion removes the profile and memberships but never shared organization data. Organization deletion and ownership transfer are Owner-only, audited, service-role operations. Data export is an Owner job producing JSON + files.
