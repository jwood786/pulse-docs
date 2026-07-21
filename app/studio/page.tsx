import { AgentPrompt } from "@/components/AgentPrompt";
import { Code } from "@/components/docs";

const STUDIO_AGENT_PROMPT = `
Add "Pulse Rewards" to this back-office / admin portal. Pulse is the
gamification platform this site already integrates (wheel, streaks,
raffles, promos, VIP, CRM). Two pieces: a link-out to the hosted Studio,
and (optional but recommended) an embedded Player 360 panel.

## Non-negotiable rules
1. TWO different keys, never confused:
   - PULSE_API_KEY ("prw_..."): backend-only, moves money/PII. Already in
     our server env. NEVER used in anything browser-facing.
   - The Studio key ("pss_..."): configs-only. It is NOT stored in this
     codebase at all - a human enters it once on Pulse's hosted Studio
     sign-in page, which keeps it in an httpOnly cookie on Pulse's domain.
2. Two integration modes - pick ONE:
   - LINK-OUT (simplest): a nav link to the hosted Studio; operator signs
     in once with their pss_ key.
   - SIGNED EMBED (in-panel iframe): our backend mints a single-use embed
     URL per page-load and we iframe it - the operator never types a key.
     Never cache or reuse embed URLs; they are single-use and expire in 60s.
3. The Player 360 panel calls Pulse through OUR backend with PULSE_API_KEY
   and renders the PII-free profile - safe for support staff.

## Build these pieces
A. EITHER a back-office nav item "Rewards Studio" -> opens
   https://admin.playwithpulse.com/studio in a new tab (hint: "sign in
   with your Pulse Studio key, pss_..."),
   OR the signed embed: a staff-authenticated backend endpoint
   GET /api/admin/studio-embed that calls
   POST https://api.playwithpulse.com/v1/studio/embed-token
   (Authorization: Bearer PULSE_API_KEY - the FULL prw_ key; the pss_
   Studio key deliberately CANNOT mint embed tokens and returns 401)
   -> {embed_url, expires_in: 60}
   and returns embed_url; the admin page then renders
   <iframe src={embed_url} style="width:100%;height:85vh;border:0"/>.
   Mint a FRESH token on every page view (single-use, 60s TTL). The
   session inside the iframe persists via a partitioned cookie afterward.
B. (Recommended) A "Player" panel on our customer-view page:
   backend GET /api/admin/pulse-profile?player_id=... (staff-authenticated)
   -> proxies GET https://api.playwithpulse.com/v1/crm/players/{id}/profile
   with PULSE_API_KEY, returns as-is. Render: VIP tier + progress, LTV,
   churn band, streak, wagered_30d, days_since_purchase, rg_status badge,
   messageable badges. This response is PII-free by design.
C. (Optional) same pattern for GET /v1/vip/players/{id} (claim states) and
   GET /v1/raffles/{id}/winners on an ops dashboard.

## Acceptance checklist
- [ ] Studio opens from our nav; no pss_ key stored anywhere in this repo.
- [ ] The profile panel renders for a real player id; shows RG badge.
- [ ] PULSE_API_KEY appears nowhere in built frontend assets.
- [ ] Staff without back-office auth cannot reach the proxy endpoints.
Ask me for: where the back-office nav is defined, the customer-view page,
and how staff authentication works in this codebase.
`;

export default function StudioDocs() {
  return (
    <>
      <h1>Pulse Studio</h1>
      <p className="lede">
        The operator console: configure your wheel, streaks, leaderboards,
        raffles, promo codes, and VIP program yourself — every change
        validated with the platform&apos;s own budget rules and versioned,
        live on save. Hosted by Pulse; added to your admin portal with a link.
      </p>

      <h2>Getting access</h2>
      <ol>
        <li>Ask your Pulse account manager for a <strong>Studio key</strong>
          {" "}(<code>pss_…</code>).</li>
        <li>Open{" "}
          <code>https://admin.playwithpulse.com/studio</code> and sign in with
          it — once per browser; it&apos;s held in an httpOnly cookie.</li>
        <li>You&apos;ll see a tab for every feature <em>your plan includes</em> —
          author configs, hit Save, and the change governs the very next
          spin/claim/draw.</li>
      </ol>

      <h2>Adding it to your admin portal</h2>
      <p>Two modes. The simple one is a link-out:</p>
      <Code>{`
<a href="https://admin.playwithpulse.com/studio" target="_blank">
  Rewards Studio
</a>
      `}</Code>
      <h3>Or embed it in-panel (signed embed)</h3>
      <p>
        For a true in-dashboard tab, your backend mints a{" "}
        <strong>single-use embed URL</strong> and you iframe it — the operator
        is auto-signed-in, no key typing, no third-party-cookie login:
      </p>
      <Code>{`
POST https://api.playwithpulse.com/v1/studio/embed-token
Authorization: Bearer <PULSE_API_KEY>          // backend only, as always
-> {"token": "pse_...", "expires_in": 60,
    "embed_url": "https://admin.playwithpulse.com/studio/embed?token=pse_..."}

<iframe src={embed_url} style="width:100%;height:85vh;border:0" />
      `}</Code>
      <ul>
        <li><strong>Minted with your full API key</strong> (<code>prw_</code>,
          backend-only) — the <code>pss_</code> Studio key deliberately{" "}
          <em>cannot</em> mint embed tokens (a config-scoped credential must
          not be able to open sessions) and returns 401 if you try.</li>
        <li>Tokens are <strong>single-use and expire in 60 seconds</strong> —
          mint a fresh one on every page view, never cache the URL.</li>
        <li>After the first load the embedded session persists via a
          partitioned (CHIPS) cookie, so in-iframe navigation and reloads
          don&apos;t need a new token.</li>
        <li>The embedded Studio carries the same scope as the pss_ key:
          configs only, plan and money out of reach.</li>
      </ul>
      <p>
        Pair it with an embedded <strong>Player 360 panel</strong> on your
        customer-view page (via your backend, using your normal API key) —
        the <a href="/crm">profile read</a> is PII-free by design, so support
        staff can see VIP tier, LTV, churn band, and RG status without
        touching personal data. The agent prompt below builds both.
      </p>

      <h2>The Studio key security model</h2>
      <table>
        <thead><tr><th></th><th><code>prw_</code> API key</th><th><code>pss_</code> Studio key</th></tr></thead>
        <tbody>
          <tr><td>Lives in</td><td>your server environment</td><td>a staff browser (httpOnly cookie)</td></tr>
          <tr><td>Scope</td><td>everything — money, PII, events</td><td><strong>reward configs only</strong></td></tr>
          <tr><td>Can edit reward configs</td><td>yes</td><td>yes (its purpose)</td></tr>
          <tr><td>Can mint embed sessions</td><td>yes</td><td><strong>no</strong> (401)</td></tr>
          <tr><td>Can edit your billing plan</td><td>—</td><td><strong>no, ever</strong></td></tr>
          <tr><td>Rotation impact</td><td>breaks your integration until redeployed</td><td>none — rotate freely on staff changes</td></tr>
        </tbody>
      </table>
      <p className="muted">
        Every save is validated (an over-budget wheel cannot be saved) and
        versioned — you can always see what changed and when. Ask Pulse to
        rotate the Studio key whenever someone with access leaves.
      </p>

      <AgentPrompt prompt={STUDIO_AGENT_PROMPT} />
    </>
  );
}
