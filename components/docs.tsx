// Shared docs primitives: the sidebar taxonomy and small content helpers.

import Link from "next/link";

export const NAV = [
  {
    label: "Start here",
    items: [
      { href: "/", title: "Getting Started", status: "live" },
    ],
  },
  {
    label: "Features",
    items: [
      { href: "/wheel", title: "Wheel Spins", status: "live" },
      { href: "/streaks", title: "Daily Login Streaks", status: "live" },
      { href: "/leaderboards", title: "Leaderboards", status: "soon" },
      { href: "/missions", title: "Missions", status: "soon" },
      { href: "/raffles", title: "Raffles", status: "soon" },
      { href: "/rakeback", title: "RakeBack", status: "soon" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/studio", title: "Pulse Studio", status: "soon" },
      { href: "/crm", title: "Pulse CRM", status: "soon" },
    ],
  },
] as const;

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        PULSE
        <small>developer documentation</small>
      </div>
      {NAV.map((group) => (
        <div className="navgroup" key={group.label}>
          <div className="grouplabel">{group.label}</div>
          <nav className="nav">
            {group.items.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.title}
                <span className={`badge ${item.status}`}>
                  {item.status === "live" ? "LIVE" : "SOON"}
                </span>
              </Link>
            ))}
          </nav>
        </div>
      ))}
    </aside>
  );
}

export function Endpoint({ method, path }: { method: string; path: string }) {
  return (
    <p>
      <span className="method">{method}</span>{" "}
      <span className="endpoint">{path}</span>
    </p>
  );
}

export function Code({ children }: { children: string }) {
  return (
    <pre>
      <code>{children.trim()}</code>
    </pre>
  );
}

export function ComingSoon({ title, blurb, planned }: {
  title: string; blurb: string; planned: string[];
}) {
  return (
    <>
      <h1>{title}</h1>
      <p className="lede">{blurb}</p>
      <div className="callout">
        <strong>Status: in development.</strong> The integration below is the
        planned shape and may change before release. Everything ships on the
        same foundation as the live features: server-to-server auth, the
        signed grant outbox, and idempotency keys — integrate one feature and
        the next ones are mostly configuration.
      </div>
      <h2>Planned integration surface</h2>
      <ul>
        {planned.map((p) => <li key={p}>{p}</li>)}
      </ul>
      <p className="muted">
        Want early access or to influence the design? Talk to your Pulse
        account contact.
      </p>
    </>
  );
}
