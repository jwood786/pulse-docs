import { AgentPrompt } from "@/components/AgentPrompt";
import { Code, Endpoint } from "@/components/docs";

const CRM_AGENT_PROMPT = `
Integrate the Pulse CRM foundation into this codebase: identity sync,
consent, responsible-gaming state, and the Player 360 profile. Pulse is a
gamification API for sweepstakes sites. Follow this architecture exactly -
it is a hard security contract.

## Non-negotiable rules
1. PULSE_API_KEY is backend-only. All calls go our backend -> Pulse.
2. PII flows ONE way: we push contact data to Pulse's encrypted vault.
   Profile reads are PII-free (ids + aggregates) and safe for back-office UI.
3. Responsible-gaming state MUST be pushed on change (self-exclusion,
   cool-off). It blocks all Pulse messaging and survives erasure.
4. Honor deletion: when a player invokes erasure with us, call Pulse's
   DELETE too. Re-ingest after erasure requires reconsent: true.

## Pulse API (base https://api.playwithpulse.com)
- PUT /v1/crm/players/{player_id}/identity     (merge-write; send only
    changed fields)
    {"email"?, "first_name"?, "phone"?, "birthday"? ("YYYY-MM-DD"|"MM-DD"),
     "email_status"?: "none"|"subscribed"|"unsubscribed",
     "sms_status"?, "rg_status"?: "ok"|"cooloff"|"self_excluded",
     "rg_until"? (ISO, cooloff only), "reconsent"?: bool}
    -> identity + "messageable": {"email": bool, "sms": bool}
- DELETE /v1/crm/players/{player_id}/identity   (erasure; 410 afterwards)
- GET /v1/crm/players/{player_id}/profile       (PII-free)
    -> {ltv, purchase_count, last_purchase_at, days_since_purchase,
        wagered_30d, streak_len, churn_band, vip_tier, days_to_birthday,
        has_identity, messageable, rg_status, first_seen, last_seen}
- POST /v1/events with reserved types: "purchase" (value = amount,
    idempotency_key = order id), "wager", "win".

## Build these pieces
A. On signup and on profile update: PUT identity with email + consent
   states (+ birthday if we hold it). On unsubscribe webhooks: PUT just
   {"email_status": "unsubscribed"}.
B. On RG changes (self-exclusion, cool-off) in OUR system: PUT rg_status
   immediately - this is a compliance path, treat failures as alerts.
C. On account deletion: DELETE the Pulse identity in the same flow.
D. On purchase completion: POST the purchase event (idempotent by order id).
E. (Optional, recommended) A "Player 360" panel in OUR back-office that
   renders GET .../profile for support staff - it is PII-free by design.

## Acceptance checklist
- [ ] Identity round-trips; unsubscribes flip messageable.email to false.
- [ ] Setting rg_status=self_excluded makes messageable all-false.
- [ ] After DELETE, GET returns 410; re-PUT without reconsent is 410.
- [ ] A purchase event moves ltv/purchase_count on the next profile read.
- [ ] No PULSE_API_KEY or PII in built frontend assets.
Ask me for: PULSE_API_KEY, the player id mapping, our signup/consent/RG
hooks, and our account-deletion flow.
`;

export default function CrmDocs() {
  return (
    <>
      <h1>Pulse CRM</h1>
      <p className="lede">
        The retention brain: an <strong>encrypted identity vault</strong>,
        per-channel consent, first-class responsible-gaming state, and a
        PII-free <strong>Player 360 profile</strong> computed from the events
        you already send. Campaigns and automations build on this foundation.
      </p>

      <h2>Identity &amp; consent (the vault)</h2>
      <Endpoint method="PUT" path="/v1/crm/players/{player_id}/identity" />
      <Code>{`
{"email": "player@example.com", "first_name": "Sam", "birthday": "1990-04-12",
 "email_status": "subscribed", "rg_status": "ok"}
-> {..., "messageable": {"email": true, "sms": false}, "erased": false}
      `}</Code>
      <ul>
        <li><strong>Ciphertext at rest.</strong> Contact fields are encrypted
          before storage; the database never holds plaintext, and audit logs
          record field names, never values.</li>
        <li><strong>Merge-writes.</strong> Send only what changed — an
          unsubscribe webhook PUTs one field.</li>
        <li><strong>RG is first-class.</strong> <code>self_excluded</code> /
          <code> cooloff</code> blocks every channel, and — deliberately —
          <strong> survives erasure</strong>.</li>
        <li><strong>Erasure.</strong> <code>DELETE .../identity</code> wipes
          PII + consent and tombstones (reads return 410); re-ingest requires
          {" "}<code>reconsent: true</code>.</li>
      </ul>

      <h2>The Player 360 profile (PII-free)</h2>
      <Endpoint method="GET" path="/v1/crm/players/{player_id}/profile" />
      <Code>{`
-> {"ltv": 84500, "purchase_count": 12, "days_since_purchase": 3,
    "wagered_30d": 220000, "streak_len": 9,
    "churn_band": "active",          // active | cooling | at_risk | dormant | never_seen
    "vip_tier": "Gold", "days_to_birthday": 41,
    "messageable": {"email": true, "sms": false}, "rg_status": "ok"}
      `}</Code>
      <p>
        Computed from the event stream — reserved types{" "}
        <code>purchase</code> (LTV, recency), <code>wager</code>/<code>win</code>
        {" "}(play, GGR), plus streak and <a href="/vip">VIP</a> state. Safe to
        render in your back-office: player ids and aggregates only.
      </p>

      <div className="callout info">
        <strong>The send gate ships before sending does.</strong>{" "}
        <code>messageable</code> is computed from consent + RG + erasure, and
        every future Pulse campaign send must pass it. Suppressed players can
        never appear in an audience or an export.
      </div>

      <h2>Endpoint summary</h2>
      <table>
        <thead><tr><th>Endpoint</th><th>Purpose</th><th>Billable</th></tr></thead>
        <tbody>
          <tr><td><code>PUT /v1/crm/players/{"{id}"}/identity</code></td><td>push identity / consent / RG</td><td>no</td></tr>
          <tr><td><code>GET /v1/crm/players/{"{id}"}/identity</code></td><td>read identity + messageable</td><td>no</td></tr>
          <tr><td><code>DELETE /v1/crm/players/{"{id}"}/identity</code></td><td>right-to-erasure</td><td>no</td></tr>
          <tr><td><code>GET /v1/crm/players/{"{id}"}/profile</code></td><td>Player 360 (PII-free)</td><td>no</td></tr>
        </tbody>
      </table>

      <p className="muted">
        Coming next on this foundation: audience builder, campaign promo
        minting with export to your marketing tools, and self-driving
        retention automations. The docs will grow as each ships.
      </p>

      <AgentPrompt prompt={CRM_AGENT_PROMPT} />
    </>
  );
}
