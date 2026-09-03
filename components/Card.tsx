export function Card({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface p-[1.2vh] ${className}`}
    >
      <h2 className="text-title mb-[0.6vh] shrink-0 font-medium tracking-wide text-muted uppercase">
        {title}
      </h2>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

export function Unavailable({ reason }: { reason?: string }) {
  return (
    <p className="text-body text-muted">
      Unavailable{reason ? ` — ${reason}` : ""}
    </p>
  );
}
