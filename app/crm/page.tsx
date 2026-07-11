import { ComingSoon } from "@/components/docs";

export default function Page() {
  return (
    <ComingSoon
      title="Pulse CRM"
      blurb="A sweepstakes-centric CRM and marketing suite built on the event stream your integration already produces - segmentation, lifecycle journeys, and reward automation that speaks GC/SC natively."
      planned={[
        "Player segments from real activity (depositors going quiet, streak-breakers, jackpot winners) - no data export pipelines",
        "Journey automation: trigger wheel-spin grants, bonus drops, or missions as campaign actions through the same grant machinery",
        "Sweepstakes-aware compliance guardrails baked into campaign tooling",
        "Attribution reporting tied to the same audit log as the money",
      ]}
    />
  );
}
