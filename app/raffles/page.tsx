import { ComingSoon } from "@/components/docs";

export default function Page() {
  return (
    <ComingSoon
      title="Raffles"
      blurb="Scheduled prize draws with provably fair selection - the same commit-reveal machinery as wheel spins, applied to ticket pools."
      planned={[
        "Issue tickets by API (deposit rewards, activity milestones - your rules) or automatically from ingested events",
        "GET a player's tickets and the pool total - exact odds are always displayable (your tickets / total tickets)",
        "Draws run on a configured schedule with a pre-published commitment; results verifiable by anyone after the reveal",
        "Winners land in the grant outbox; multi-winner and tiered-prize draws supported",
      ]}
    />
  );
}
