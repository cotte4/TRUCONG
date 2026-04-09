type EventFeedProps = {
  title: string;
  events: string[];
  emptyLabel?: string;
};

export function EventFeed({ title, events, emptyLabel = "Todavía no hay eventos." }: EventFeedProps) {
  return (
    <section className="rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 shadow-2xl shadow-emerald-950/20 backdrop-blur">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-200/70">{title}</p>
      <div className="mt-4 space-y-3">
        {events.length > 0 ? (
          events.map((event, index) => (
            <div
              key={`${event}-${index}`}
              className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-200/82"
            >
              {event}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-300">{emptyLabel}</p>
        )}
      </div>
    </section>
  );
}
