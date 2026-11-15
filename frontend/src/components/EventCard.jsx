export default function EventCard({ event }) {
  const date = new Date(event.date);
  return (
    <article className="event-card">
      <div className="event-card-top">
        <span className="eyebrow">Live music</span>
        <span className={event.remainingTickets > 0 ? 'badge' : 'badge sold-out'}>
          {event.remainingTickets > 0 ? `${event.remainingTickets} tickets left` : 'Sold out'}
        </span>
      </div>
      <h2>{event.name}</h2>
      <p className="event-description">{event.description || 'A festival of live music. Find your next favourite sound.'}</p>
      <dl className="event-details">
        <div><dt>When</dt><dd><time dateTime={event.date}>{date.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</time></dd></div>
        <div><dt>Where</dt><dd>{event.location}</dd></div>
      </dl>
      <div className="event-price">{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(event.price)} <span>per ticket</span></div>
    </article>
  );
}
