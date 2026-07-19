import { AgentPrompt } from "@/components/AgentPrompt";
import { Code, Endpoint } from "@/components/docs";

const RAFFLE_AGENT_PROMPT = `
Integrate the Pulse Rewards "Raffles" feature into this codebase. Pulse is a
gamification API for sweepstakes sites. Follow this architecture exactly - it
is a hard security contract.

## Non-negotiable rules
1. The Pulse API key (env PULSE_API_KEY, "prw_...") is backend-only: never in
   frontend bundles or browser requests. All Pulse calls go frontend -> our
   backend -> Pulse.
2. TWO LEDGERS, one boundary. Raffle TICKETS are earned and live only in
   Pulse's ledger - they are NOT money, mint NO grant, and must NEVER touch
   our wallet-credit path. The only money movement is the PRIZE: when a player
   wins, Pulse mints a signed SC/GC grant to our outbox, settled exactly like
   a wheel/streak win. A ticket award is not a payout.
3. Do NOT run the draw, compute odds, or pick winners locally. Pulse draws
   (provably fair) and returns results; render them.
4. Zero PII to Pulse - player ids only. WE resolve winner display names.

## Pulse API (base https://api.playwithpulse.com, header
## "Authorization: Bearer <PULSE_API_KEY>")
- POST /v1/raffles/{id}/tickets   body {player_id, count, idempotency_key}
    Award tickets (e.g. tickets-per-dollar on a completed purchase). Use the
    PURCHASE ID as idempotency_key - a replay grants nothing. Metered per call.
- Tickets can also come from streak/wheel rungs Pulse already configures; those
    arrive in the claim/spin response's rewards[] as
    {type:"raffle_tickets", count, label} with NO grant. Nothing to build.
- GET /v1/raffles/{id}         -> {prizes, minimum_pool,
    current_period:{period_id, ends_at, total_tickets, effective_pool, commitment}}
- GET /v1/raffles/{id}/players/{player_id} -> {tickets, total_tickets, effective_pool}
- GET /v1/raffles/{id}/winners -> {winners:[{period_id, tier, player, prize}]}
- GET /v1/raffles/{id}/periods/{period_id} -> frozen draw + fairness{commitment, server_seed}

## Build these pieces
A. Backend POST /api/pulse/raffle/tickets called from OUR purchase-completion
   handler: award tickets-per-dollar with idempotency_key = purchase id. Never
   from the browser.
B. Read proxies (cache ~30s) that join player_id -> display name for the
   winners board only. Ticket counts and pool are already PII-free.
C. Storefront raffle UI: prize tiers, a "draw in Hh Mm" countdown from
   current_period.ends_at, the player's ticket count and odds
   (tickets / effective_pool), and a winners board (split-flap:
   "LAST WEEK - <name> - 500 SC").
D. Settlement: raffle prize grants flow to the SAME outbox as wheel/streak.
   If the outbox worker exists, reuse it unchanged. Tickets never appear there.

## Acceptance checklist
- [ ] Awarding tickets with a repeated idempotency_key grants nothing.
- [ ] A ticket award creates NO wallet credit and NO outbox grant.
- [ ] A raffle WIN produces exactly one signed grant in the outbox.
- [ ] The winners board shows only real winners; dry periods never appear.
- [ ] Odds render from the API (tickets / effective_pool); no local draw.
- [ ] No PULSE_API_KEY in built frontend assets; no PII sent to Pulse.
Ask me for: PULSE_API_KEY, our raffle_id, tickets-per-dollar, and the
purchase-completion hook + how we map player_id to display identity.
`;

export default function RaffleDocs() {
  return (
    <>
      <h1>Raffles</h1>
      <p className="lede">
        Time-boxed prize draws. <strong>Two ledgers, one boundary:</strong>
        tickets are <em>earned</em> and live only in Pulse — no grant, no
        settlement — while the <strong>prize</strong> is the single money
        movement, a signed grant to the drawn winner through your outbox.
      </p>

      <div className="callout info">
        A &quot;3 tickets&quot; award never touches your wallet path; only a win
        does. Tickets can be handed out generously — the floor pool bounds cost
        to the fixed prize, not the tickets.
      </div>

      <h2>Awarding tickets</h2>
      <Endpoint method="POST" path="/v1/raffles/{id}/tickets" />
      <Code>{`
{"player_id": "...", "count": 20, "idempotency_key": "purchase-id"}
-> {"period_id": "...", "granted": 20, "replayed": false, "tickets": 20}
      `}</Code>
      <p>
        Award directly (e.g. tickets-per-dollar on a completed purchase) with
        the purchase id as the idempotency_key — a replay grants nothing.
        Tickets also come from streak/wheel rungs Pulse configures; those arrive
        in the claim/spin <code>rewards[]</code> as{" "}
        <code>{`{type:"raffle_tickets", count, label}`}</code> with <strong>no
        grant</strong> — nothing for you to build.
      </p>

      <h2>The floor pool</h2>
      <p>
        The draw samples from <code>max(total_real_tickets, minimum_pool)</code>.
        With a thin pool the expected payout scales down (a draw landing in the
        phantom span above real tickets is no winner), reaching the full prize
        only once real tickets meet the floor. So you can advertise a big prize
        from day one — <strong>expected cost grows with your player base</strong>,
        never ahead of it.
      </p>

      <h2>Reads</h2>
      <Code>{`
GET /v1/raffles/{id}
-> {prizes: [{currency, amount, label}], minimum_pool,
    current_period: {period_id, ends_at, total_tickets, effective_pool, commitment}}

GET /v1/raffles/{id}/players/{player_id}  -> {tickets, total_tickets, effective_pool}
GET /v1/raffles/{id}/winners              -> {winners: [{period_id, tier, player, prize}]}
GET /v1/raffles/{id}/periods/{period_id}  -> frozen draw + fairness:{commitment, server_seed}
      `}</Code>
      <ul>
        <li><strong>Provably fair.</strong> The seed is committed at period open
          and revealed at the draw; anyone can recompute the winners
          (<code>winning_number = HMAC(seed, &quot;tenant:raffle:period:tier&quot;) mod effective_pool</code>).</li>
        <li><strong>Draw = snapshot, not settlement.</strong> At close, standings
          freeze and winner grants flow to your outbox — the only money movement.</li>
        <li><strong>No PII.</strong> Player ids only; you resolve winner names
          (<code>LAST WEEK · JUSTIN W · 500 SC</code>).</li>
        <li>Dry periods (no winner) reset quietly and never hit the winners board.</li>
      </ul>

      <h2>Endpoint summary</h2>
      <table>
        <thead><tr><th>Endpoint</th><th>Purpose</th><th>Billable</th></tr></thead>
        <tbody>
          <tr><td><code>POST /v1/raffles/{"{id}"}/tickets</code></td><td>award tickets</td><td>yes (1 token / call)</td></tr>
          <tr><td><code>GET /v1/raffles/{"{id}"}</code></td><td>prizes + period + pool</td><td>no</td></tr>
          <tr><td><code>GET …/players/{"{id}"}</code></td><td>a player&apos;s tickets + odds</td><td>no</td></tr>
          <tr><td><code>GET …/winners</code></td><td>winners board</td><td>no</td></tr>
          <tr><td><code>GET …/periods/{"{id}"}</code></td><td>frozen draw + fairness proof</td><td>no</td></tr>
        </tbody>
      </table>

      <div className="callout info">
        Prizes, period, and the <code>minimum_pool</code> floor are configured in
        Pulse Studio (with a live floor-pool odds calculator) or with the Pulse
        team. Your integration is the ticket grant and the reads.
      </div>

      <AgentPrompt prompt={RAFFLE_AGENT_PROMPT} />
    </>
  );
}
