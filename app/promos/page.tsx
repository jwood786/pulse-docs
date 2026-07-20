import { AgentPrompt } from "@/components/AgentPrompt";
import { Code, Endpoint } from "@/components/docs";

const PROMO_AGENT_PROMPT = `
Integrate the Pulse Rewards "Promo Codes" feature into this codebase. Pulse
is a gamification API for sweepstakes sites. Follow this architecture exactly
- it is a hard security contract.

## Non-negotiable rules
1. The Pulse API key (env PULSE_API_KEY, "prw_...") is backend-only: never in
   frontend bundles or browser requests. The player types a code into OUR UI;
   OUR backend calls Pulse. The browser never talks to Pulse.
2. Redemption's rewards[] is a manifest, not a payment. Each row settles by
   its own path and ONLY that path:
   - {type:"currency", ...} -> a signed grant lands in the outbox; verify,
     credit the wallet, ack - identical to wheel/streak wins.
   - {type:"free_spins", wheel_id, count} -> open spins added on Pulse's side;
     just refresh the wheel UI. No wallet credit.
   - {type:"raffle_tickets", raffle_id, count} -> Pulse's ticket ledger only.
     NO grant, NO wallet credit, render a toast.
3. Never invent or validate codes locally. POST to Pulse and render its
   answer; 404/409 map to friendly errors.
4. Every redeem sends an idempotency_key (UUID per submit).

## Pulse API (base https://api.playwithpulse.com, header
## "Authorization: Bearer <PULSE_API_KEY>")
- POST /v1/promos/{code}/redeem   {player_id, idempotency_key}
    -> {status:"redeemed", code, campaign_id, rewards:[...]}
    404 unknown code | 409 unavailable: inactive, expired, not started,
    fully redeemed, per-player limit reached, wrong player (unique codes),
    already redeemed. 409 detail is human-readable - surface it politely.
    Only a SUCCESSFUL redemption is billed; failed attempts cost nothing.
- POST /v1/promos/{campaign_id}/issue   {player_id}
    -> {code: "campaign-XXXXXX"}   (unique campaigns only: mints a
    single-use code bound to that player - for OUR promo emails/CRM sends)
- GET /v1/promos/{id} -> {binding, reward, max_redemptions, per_player_limit,
    starts_at, expires_at, active, redemptions, remaining}

## Build these pieces
A. Backend POST /api/pulse/promo/redeem (player authenticated): mint a UUID
   idempotency key, call Pulse with the player's stable id and the trimmed,
   uppercased code. Map: 404 -> "That code doesn't exist", 409 -> the detail
   text, 200 -> the rewards[] summary.
B. A "Redeem a code" input in the player's rewards/wallet area: text field +
   submit, disabled while in flight; on success show one toast per rewards[]
   row using its label ("+50 SC", "+5 Free Spins", "+3 Raffle Tickets"), then
   refresh wallet/wheel/raffle widgets so the new balances show.
C. Settlement: NOTHING new. Currency rows arrive in the same outbox worker
   as every Pulse feature (verify HMAC, credit idempotently by grant_id,
   ack). Free spins and tickets require no settlement.

## Acceptance checklist
- [ ] Redeeming a valid code twice: first succeeds, second shows the 409
      detail; exactly one wallet credit.
- [ ] Replaying the same idempotency_key returns the identical body.
- [ ] free_spins and raffle_tickets rows create NO wallet credit and NO
      outbox activity.
- [ ] A 404/409 from Pulse renders a friendly message, not an error page.
- [ ] No PULSE_API_KEY in built frontend assets.
Ask me for: PULSE_API_KEY, our configured promo ids, the player id mapping,
and where the wallet credit function lives.
`;

export default function PromoDocs() {
  return (
    <>
      <h1>Promo Codes</h1>
      <p className="lede">
        A redeemable code that hands out a reward — bonus currency, free wheel
        spins, raffle tickets, or any combination. <strong>Redemption is the
        one money movement;</strong> the code itself is just an entitlement,
        and cost is bounded by exact caps, not odds.
      </p>

      <h2>Two bindings, one engine</h2>
      <ul>
        <li><strong>shared</strong> — one public code; the id <em>is</em> the
          code (<code>WELCOME50</code>). Print it anywhere.</li>
        <li><strong>unique</strong> — a campaign that mints per-player,
          single-use codes on demand — built for &quot;send player123 a
          personal comeback code&quot; flows:</li>
      </ul>
      <Endpoint method="POST" path="/v1/promos/{campaign_id}/issue" />
      <Code>{`
{"player_id": "..."}  ->  {"code": "reactivation-9F3K2A"}
      `}</Code>

      <h2>Redeeming</h2>
      <Endpoint method="POST" path="/v1/promos/{code}/redeem" />
      <Code>{`
{"player_id": "...", "idempotency_key": "uuid-per-submit"}

-> {"status": "redeemed", "code": "WELCOME50", "campaign_id": "WELCOME50",
    "rewards": [
      {"type": "currency", "currency": "SC", "amount": 5000,
       "label": "50 SC Welcome"},                              // -> signed grant, outbox
      {"type": "free_spins", "wheel_id": "daily", "count": 5}, // -> open spins, no credit
      {"type": "raffle_tickets", "raffle_id": "weekly_draw",
       "count": 3}                                             // -> ticket ledger, NO grant
    ]}
      `}</Code>
      <p>
        The player types the code into <em>your</em> UI; your backend calls
        Pulse. <code>404</code> = unknown code; <code>409</code> = real code
        that can&apos;t be redeemed now (inactive, expired, fully redeemed,
        per-player limit, wrong player) with a human-readable reason.
      </p>
      <div className="callout info">
        <strong><code>rewards[]</code> is a manifest, not a payment.</strong>{" "}
        Currency settles through the <a href="/">outbox</a> exactly like a
        wheel or streak win; free spins appear as open spins on the named
        wheel; <a href="/raffles">raffle</a> tickets are earned only — no
        grant, never credit them. One toast per row, then refresh the widgets.
      </div>

      <h2>Cost is capped, not probabilistic</h2>
      <p>
        A promo&apos;s ceiling is exactly{" "}
        <code>max_redemptions × reward</code> — plus <code>per_player_limit</code>{" "}
        and an optional start/expiry window. Failed attempts (404/409) are
        never billed; only successful redemptions meter. So a launch code can
        be printed on a billboard with a known worst case.
      </p>

      <h2>Reads</h2>
      <Code>{`
GET /v1/promos/{id}
-> {binding, reward, max_redemptions, per_player_limit,
    starts_at, expires_at, active, redemptions, remaining}
      `}</Code>

      <h2>Endpoint summary</h2>
      <table>
        <thead><tr><th>Endpoint</th><th>Purpose</th><th>Billable</th></tr></thead>
        <tbody>
          <tr><td><code>POST /v1/promos/{"{code}"}/redeem</code></td><td>redeem a code</td><td>yes (1 token, successful only)</td></tr>
          <tr><td><code>POST /v1/promos/{"{id}"}/issue</code></td><td>mint a per-player code</td><td>no</td></tr>
          <tr><td><code>GET /v1/promos/{"{id}"}</code></td><td>config + redemption stats</td><td>no</td></tr>
        </tbody>
      </table>

      <div className="callout info">
        Codes, rewards, caps, and windows are authored in Pulse Studio&apos;s
        Promo Codes tab (or with the Pulse team). Your integration is the
        redeem call — and, for unique campaigns, issue.
      </div>

      <AgentPrompt prompt={PROMO_AGENT_PROMPT} />
    </>
  );
}
