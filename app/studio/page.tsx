import { ComingSoon } from "@/components/docs";

export default function Page() {
  return (
    <ComingSoon
      title="Pulse Studio"
      blurb="Game aggregation: Pulse's own library of provably fair, server-authoritative games - fish tables, slots, and more - embeddable in your lobby the same way the wheel embeds today."
      planned={[
        "A game lobby API: list titles, launch a session for a player, receive wager/win events into your wallet flow",
        "Games run on Pulse's deterministic engine with replayable session recordings - every session is auditable after the fact",
        "First titles: Reef Raider (multiplayer fish table) and Kraken's Vault (slot with an exactly computed par sheet)",
        "Same trust model as everything else: your wallet, your players, our math",
      ]}
    />
  );
}
