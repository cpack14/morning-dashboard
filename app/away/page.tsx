import { getSecurityStatus, setSecurityStatus } from "@/lib/securityStatus";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function AwayTogglePage() {
  const status = await getSecurityStatus();
  const isAway = status === "away";

  async function toggle() {
    "use server";
    await setSecurityStatus(isAway ? "home" : "away");
    revalidatePath("/away");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background p-8 text-center text-foreground">
      <p className="text-sm uppercase tracking-wide text-muted">
        Morning dashboard status
      </p>
      <p
        className={`text-6xl font-semibold ${isAway ? "text-accent-warn" : "text-accent-personal"}`}
      >
        {isAway ? "Away" : "Home"}
      </p>
      <form action={toggle}>
        <button
          type="submit"
          className={`rounded-2xl px-10 py-5 text-xl font-medium text-black ${
            isAway ? "bg-accent-personal" : "bg-accent-warn"
          }`}
        >
          Set to {isAway ? "Home" : "Away"}
        </button>
      </form>
      <p className="max-w-xs text-sm text-muted">
        While set to Away, the TV won&apos;t turn on and the morning alarm
        won&apos;t fire, no matter what the calendar says.
      </p>
    </main>
  );
}
