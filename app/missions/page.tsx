import { ComingSoon } from "@/components/docs";

export default function Page() {
  return (
    <ComingSoon
      title="Missions"
      blurb="Quests over the event stream: 'wager $50 on slots this week', 'log in 3 days running', 'win 5 times today' - progress tracked by Pulse, completions paid through the outbox."
      planned={[
        "Same free event ingestion as leaderboards - one integration feeds both",
        "Mission definitions (predicate, target, window, reward) configured with the Pulse team",
        "GET a player's active missions with live progress for your missions page",
        "Completions issue signed grants automatically; optional completion webhooks for toast notifications",
        "Daily / weekly mission rotations without code changes on your side",
      ]}
    />
  );
}
