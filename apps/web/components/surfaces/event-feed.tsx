type EventFeedProps = {
  title: string;
  events: string[];
  emptyLabel?: string;
};

export function EventFeed({ title, events, emptyLabel = "Todavía no hay eventos." }: EventFeedProps) {
  return (
    <section className="game-panel game-panel-emerald game-briefing-lines rounded-[2rem] p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-200/70">{title}</p>
      <div className="mt-4 space-y-3">
        {events.length > 0 ? (
          events.map((event, index) => (
            <div
              key={`${event}-${index}`}
              className="game-chip rounded-2xl px-4 py-3 text-sm text-slate-200/82"
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
