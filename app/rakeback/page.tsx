import { ComingSoon } from "@/components/docs";

export default function Page() {
  return (
    <ComingSoon
      title="RakeBack"
      blurb="Automatic percentage returns on player activity - flat or tiered - computed from your ingested wager/rake events and paid on a schedule."
      planned={[
        "Feed rake/NGR events through the same free ingestion endpoint",
        "Flat or tier-laddered rates (e.g. bronze 5% -> diamond 15%) configured with the Pulse team",
        "Scheduled statements (daily / weekly / monthly) issue signed percent-of or fixed grants to the outbox",
        "GET a player's accrual-to-date for a live 'rakeback meter' UI",
      ]}
    />
  );
}
