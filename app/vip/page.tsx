import { AgentPrompt } from "@/components/AgentPrompt";
import { Code, Endpoint } from "@/components/docs";

const VIP_AGENT_PROMPT = `
Integrate the Pulse "VIP & RakeBack" feature into this codebase. Pulse is a
gamification API for sweepstakes sites. Follow this architecture exactly -
it is a hard security contract.

## Non-negotiable rules
1. PULSE_API_KEY is backend-only; all Pulse calls go frontend -> our
   backend -> Pulse. The browser never talks to Pulse.
2. The tier and every bonus amount are COMPUTED BY PULSE. Never calculate
   tiers, progress, GGR, or rakeback locally - render what the API returns.
3. rewards[] on a claim is a manifest: currency rows settle via the signed
   grant outbox (same worker as every Pulse feature); free_spins add open
   spins; raffle_tickets are ledger-only (no credit, toast only).
4. GGR needs both sides of the ledger: we must report wins as events.

## Pulse API (base https://api.playwithpulse.com,
## "Authorization: Bearer <PULSE_API_KEY>")
- POST /v1/events  {"player_id", "type": "wager"|"win"|"purchase",
    "value": <smallest units>, "idempotency_key": <unique per round/order>}
    Tiers accrue from wagers; GGR = wagers - wins; LTV from purchases.
    If we already send wager events, ADD win events (and purchase if absent).
- GET /v1/vip/players/{player_id}
    -> {tier, tier_index, wagered, tiers:[{name, threshold}], next_tier,
        needed, progress_pct,
        benefits:[{tier, cadence, period_id, reward, rakeback?, eligible,
                   activity_ok, claimed, claimable, ...}]}
    rakeback (when configured): {percent_bp, effective_bp, boosts_applied,
    of, base, amount, cap, currency,
    accruing: {period_id, ends_at, base, effective_bp, amount,
               wagered_so_far, activity_ok}}.
    amount = claimable NOW (previous closed period); accruing = the CURRENT
    period's running tab - render it as "next bonus so far" with a countdown
    to ends_at. Display only: it becomes claimable when the period closes.
- POST /v1/vip/claim  {"player_id", "idempotency_key": "uuid"}
    -> {status: "claimed"|"nothing_to_claim", tier,
        claimed:[{tier, cadence, period_id, rakeback_amount}], rewards:[...]}
    Claims every claimable benefit at once; once per benefit per period,
    enforced server-side. "nothing_to_claim" is an answer, not an error.

## Build these pieces
A. Backend GET /api/pulse/vip (authenticated player): proxy the player view.
B. Backend POST /api/pulse/vip/claim: mint a UUID idempotency key, call
   Pulse, return {status, claimed, rewards} with display labels.
C. A VIP page/panel: tier badge, progress bar (wagered/needed/progress_pct
   from the API), the tier ladder, and a "claim" button that appears when
   any benefit is claimable; one toast per rewards[] row on success.
D. Rakeback display: when benefits[].rakeback exists, show BOTH numbers:
   "claimable now: <amount>" (last closed period) AND "accruing:
   <accruing.amount> so far - pays <weekday from accruing.ends_at>" so the
   bonus visibly grows as they play. Use effective_bp from each block;
   never hardcode a percentage - rates are per-player (signal boosts).
E. Win events: in our game-result handler, POST type:"win" with the payout
   amount and a per-round idempotency key. Without wins, GGR overstates and
   rakeback overpays players who won.

## Acceptance checklist
- [ ] Tier and progress bar render purely from the API.
- [ ] Claiming twice: first pays, second returns nothing_to_claim; exactly
      one wallet credit per currency reward (outbox idempotent by grant_id).
- [ ] rakeback amounts match the API view exactly; no local math.
- [ ] win events flow for every settled round.
- [ ] No PULSE_API_KEY in built frontend assets.
Ask me for: PULSE_API_KEY, the player id mapping, our game-result hook (for
win events), and where the wallet credit function lives.
`;

export default function VipDocs() {
  return (
    <>
      <h1>VIP &amp; RakeBack</h1>
      <p className="lede">
        Operator-authored VIP tiers on total play, with recurring bonuses that
        are a <strong>percentage of each player&apos;s own play</strong> — not a
        set amount. Tiers are computed live from the event stream; rakeback
        settles on closed books; every rate is capped, bounded, and explainable.
      </p>

      <h2>Tiers — computed, never stored</h2>
      <Endpoint method="GET" path="/v1/vip/players/{player_id}" />
      <Code>{`
-> {"tier": "Gold", "wagered": 6200000,
    "tiers": [{"name": "Bronze", "threshold": 0}, ...],
    "next_tier": "Diamond", "needed": 43800000, "progress_pct": 12,
    "benefits": [ ... claim state per benefit ... ]}
      `}</Code>
      <p>
        Tiers threshold on total <code>wager</code> events (or GGR, or
        purchases — LTV tiers), lifetime or rolling-90-day. Because the tier is
        computed from events you already send, it&apos;s correct retroactively
        the moment the program is configured — and the response is a
        ready-made VIP progress bar.
      </p>

      <h2>RakeBack — % of the player&apos;s own play</h2>
      <ul>
        <li><strong>Base:</strong> X bp of the player&apos;s <strong>GGR</strong>
          {" "}(wagers − wins), wagered, purchases, or{" "}
          <strong>net purchases</strong> (purchases − redeems: cash-anchored
          rebates, requiring the reserved <code>redeem</code> event) — over the{" "}
          <strong>previous completed period</strong> (closed books, no window
          gaming). A non-positive base earns nothing.</li>
        <li><strong>Signal-sized:</strong> the rate can rise per player —
          loyalty (streak ≥ N days), re-engagement (played less than the prior
          period), depositors (purchased ≥ X). Clamped by a ceiling, then a
          hard cap. The response carries <code>effective_bp</code> and{" "}
          <code>boosts_applied</code>, so every rate is explainable.</li>
        <li><strong>Activity-gated:</strong> benefits can require recent play —
          engaged VIPs claim automatically; lapsed VIPs are winback-campaign
          territory.</li>
      </ul>

      <h2>Claiming</h2>
      <Endpoint method="POST" path="/v1/vip/claim" />
      <Code>{`
{"player_id": "...", "idempotency_key": "uuid"}
-> {"status": "claimed", "tier": "Gold",
    "claimed": [{"tier": "Gold", "cadence": "weekly",
                 "period_id": "2026-W29", "rakeback_amount": 4200}],
    "rewards": [{"type": "currency", "currency": "SC", "amount": 4200,
                 "label": "12% ggr rakeback (2026-W29)"}, ...]}
      `}</Code>
      <p>
        One call claims everything currently claimable — once per benefit per
        period, enforced server-side. Currency settles through your{" "}
        <a href="/">grant outbox</a> as always; spins and{" "}
        <a href="/raffles">tickets</a> follow their usual paths.
      </p>

      <div className="callout info">
        <strong>GGR needs both sides of the ledger.</strong> You already send
        {" "}<code>wager</code> events; add <code>type: &quot;win&quot;</code>
        {" "}with the payout amount per settled round. Without wins, GGR
        overstates and rakeback overpays players who won.
      </div>

      <h2>Endpoint summary</h2>
      <table>
        <thead><tr><th>Endpoint</th><th>Purpose</th><th>Billable</th></tr></thead>
        <tbody>
          <tr><td><code>GET /v1/vip/players/{"{id}"}</code></td><td>tier + progress + claim state</td><td>no</td></tr>
          <tr><td><code>POST /v1/vip/claim</code></td><td>claim all claimable benefits</td><td>yes (1 token, paying claims only)</td></tr>
          <tr><td><code>POST /v1/events</code></td><td>wager / win / purchase signal</td><td>per plan</td></tr>
        </tbody>
      </table>

      <div className="callout info">
        Tiers, benefits, rakeback rates, boosts, ceilings, and caps are all
        authored in Pulse Studio&apos;s VIP tab. Your integration is the two
        calls above plus win events.
      </div>

      <AgentPrompt prompt={VIP_AGENT_PROMPT} />
    </>
  );
}
