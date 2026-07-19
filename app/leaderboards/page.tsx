import { AgentPrompt } from "@/components/AgentPrompt";
import { Code, Endpoint } from "@/components/docs";

const LEADERBOARD_AGENT_PROMPT = `
Integrate the Pulse Rewards "Leaderboards" feature into this codebase.
Pulse is a gamification API for sweepstakes sites. Follow this architecture
exactly - it is a hard contract.

## Non-negotiable rules
1. The Pulse API key (env PULSE_API_KEY, "prw_...") is backend-only: never
   in frontend bundles or browser requests. All Pulse calls go
   frontend -> our backend -> Pulse.
2. Leaderboards move NO money. There are no grants, no outbox, no payouts
   for this feature - visibility is the reward. Do NOT wire it to any
   wallet or settlement code.
3. Do NOT compute ranks, periods, deltas, or neighbors locally. Render
   exactly what the API returns; trust "computed_at", never assume
   real-time.
4. Pulse holds ZERO PII. Responses contain player ids only. WE resolve
   display names / avatars / masking by joining player_id to our user
   table. Never send Pulse a nickname.

## Pulse API (base https://api.playwithpulse.com, header
## "Authorization: Bearer <PULSE_API_KEY>")
- POST /v1/events/batch   body {"events": [{player_id, type, value,
    occurred_at?, idempotency_key?}, ...]}
    -> {"received", "accepted", "replayed"}
    value is an additive INTEGER increment (no currency meaning). Derive
    one idempotency_key per aggregation window per player; a repeated key
    is a REPLAY (no re-increment), not an error. Billed PER CALL, not per
    event - batch. occurred_at (ISO) buckets each event into its period;
    an event after a period closes scores in the NEXT one, 200 OK.
- GET /v1/leaderboards/{id}
    -> {metric, period, timezone, board_size, min_activity,
        current_period: {period_id, starts_at, ends_at}}   # ends_at drives countdowns
- GET /v1/leaderboards/{id}/standings?period=current|previous
    -> {period_id, frozen, computed_at,
        standings: [{rank, player, score, rank_delta}, ...]}
- GET /v1/leaderboards/{id}/players/{player_id}
    -> {rank, score, rank_delta, shadow, neighbors:[rank-3..rank+3]}
    Returns rank + neighbors in ONE call, even for a player ranked 4000;
    unranked players get rank:null + score. rank_delta > 0 = climbing.
- GET /v1/leaderboards/{id}/periods/{period_id}   # frozen archive, forever
- PATCH /v1/players/{player_id} {"shadow": true}  # exclude staff/testers

## Build these pieces
A. Backend POST /api/pulse/activity: our game/wallet code calls this on a
   scoring action (wager, xp, etc.); it aggregates per player per ~5-min
   window, derives idempotency_key from (player, window, metric), and
   POSTs /v1/events/batch. Never call Pulse from the browser.
B. Backend read proxies for the three GET endpoints (cache ~30s). Join
   player_id -> display name/avatar from OUR user table before returning
   to the frontend. Pulse never sees identity.
C. Board UI: ranked list from standings; a "resets in Hh Mm" countdown
   from current_period.ends_at; render "computed_at" as "updated Ns ago".
D. "Your rank" widget from players/{id}: show rank, score, rank_delta
   arrow, and the neighbor rows - the "you're N behind rank X" line is the
   whole point. Handle rank:null (unranked / below min_activity).
E. Hall of Fame: previous-period + periods/{id} archives (immutable).
F. Shadow toggle in our admin for staff/affiliate/test accounts.

## Acceptance checklist
- [ ] Replaying an event batch (same idempotency keys) changes no scores.
- [ ] A brand-new player's first event creates + scores them.
- [ ] An event 1s after period close returns 200 and lands next period.
- [ ] A shadow player is scored but absent from standings, with no gap.
- [ ] players/{id} returns rank + neighbors for a player below board_size.
- [ ] previous-period standings equal the frozen archive, and stay equal.
- [ ] No PULSE_API_KEY in built frontend assets; no PII sent to Pulse.
Ask me for: PULSE_API_KEY, our leaderboard_id(s), the event types + units
we report, and how our code maps player_id to display identity.
`;

export default function LeaderboardDocs() {
  return (
    <>
      <h1>Leaderboards</h1>
      <p className="lede">
        Time-boxed competitions ranked by an activity metric. Players compete,
        watch their rank move, and get a fresh board every period.
        <strong> No money moves</strong> — leaderboards have no grants, no
        outbox, no payouts. Visibility is the reward.
      </p>

      <div className="callout info">
        Two-layer feature: a generic <strong>event stream</strong> you push
        activity to, and <strong>read endpoints</strong> that rank it. Pulse
        holds <strong>zero PII</strong> — player ids only; you resolve names
        and avatars on your side.
      </div>

      <h2>1 — Report activity</h2>
      <Endpoint method="POST" path="/v1/events/batch" />
      <Code>{`
{"events": [
  {"player_id": "user-uuid", "type": "wager", "value": 500,
   "occurred_at": "2026-07-18T14:05:00Z", "idempotency_key": "user-uuid:2026-07-18T14:05"}
]}

-> {"received": 1, "accepted": 1, "replayed": 0}
      `}</Code>
      <ul>
        <li><strong>Additive integer increments.</strong> <code>value</code>
          has no currency meaning — nothing here pays out. Aggregate your own
          ~5-minute windows and send one event per window.</li>
        <li><strong>Idempotent.</strong> A repeated <code>idempotency_key</code>
          is a replay (no re-increment), an answer not an error.</li>
        <li><strong>Billed per call, not per event</strong> — batch freely.</li>
        <li><strong>Late is fine.</strong> <code>occurred_at</code> buckets each
          event into its period; an event arriving after a period closes scores
          in the next one, <code>200 OK</code>.</li>
        <li>Unseen <code>player_id</code>s are created implicitly and echoed
          back verbatim.</li>
      </ul>

      <h2>2 — Read the board</h2>
      <Endpoint method="GET" path="/v1/leaderboards/{id}/standings?period=current|previous" />
      <Code>{`
-> {"period_id": "2026-07-18", "frozen": false,
    "computed_at": "2026-07-18T14:05:31Z",
    "standings": [
      {"rank": 1, "player": "user-uuid", "score": 48200, "rank_delta": 2},
      {"rank": 2, "player": "user-uuid", "score": 41050, "rank_delta": -1}
    ]}
      `}</Code>
      <p>
        Responses carry <strong>everything the UI renders</strong>. Standings
        materialize every ~45s — trust <code>computed_at</code>, don&apos;t
        assume real-time. <code>GET /v1/leaderboards/{"{id}"}</code> returns the
        config plus <code>current_period.ends_at</code> for your
        &quot;resets in 2h 14m&quot; countdown. <code>rank_delta</code> is
        movement since the ~hourly checkpoint — positive means climbing.
      </p>

      <h2>3 — A player&apos;s rank + neighbors, in one call</h2>
      <Endpoint method="GET" path="/v1/leaderboards/{id}/players/{player_id}" />
      <Code>{`
-> {"rank": 4012, "score": 900, "rank_delta": 5, "shadow": false,
    "neighbors": [   // rank-3 .. rank+3, so "you're 120 behind rank 4011"
      {"rank": 4009, "player": "...", "score": 1180, "rank_delta": 0},
      ... {"rank": 4012, "player": "you", "score": 900}, ...
    ]}
      `}</Code>
      <p>
        The neighbors view is the FOMO engine — &quot;you&apos;re 1,200 behind
        the next player&quot; without stitching the top-100. Works even for a
        player ranked 4,000. Unranked players (below the activity floor, or no
        events yet) return <code>rank: null</code> with their score.
      </p>

      <h2>4 — Archives (Hall of Fame)</h2>
      <Endpoint method="GET" path="/v1/leaderboards/{id}/periods/{period_id}" />
      <p>
        At period end (plus a short grace for in-flight batches), standings
        <strong> freeze into an immutable snapshot</strong> — retrievable
        forever, identical every time. Tiebreak is deterministic and
        documented: equal scores rank by <strong>who reached the score
        first</strong>, then by player id. Build your &quot;yesterday&apos;s
        champions&quot; wall from these.
      </p>

      <h2>5 — Shadow players</h2>
      <Endpoint method="PATCH" path="/v1/players/{player_id}" />
      <Code>{`{"shadow": true}`}</Code>
      <p>
        Shadow players are <strong>scored internally but never appear in
        standings or archives and never occupy a rank</strong> — the board
        closes over them with no gap. Use it for staff, geo-exempt affiliates,
        and test accounts, instead of filtering on your side (a public board
        topped by your own team, or holes where you filtered, reads as fake).
      </p>

      <h2>Endpoint summary</h2>
      <table>
        <thead><tr><th>Endpoint</th><th>Purpose</th><th>Billable</th></tr></thead>
        <tbody>
          <tr><td><code>POST /v1/events/batch</code></td><td>report activity</td><td>yes (1 token / call)</td></tr>
          <tr><td><code>GET /v1/leaderboards/{"{id}"}</code></td><td>config + current period</td><td>no</td></tr>
          <tr><td><code>GET …/standings</code></td><td>ranked board (current/previous)</td><td>no</td></tr>
          <tr><td><code>GET …/players/{"{id}"}</code></td><td>rank + neighbors</td><td>no</td></tr>
          <tr><td><code>GET …/periods/{"{id}"}</code></td><td>frozen archive</td><td>no</td></tr>
          <tr><td><code>PATCH /v1/players/{"{id}"}</code></td><td>shadow flag</td><td>no</td></tr>
        </tbody>
      </table>

      <div className="callout info">
        Metric, period (daily/weekly), timezone, board size, and the
        minimum-activity floor are configured in Pulse Studio or with the
        Pulse team — your integration is the events push and the reads.
      </div>

      <AgentPrompt prompt={LEADERBOARD_AGENT_PROMPT} />
    </>
  );
}
