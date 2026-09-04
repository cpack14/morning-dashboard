import { getSecurityStatus, setSecurityStatus } from "@/lib/securityStatus";
import { getSettings, setSettings, type DashboardSettings } from "@/lib/settings";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

function toHourMinute(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function numberField(formData: FormData, key: string, fallback: number): number {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function Field({
  label,
  explainer,
  children,
}: {
  label: string;
  explainer: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      <span className="text-xs text-muted">{explainer}</span>
    </label>
  );
}

const inputClass =
  "rounded-lg border border-surface-border bg-surface px-3 py-2 text-foreground";

export default async function SettingsPage() {
  const [status, settings] = await Promise.all([getSecurityStatus(), getSettings()]);
  const isAway = status === "away";

  async function toggleAway() {
    "use server";
    const current = await getSecurityStatus();
    await setSecurityStatus(current === "away" ? "home" : "away");
    revalidatePath("/away");
  }

  async function saveSettings(formData: FormData) {
    "use server";
    const current = await getSettings();
    const [wakeHour, wakeMinute] = String(formData.get("defaultWakeTime") ?? "")
      .split(":")
      .map(Number);

    const updated: DashboardSettings = {
      defaultWakeHour: Number.isFinite(wakeHour) ? wakeHour : current.defaultWakeHour,
      defaultWakeMinute: Number.isFinite(wakeMinute)
        ? wakeMinute
        : current.defaultWakeMinute,
      getReadyMinutes: numberField(formData, "getReadyMinutes", current.getReadyMinutes),
      personalArrivalBufferMinutes: numberField(
        formData,
        "personalArrivalBufferMinutes",
        current.personalArrivalBufferMinutes,
      ),
      workArrivalBufferMinutes: numberField(
        formData,
        "workArrivalBufferMinutes",
        current.workArrivalBufferMinutes,
      ),
      earlyMeetingCutoffHour: numberField(
        formData,
        "earlyMeetingCutoffHour",
        current.earlyMeetingCutoffHour,
      ),
      afternoonCutoffHour: numberField(
        formData,
        "afternoonCutoffHour",
        current.afternoonCutoffHour,
      ),
      sundayNoonCutoffHour: numberField(
        formData,
        "sundayNoonCutoffHour",
        current.sundayNoonCutoffHour,
      ),
      workEmailDomain:
        String(formData.get("workEmailDomain") ?? "").trim() || current.workEmailDomain,
      alarmRampSeconds: numberField(
        formData,
        "alarmRampSeconds",
        current.alarmRampSeconds,
      ),
      snoozeMinutes: numberField(formData, "snoozeMinutes", current.snoozeMinutes),
    };

    await setSettings(updated);
    revalidatePath("/away");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-10 bg-background p-8 text-foreground">
      <section className="flex flex-col items-center gap-6 text-center">
        <p className="text-sm uppercase tracking-wide text-muted">
          Morning dashboard status
        </p>
        <p
          className={`text-6xl font-semibold ${isAway ? "text-accent-warn" : "text-accent-personal"}`}
        >
          {isAway ? "Away" : "Home"}
        </p>
        <form action={toggleAway}>
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
      </section>

      <form action={saveSettings} className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Alarm &amp; wake time</h2>

          <Field
            label="Default wake time"
            explainer="Used on days with no meetings on the calendar at all."
          >
            <input
              type="time"
              name="defaultWakeTime"
              defaultValue={toHourMinute(settings.defaultWakeHour, settings.defaultWakeMinute)}
              className={inputClass}
              required
            />
          </Field>

          <Field
            label="Get-ready minutes"
            explainer="How long before your first meeting (or the calculated leave-by time) the alarm goes off."
          >
            <input
              type="number"
              name="getReadyMinutes"
              defaultValue={settings.getReadyMinutes}
              min={0}
              className={inputClass}
              required
            />
          </Field>

          <Field
            label="Alarm ramp-up (seconds)"
            explainer="How long the alarm takes to fade in from near-silent to full volume."
          >
            <input
              type="number"
              name="alarmRampSeconds"
              defaultValue={settings.alarmRampSeconds}
              min={1}
              className={inputClass}
              required
            />
          </Field>

          <Field
            label="Snooze duration (minutes)"
            explainer="How long pressing Snooze delays the alarm before it rings again."
          >
            <input
              type="number"
              name="snoozeMinutes"
              defaultValue={settings.snoozeMinutes}
              min={1}
              className={inputClass}
              required
            />
          </Field>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Commute</h2>

          <Field
            label="Personal event arrival buffer (minutes)"
            explainer="How many minutes early to plan on arriving for personal-calendar events."
          >
            <input
              type="number"
              name="personalArrivalBufferMinutes"
              defaultValue={settings.personalArrivalBufferMinutes}
              min={0}
              className={inputClass}
              required
            />
          </Field>

          <Field
            label="Work meeting arrival buffer (minutes)"
            explainer="How many minutes early to plan on arriving for work meetings."
          >
            <input
              type="number"
              name="workArrivalBufferMinutes"
              defaultValue={settings.workArrivalBufferMinutes}
              min={0}
              className={inputClass}
              required
            />
          </Field>

          <Field
            label="Early-meeting cutoff hour"
            explainer="Meetings before this hour (24h clock) are assumed to be attended from home — no commute is planned around them."
          >
            <input
              type="number"
              name="earlyMeetingCutoffHour"
              defaultValue={settings.earlyMeetingCutoffHour}
              min={0}
              max={23}
              className={inputClass}
              required
            />
          </Field>

          <Field
            label="Afternoon cutoff hour"
            explainer="On weekdays, after this hour (24h clock) the Current Commute card switches from showing your commute to work to your next personal event instead."
          >
            <input
              type="number"
              name="afternoonCutoffHour"
              defaultValue={settings.afternoonCutoffHour}
              min={0}
              max={23}
              className={inputClass}
              required
            />
          </Field>

          <Field
            label="Sunday noon cutoff hour"
            explainer="On Sundays, switches the commute destination from church (before this hour) to the Bountiful address (after)."
          >
            <input
              type="number"
              name="sundayNoonCutoffHour"
              defaultValue={settings.sundayNoonCutoffHour}
              min={0}
              max={23}
              className={inputClass}
              required
            />
          </Field>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Meeting classification</h2>

          <Field
            label="Work email domain"
            explainer='Attendees outside this domain count a work meeting as "client" instead of "internal".'
          >
            <input
              type="text"
              name="workEmailDomain"
              defaultValue={settings.workEmailDomain}
              className={inputClass}
              required
            />
          </Field>
        </section>

        <button
          type="submit"
          className="rounded-2xl bg-accent-work px-6 py-3 text-lg font-medium text-foreground"
        >
          Save settings
        </button>
      </form>
    </main>
  );
}
