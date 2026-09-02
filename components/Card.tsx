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
      className={`rounded-3xl border border-surface-border bg-surface p-10 ${className}`}
    >
      <h2 className="mb-5 text-3xl font-medium tracking-wide text-muted uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Unavailable({ reason }: { reason?: string }) {
  return (
    <p className="text-3xl text-muted">
      Unavailable{reason ? ` — ${reason}` : ""}
    </p>
  );
}
