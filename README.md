# Pulse Developer Docs

Public integration documentation for the Pulse gamification platform,
deployed on Vercel at docs.playwithpulse.com. Static Next.js - no env
vars, no backend.

Structure: Getting Started (trust model, auth, grant outbox, idempotency)
+ one page per feature. Live features (Wheel Spins, Daily Streaks) carry
full integration docs; upcoming features (Leaderboards, Missions,
Raffles, RakeBack) and platform products (Pulse Studio, Pulse CRM) are
roadmap stubs holding the information architecture.

Initial configuration (odds, budgets, themes) is done by the Pulse team -
these docs deliberately cover integration only.

```bash
npm install && npm run dev
```
