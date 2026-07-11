import { ComingSoon } from "@/components/docs";

export default function Page() {
  return (
    <ComingSoon
      title="Leaderboards"
      blurb="Windowed competitions over player activity - wager races, win streaks, XP ladders - with automatic period close and prize distribution through the grant outbox."
      planned={[
        "Push player activity via a free batched ingestion endpoint (POST /v1/events) - wagers, wins, deposits, logins",
        "Boards are windowed (daily / weekly / monthly / custom) with configured scoring (volume, count, biggest single win)",
        "GET endpoints for the live board and a player's rank, cursor-paginated for lobby display",
        "Period close pays the configured prize table automatically - winners arrive in your grant outbox, signed like everything else",
        "Tie policy, minimum-activity floors, and prize tables configured with the Pulse team",
      ]}
    />
  );
}
