import { AgentPrompt } from "@/components/AgentPrompt";
import { Code, Endpoint } from "@/components/docs";

const FOUNDATION_AGENT_PROMPT = `
Set up the foundation for integrating Pulse Rewards (a gamification API
for sweepstakes sites) into this codebase. This is plumbing only - the
feature integrations (wheel, streaks) build on top of it and have their
own prompts on their docs pages.

## Non-negotiable rules
1. Secrets PULSE_API_KEY ("prw_...") and PULSE_WEBHOOK_SECRET are
   backend-only env vars: never in frontend bundles, browser requests,
   or client-exposed config.
2. All Pulse traffic is server-to-server against
   https://api.playwithpulse.com with header
   "Authorization: Bearer <PULSE_API_KEY>".
3. Player value lives in OUR wallet. Pulse pays via signed grants that
   we verify, apply idempotently, and acknowledge - never credit from
   anything else.

## Build these pieces
A. A small backend Pulse client module: base URL + auth header from
   env, JSON in/out, surfaces HTTP errors with their response bodies
   (Pulse error semantics: 401 bad key, 402 quota, 403 feature not in
   plan, 404 unknown id, 409 nothing to consume, 422 validation with
   reasons). Every POST helper accepts an idempotency_key parameter and
   callers must pass a UUID minted per user action.
B. The grant outbox worker (cron/loop, every 30-60s):
   1) GET /v1/outbox -> {"grants": [g, ...]}
   2) For each grant g: verify signature. payload = g minus its
      "grant_id" and "signature" fields; canonical = JSON serialization
      with keys sorted, separators ("," ":"), no whitespace; expected =
      hex HMAC-SHA256(key=PULSE_WEBHOOK_SECRET, msg=canonical);
      constant-time compare to g["signature"]. On failure: log loudly,
      do NOT ack, do NOT credit.
   3) Apply verified grants to our wallet idempotently keyed by
      g["grant_id"] (a processed-grants table or unique constraint).
      Kind "fixed": credit g["amount"] (integer, our smallest unit) of
      g["currency"]. Kind "percent": persist {applies_to, basis_points}
      for our purchase/bonus flow to consume later.
   4) POST /v1/outbox/{grant_id}/ack. Only after the wallet write
      committed.
C. A usage monitor (optional but cheap): GET /v1/usage daily and alert
   if tokens_remaining < 10% of included_tokens.

## Acceptance checklist
- [ ] Secrets absent from all built frontend assets (grep the bundles).
- [ ] Outbox worker survives: duplicate deliveries (no double-credit),
      a tampered signature (rejected + alerted), and a crash between
      credit and ack (redelivery is absorbed by grant_id idempotency).
- [ ] Pulse errors surface as typed/structured errors, not generic 500s.
Ask me for: the env var values, our wallet credit function/location,
and where scheduled jobs live in this codebase.
`;

export default function GettingStarted() {
  return (
    <>
      <h1>Getting Started</h1>
      <p className="lede">
        Pulse adds casino-grade gamification to your sweepstakes site — wheel
        spins, login streaks, and more — through one server-to-server API and
        a drop-in widget. Your team keeps full control of player identity and
        the wallet; Pulse runs the mechanics and the math.
      </p>

      <h2>How it fits together</h2>
      <table>
        <thead>
          <tr><th>Party</th><th>Runs</th><th>Holds</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Pulse</strong></td>
            <td>the mechanics, odds, and audit trail</td>
            <td>gamification state and draw history</td>
          </tr>
          <tr>
            <td><strong>Your backend</strong></td>
            <td>player identity and your wallet</td>
            <td>your API key and webhook secret</td>
          </tr>
          <tr>
            <td><strong>Your frontend</strong></td>
            <td>the widgets</td>
            <td>nothing</td>
          </tr>
        </tbody>
      </table>
      <div className="callout">
        <strong>The two rules.</strong> Your API key never reaches a browser —
        every Pulse call comes from your backend. And Pulse never touches your
        wallet — wins arrive as cryptographically signed grants that your
        backend verifies, applies, and acknowledges. A tampered frontend can
        only lie to its own screen; it cannot spin, win, or grant.
      </div>

      <h2>Authentication</h2>
      <p>
        Your onboarding contact provisions your account and delivers an API
        key and a webhook secret (each shown exactly once — store them in your
        secret manager). Every request:
      </p>
      <Code>{`
Authorization: Bearer prw_your_api_key
      `}</Code>
      <p>
        Base URL: <code>https://api.playwithpulse.com</code>. Interactive
        endpoint reference: <a href="https://api.playwithpulse.com/docs">api.playwithpulse.com/docs</a>.
      </p>

      <h2>Getting paid: the grant outbox</h2>
      <p>
        Every player win — any feature — becomes a signed grant. Poll the
        outbox, verify, credit your wallet, then acknowledge:
      </p>
      <Endpoint method="GET" path="/v1/outbox" />
      <Endpoint method="POST" path="/v1/outbox/{grant_id}/ack" />
      <p>Two grant kinds:</p>
      <ul>
        <li>
          <code>fixed</code> — <code>{`{currency, amount}`}</code>: credit the
          player. Amounts are integers in <em>your</em> smallest unit; the
          currency label ("SC", "GC") is yours, Pulse never prices it.
        </li>
        <li>
          <code>percent</code> — <code>{`{applies_to, basis_points}`}</code>:
          e.g. <code>next_purchase</code> at <code>1000</code> bp = a 10%
          bonus your system applies. Pulse never sees the base amount.
        </li>
      </ul>
      <h3>Verify every grant</h3>
      <p>
        HMAC-SHA-256 over the canonical JSON payload with your webhook secret:
      </p>
      <Code>{`
# python
import hashlib, hmac, json

def verify(grant: dict, webhook_secret: str) -> bool:
    payload = {k: grant[k] for k in grant if k not in ("grant_id", "signature")}
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    expected = hmac.new(webhook_secret.encode(), canonical.encode(),
                        hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, grant["signature"])
      `}</Code>
      <Code>{`
// node
const crypto = require("crypto");
function verify(grant, webhookSecret) {
  const { grant_id, signature, ...payload } = grant;
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const expected = crypto.createHmac("sha256", webhookSecret)
    .update(canonical).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
      `}</Code>
      <p>
        Apply grants idempotently by <code>grant_id</code> — the outbox
        redelivers until acked.
      </p>

      <h2>Idempotency</h2>
      <p>
        Every mutating endpoint accepts an <code>idempotency_key</code>. Mint
        one UUID per user action; replays return the original response
        byte-for-byte and never double-charge, double-grant, or double-meter.
      </p>

      <h2>Errors</h2>
      <table>
        <thead><tr><th>Code</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr><td>401</td><td>bad or rotated API key</td></tr>
          <tr><td>402</td><td>plan quota exhausted (refused before any state changed)</td></tr>
          <tr><td>403</td><td>feature not in your plan</td></tr>
          <tr><td>404</td><td>unknown feature id</td></tr>
          <tr><td>409</td><td>nothing to consume (e.g. a spin with no spins granted)</td></tr>
          <tr><td>422</td><td>invalid request body (response lists exact reasons)</td></tr>
        </tbody>
      </table>

      <h2>Next steps</h2>
      <p>
        Start with <a href="/wheel">Wheel Spins</a> — it exercises the whole
        foundation (grants in, spins, signed grants out) and every later
        feature reuses the same plumbing.
      </p>

      <AgentPrompt prompt={FOUNDATION_AGENT_PROMPT} />
    </>
  );
}
