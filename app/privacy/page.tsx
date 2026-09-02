export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl p-16 text-lg leading-relaxed">
      <h1 className="mb-6 text-3xl font-semibold">Privacy Policy</h1>
      <p className="mb-4">
        Morning Dashboard is a personal, single-user application. It is not
        distributed or offered to the public.
      </p>
      <p className="mb-4">
        It reads calendar event data (titles and times) from Google Calendar
        accounts explicitly authorized by the app&apos;s owner, solely to
        display those events on a private household display. This data is
        never stored beyond the current server request, never shared with
        any third party, and never used for any purpose other than that
        display.
      </p>
      <p>
        Questions: contact the app owner directly.
      </p>
    </main>
  );
}
