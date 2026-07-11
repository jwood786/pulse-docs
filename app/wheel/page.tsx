import { Code, Endpoint } from "@/components/docs";

export default function WheelDocs() {
  return (
    <>
      <h1>Wheel Spins</h1>
      <p className="lede">
        A provably fair prize wheel: your backend grants spins, the player
        spins, wins arrive as signed grants. The on-page wheel is a ~14KB
        drop-in widget — real casino motion, zero build step, themed by the
        Pulse team to match your site.
      </p>

      <h2>Flow at a glance</h2>
      <Code>{`
player clicks SPIN
  -> your frontend calls YOUR backend
  -> your backend calls Pulse (your API key, server-side)
  -> Pulse draws the outcome (commit-reveal) and issues any signed grant
  -> your backend returns { segment_index, prize_text } to the frontend
  -> the widget animates to that exact segment
      `}</Code>

      <h2>1. Grant spins</h2>
      <p>
        Your promotion logic decides when a player earns spins (daily bonus,
        deposit reward, support goodwill — your call):
      </p>
      <Endpoint method="POST" path="/v1/wheels/{wheel_id}/grants" />
      <Code>{`
{"player_id": "your-player-ref", "count": 1}

-> {"grants": [{"grant_id": "0d3c...", "commitment": "9f41...sha256"}]}
      `}</Code>
      <p>
        The <code>commitment</code> is minted <em>before</em> the spin —
        surface it to players if you display fairness proofs. Granting is
        free; the spin is the billable action.
      </p>

      <h2>2. Render the wheel</h2>
      <p>Fetch the player&apos;s wheel state (server-side), then mount the widget:</p>
      <Endpoint method="GET" path="/v1/wheels/{wheel_id}/players/{player_id}" />
      <Code>{`
-> {"segments": [{"label": "Nothing", ...}, {"label": "5 SC", ...}],
    "open_spins": 2}
      `}</Code>
      <Code>{`
<div id="wheel" style="width:420px;height:420px"></div>
<script src="https://api.playwithpulse.com/widget/pulse-wheel.js"></script>
<script>
  const wheel = PulseWheel.mount(document.getElementById("wheel"), {
    segments: SEGMENTS_FROM_YOUR_BACKEND,
    onSpin: async () => {
      const r = await fetch("/api/your-site/spin", { method: "POST" })
        .then((res) => res.json());
      return { index: r.segment_index, prizeText: r.prize_text };
    },
  });
</script>
      `}</Code>
      <div className="callout info">
        The widget holds no key and calls no Pulse endpoint. <code>onSpin</code>
        {" "}asks <em>your</em> backend; the widget just performs the theater —
        marquee chase, peg ticks, confetti — landing on the outcome the server
        already decided. Colors and branding are configured by the Pulse team
        during onboarding.
      </div>

      <h2>3. Spin</h2>
      <Endpoint method="POST" path="/v1/wheels/{wheel_id}/spin" />
      <Code>{`
{"player_id": "your-player-ref",
 "client_seed": "optional-player-entropy",
 "idempotency_key": "uuid-per-click"}

-> {
  "segment_index": 3,
  "label": "50 SC",
  "currency": "SC", "amount": 5000,          // fixed part, if any
  "percent_bp": 0, "percent_of": null,       // percent part, if any
  "fairness": {
    "commitment": "9f41...",                 // published at grant time
    "server_seed": "ab02...",                // revealed now
    "context": "tenant:wheel:player:grant:seed"
  },
  "grant": { "grant_id": "...", "signature": "...", ... },
  "spins_remaining": 1
}
      `}</Code>
      <p>
        Consumes the player&apos;s oldest open grant; <code>409</code> if they have
        none. Pass <code>segment_index</code> and your formatted prize string
        to <code>wheel.spinTo(index, prizeText)</code> (or return them from
        <code> onSpin</code>).
      </p>

      <h2>Fairness verification</h2>
      <p>Any spin can be independently re-derived:</p>
      <ol>
        <li>Check <code>SHA-256(server_seed) == commitment</code> (published before the spin).</li>
        <li>Compute <code>HMAC-SHA-256(key=server_seed, msg=context)</code>.</li>
        <li>Interpret the digest as a big-endian integer, take it modulo the
          total segment weight, and walk the cumulative weights — that index
          is the outcome.</li>
      </ol>
      <p>
        Deterministic and reproducible forever — a player, an auditor, or a
        regulator can verify without trusting Pulse or you.
      </p>

      <h2>Collecting the win</h2>
      <p>
        Paying spins append to your <a href="/">grant outbox</a> (fixed
        amounts and/or percent bonuses). Verify the signature, credit your
        wallet, ack. The spin response includes the same grant inline for
        immediate UX; the outbox remains the source of truth for settlement.
      </p>

      <h2>Endpoint summary</h2>
      <table>
        <thead><tr><th>Endpoint</th><th>Purpose</th><th>Billable</th></tr></thead>
        <tbody>
          <tr><td><code>POST /v1/wheels/{"{id}"}/grants</code></td><td>give a player spins</td><td>no</td></tr>
          <tr><td><code>GET /v1/wheels/{"{id}"}/players/{"{pid}"}</code></td><td>segments + open spin count</td><td>no</td></tr>
          <tr><td><code>POST /v1/wheels/{"{id}"}/spin</code></td><td>resolve one spin</td><td>yes (1 token)</td></tr>
        </tbody>
      </table>
    </>
  );
}
