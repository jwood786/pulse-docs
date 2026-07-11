import { Code, Endpoint } from "@/components/docs";

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
    "grant": { "grant_id": "...", "signature": "...", ... }}
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

      <h2>Collecting the reward</h2>
      <p>
        Paying claims append a signed grant to your <a href="/">outbox</a> —
        verify, credit, ack, same as every feature. The response includes the
        grant inline for immediate UX.
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
    </>
  );
}
