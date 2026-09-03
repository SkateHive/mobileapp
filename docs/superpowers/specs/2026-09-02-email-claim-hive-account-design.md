# Email Sign-up: Claim an Existing Hive Account — Design Spec

**Date:** 2026-09-02
**Branch:** `feat/email-claim-hive-account` (mobileapp); API work lands in
`monorepo/services/skatehive-api`
**Status:** Approved design, no implementation
**Inputs:** Pocket's email-OTP flow report (sent to the Maestro, 2026-09-02)
and the Maestri note `identity-claim-api-report` (Backside, 2026-09-02). Line
numbers refer to mobileapp `main` at `ca80ed6` and the API at its current head.

## Goal

A skater who already owns a Hive account and signs up with email should keep
their name. Today the username step says "Already taken on Hive" and the only
way forward is another name.

## Decisions

- When the chosen username **exists on Hive**, the username step offers two
  buttons: **This account is mine** and **Pick another name**.
- **This account is mine** opens a posting-key field **in the same email-login
  screen**, not `hive-login`. The key is validated on device with
  `validate_posting_key` for instant feedback, then sent to a new route
  `POST /api/userbase/auth/signup/claim`.
- On success the app calls `loginWithUserbase` and continues to the existing
  `done` step.
- When the name is **Already reserved** by another email user
  (`userbase_taken`), only **Pick another name** is offered. Merging two
  userbase users is out of scope.
- **Custody moves to the server.** The key is stored encrypted in
  `userbase_hive_keys`; the device stores nothing. The user becomes an email
  account with the Hive account as primary identity, so posts are signed with
  their own key instead of the shared `@skateuser`.

## Current flow

- `app/email-login.tsx` steps `email → otp → username → done` (`type Step`,
  32). `POST /auth/otp/verify` (163, `lib/userbase/api.ts` 45) returns
  `{ signupRequired, signupToken }` for a new email → `username` (174-176).
- While typing, `GET /hive/check-username` debounced 450 ms (85-103, api.ts 68)
  returns `{ valid, available, reason }`; `reason` is "Already taken on Hive"
  or "Already reserved" (`api/userbase/hive/check-username/route.ts` 26-34).
  Shown in red (308-309), **Create account** disabled (319).
- **Create account** → `POST /auth/signup/complete` (194, api.ts 55) →
  `loginWithUserbase` (196) → `done`. The 409s are text only
  (`signup/complete/route.ts` 48-51, 79-82, 99-104).
- `app/hive-login.tsx` (62-79) → `login` in `lib/auth-provider.tsx` (323) runs
  `validate_posting_key` against `posting.key_auths` (`lib/hive-utils.ts`
  376-394) and keeps the encrypted key on device.
- No link or claim flow exists on mobile or in the API; ownership proof is
  web-only and needs a session first (`identity-claim-api-report` item 2).

## API contract

### `POST /api/userbase/auth/signup/complete` (change)

The two 409 responses gain a machine-readable `code`; text stays:

```json
{ "success": false, "error": "That Hive username is already taken", "code": "hive_taken" }
{ "success": false, "error": "That username is already in use",     "code": "userbase_taken" }
```

`check-username` is unchanged; mobile keeps branching on its `reason` strings
before submit and on `code` after.

### `POST /api/userbase/auth/signup/claim` (new)

Request:

```json
{ "signupToken": "<from otp/verify>", "handle": "tonyhawk", "postingKey": "5J..." }
```

Server steps, in order:

1. Verify `signupToken` as `signup/complete` does → `401 expired_token`.
2. Normalise `handle` (trim, lowercase), check the Hive format →
   `400 invalid_handle`.
3. Fetch the account on chain and check the WIF's public key against
   `posting.key_auths` (port of the web `keys/posting` route, 190-215). No
   account or mismatch → `400 invalid_key`; lookup failure →
   `503 chain_unavailable`.
4. Email already an auth method of a different user → `409 merge_required`.
5. `encryptSecret` (`api/lib/userbase/encryption.ts`).
6. One transaction: reuse the `user_id` of an existing `userbase_identities`
   row `type=hive` for `handle`, else create user + identity (`hive`,
   primary). Upsert `userbase_hive_keys`, insert the `email_magic` auth method.
   Unique violation on the auth method → `409 merge_required`.
7. Create a session and respond like `signup/complete`:

```json
{ "success": true, "token": "<bearer>", "user": { "id": "...", "handle": "tonyhawk", "display_name": null, "avatar_url": null } }
```

Rate limit: `429 { code: "rate_limited" }` after 5 attempts per email per
15 minutes and 20 per IP per hour, counted on any non-2xx.

Every error body is `{ success: false, error: <text>, code: <code> }`.

Mobile client: add `claimAccount(signupToken, handle, postingKey)` to
`lib/userbase/api.ts` next to `completeSignup`, returning
`CompleteSignupResult & { code?: string }`.

## Mobile UI

All in `app/email-login.tsx`. `Step` gains `"claim"`. The app has no i18n
layer; copy is inline English like the rest of the screen.

**Username step**, by availability result:

| Result | Below the field | Buttons |
|--------|-----------------|---------|
| available | "✓ Available on Hive" (as today) | Create account |
| reason "Already taken on Hive" | "Already taken on Hive" in `theme.colors.danger` | **This account is mine** (primary), **Pick another name** (text) |
| reason "Already reserved" | "Already reserved by another email user" | **Pick another name** (text; focuses the field) |
| format error / couldn't check | reason as today | Create account disabled |

The 409 `code` from `signup/complete` drives the same two branches when a race
slips past the check.

**Claim step** (`step === "claim"`): title "Prove it's yours", the handle shown
read-only, a `secureTextEntry` posting-key field (`autoCapitalize="none"`,
`autoCorrect={false}`), hint "Your Hive posting key. It is stored encrypted on
SkateHive's server, never on this phone.", **Claim account** (primary, busy
while working) and **Back** (returns to `username`, clears the key).

Submit: `validate_posting_key(handle, key)` on device; a thrown
`InvalidKeyFormatError` / `AccountNotFoundError` / `InvalidKeyError` shows its
message inline without a network call. Then `claimAccount(...)`; on success
`loginWithUserbase(r.token, r.user, email)` (as 196) and `setStep("done")`.

Error copy by `code`: `invalid_key` "That key doesn't match @handle";
`expired_token` "Session expired, request a new code" plus a link back to the
`email` step; `merge_required` "This email is already used by another
SkateHive account"; `rate_limited` "Too many tries, wait a few minutes";
`chain_unavailable` and anything else "Couldn't reach Hive, try again".

## Security

- Rate limit as above; the on-device check keeps typos off the wire.
- The key never reaches a log: the route logs `handle` and `code` only; the
  app never puts it in `console`, error text or a toast.
- The key lives in component state only while the claim step is mounted and
  is cleared in `finally` after submit and on **Back**. Nothing is written to
  SecureStore.
- The result is a userbase session (`kind: 'userbase'`, `decryptedKey: ''`);
  no client-side signing path is enabled.
- Ownership is verified on chain before anything is stored, so a signup token
  alone can never attach to a Hive account.

## Testing

- **API route test** (`skatehive-api`, existing runner, chain lookup mocked):
  valid key on an existing identity attaches the auth method only; valid key
  with no identity creates user + identity + hive_keys + auth method; wrong or
  unknown key → 400 `invalid_key`; expired token → 401; email bound elsewhere
  → 409 `merge_required`; sixth attempt → 429; `signup/complete` 409s carry
  `code`.
- **Mobile:** the branching stays inline in the screen, no reducer, so no
  `tsx` test. `pnpm exec tsc --noEmit` clean.
- **Simulator** (needs a real Hive test account and posting key from the
  user; the agents have none): fresh email + that account's name → two
  buttons; **Pick another name** returns to the field; wrong key → inline
  error, no request; correct key → `done`, then a snap posted from the app is
  signed by the account, not `@skateuser`; same email again with another Hive
  name → `merge_required` copy; a name held by another email user → only
  **Pick another name**.

## Out of scope

- Merging two userbase users (`merge_required` is terminal here).
- Claiming from an already logged-in email account (web-only today).
- Changing `hive-login.tsx` or on-device key custody.
- Active or owner keys; posting key only.
