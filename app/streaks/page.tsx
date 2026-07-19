import { AgentPrompt } from "@/components/AgentPrompt";
import { Code, Endpoint } from "@/components/docs";

const STREAK_AGENT_PROMPT = `
Integrate the Pulse Rewards "Daily Login Streaks" feature into this
codebase. Pulse is a gamification API for sweepstakes sites. Follow this
architecture exactly - it is a hard security contract.

## Non-negotiable rules
1. The Pulse API key (env PULSE_API_KEY, "prw_...") is backend-only:
   never in frontend bundles or browser requests.
2. All Pulse calls go frontend -> our backend -> Pulse.
3. Player balances live in OUR wallet. Pulse pays via signed grants we
   verify, apply idempotently, and acknowledge.
4. Every claim sends an idempotency_key (UUID per user action).

## Pulse API (base https://api.playwithpulse.com, header
## "Authorization: Bearer <PULSE_API_KEY>")
- POST /v1/streaks/{streak_id}/claim
    body {"player_id": str, "idempotency_key": str}
    Success -> {"status": "claimed", "streak": int, "rung": int,
                "currency": str, "amount": int, "grant": {...}?}
    Same local day -> {"status": "already_claimed", "streak": int,
                       "next_claim_date": "YYYY-MM-DD"} (an answer, not
    an error, and not billed). The day boundary uses the timezone
    configured for our site on Pulse's side; do NOT compute any streak
    or calendar logic locally - render what the API returns. Amounts
    are integers in our smallest currency unit (500 = 5.00 SC).
    A "claimed" response also carries rewards[], the full manifest of
    the rung: {type:"currency", currency, amount, label} rows (the cash,
    settled via the grant/outbox) and possibly {type:"raffle_tickets",
    raffle_id, count, label} rows. RAFFLE TICKETS ARE EARNED, NOT PAID:
    they carry NO grant, must NEVER hit the wallet or outbox, and only a
    raffle WIN later mints a grant. Iterate rewards[]: settle currency
    rows, render raffle_tickets rows as a toast only.
- GET /v1/outbox and POST /v1/outbox/{grant_id}/ack for settlement
    (shared with all Pulse features; reuse the outbox worker if one
    already exists in this codebase).

## Build these pieces
A. Backend endpoint POST /api/pulse/streak/claim (player must be
   authenticated): mint a UUID idempotency key, call Pulse claim with
   the player's stable id, return {status, streak, rung, amount_text,
   next_claim_date?} where amount_text formats amount/100 with the
   currency label.
B. Call it automatically once on login/session start AND expose it to a
   "claim today's reward" button. Handle both statuses: "claimed" shows
   a reward toast; "already_claimed" quietly updates the calendar UI.
C. A streak calendar UI: a 7-slot strip using the response - checkmarks
   for days 1..rung, today highlighted, remaining rungs greyed. (If the
   configured ladder is longer/shorter ask me; do not hardcode rewards -
   show amounts only for the day just claimed.)
D. Outbox settlement: identical to the Pulse wheel integration. If this
   codebase already has the Pulse outbox worker, reuse it unchanged -
   streak grants flow through the same pipe. Otherwise implement:
   poll GET /v1/outbox; verify HMAC-SHA256(key=PULSE_WEBHOOK_SECRET,
   msg=canonical JSON of the grant minus grant_id and signature, keys
   sorted, separators ("," ":")) against grant["signature"] in constant
   time; apply to the wallet idempotently by grant_id; then ack.

## Acceptance checklist
- [ ] Claiming twice in one (site-timezone) day: first returns
      "claimed", second "already_claimed"; exactly one wallet credit.
- [ ] Replaying the same idempotency key returns the identical body.
- [ ] raffle_tickets rewards create NO wallet credit and NO outbox
      grant - they are rendered as a toast only.
- [ ] The calendar renders purely from API responses (no local date
      math beyond display formatting).
- [ ] Tampered grant signatures are rejected, logged, never acked.
- [ ] PULSE_API_KEY appears nowhere in built frontend assets.
Ask me for: PULSE_API_KEY, PULSE_WEBHOOK_SECRET, our streak_id, the
player id mapping, and the wallet credit function/location.
`;

export default function StreakDocs() {
  return (
    <>
      <h1>Daily Login Streaks</h1>
      <p className="lede">
        A daily claim ladder that rewards consecutive visits — day 1 pays
        small, day 7 pays big. One endpoint. Pulse tracks the calendar, the
        grace rules, and the ladder position; you just call claim when the
        player shows up.
      </p>

      <h2>Claim</h2>
      <Endpoint method="POST" path="/v1/streaks/{streak_id}/claim" />
      <Code>{`
{"player_id": "your-player-ref", "idempotency_key": "uuid"}

-> {"status": "claimed",
    "streak": 4,                       // consecutive days, 1-based
    "rung": 4,                         // ladder position paying out
    "currency": "SC", "amount": 500,
    "grant": { "grant_id": "...", "signature": "...", ... },
    "rewards": [                        // everything this rung awarded
      {"type": "currency", "currency": "SC", "amount": 500, "label": "5 SC"},
      {"type": "raffle_tickets", "raffle_id": "weekly_draw",
       "count": 5, "label": "+5 Raffle Tickets"}   // earned only, NO grant
    ]}
      `}</Code>
      <p>Call it whenever the player logs in or opens their rewards page — the
        platform sorts out the rest:</p>
      <ul>
        <li>
          <strong>One claim per local day.</strong> The day boundary follows
          the timezone configured for your site (not UTC, not the player&apos;s
          device). Repeat calls the same day return
          {" "}<code>{`{"status": "already_claimed", "streak": 4, "next_claim_date": "..."}`}</code>
          {" "}— an answer, not an error, and never billed.
        </li>
        <li>
          <strong>Grace days.</strong> If configured, missing a single day
          doesn&apos;t reset the streak — the platform forgives up to the
          configured gap.
        </li>
        <li>
          <strong>Ladder end.</strong> Configurable: hold at the top reward
          for day N+1 onward, or cycle back to day 1.
        </li>
      </ul>
      <div className="callout info">
        Ladder amounts, timezone, and grace policy are configured with the
        Pulse team at onboarding — your integration is just the claim call.
      </div>

      <h2>Rendering a streak calendar</h2>
      <p>
        The claim response carries everything a &quot;day 4 of 7&quot; UI needs:
        current <code>streak</code>, the <code>rung</code> that just paid, and
        on repeat calls the <code>next_claim_date</code>. Most sites render a
        7-day strip with checkmarks up to <code>rung</code> and the upcoming
        rewards greyed out.
      </p>

      <h2>Ticket-award days</h2>
      <p>
        A rung can also hand out <a href="/raffles">raffle</a> tickets — e.g.
        &quot;day 3 pays 3 SC <em>and</em> drops you into the weekly draw.&quot;
        Configure it per day in Studio (the <strong>Tickets</strong> +{" "}
        <strong>Raffle</strong> columns on the streak ladder). It surfaces as a{" "}
        <code>raffle_tickets</code> row in the claim response&apos;s{" "}
        <code>rewards[]</code>:
      </p>
      <div className="callout info">
        <strong>Tickets are earned, not paid.</strong> A{" "}
        <code>raffle_tickets</code> reward carries <strong>no grant</strong> and
        never touches your wallet or outbox — Pulse credits its own ticket
        ledger. Only a raffle <em>win</em> mints a grant. So iterate{" "}
        <code>rewards[]</code>: settle <code>currency</code> rows through the
        outbox as usual, and render <code>raffle_tickets</code> rows as a toast
        (&quot;<code>+5 Raffle Tickets</code>&quot;) — do not credit them.
      </div>

      <h2>Collecting the reward</h2>
      <p>
        Paying claims append a signed grant to your <a href="/">outbox</a> —
        verify, credit, ack, same as every feature. The response includes the
        grant inline for immediate UX. The <code>rewards[]</code> array is the
        full manifest of a rung: a <code>currency</code> row for the cash (and
        its <code>grant</code>), plus any <code>raffle_tickets</code> rows, which
        are ledger-only.
      </p>

      <h2>Endpoint summary</h2>
      <table>
        <thead><tr><th>Endpoint</th><th>Purpose</th><th>Billable</th></tr></thead>
        <tbody>
          <tr>
            <td><code>POST /v1/streaks/{"{id}"}/claim</code></td>
            <td>claim today&apos;s rung</td>
            <td>yes (1 token; same-day repeats free)</td>
          </tr>
        </tbody>
      </table>

      <AgentPrompt prompt={STREAK_AGENT_PROMPT} />
    </>
  );
}
