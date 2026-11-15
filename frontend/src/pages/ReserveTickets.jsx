import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';
import EventCard from '../components/EventCard';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import AlertMessage from '../components/AlertMessage';

export default function ReserveTickets() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const request = useRef(null);
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    axiosInstance.get(`/api/events/${id}`, { headers: { Authorization: `Bearer ${user.token}` } })
      .then(({ data }) => { if (active) setEvent(data); })
      .catch((failure) => { if (active) setError(failure.response?.data?.message || 'Unable to load this festival. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, user.token, attempt]);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    const count = Number(quantity);
    if (!Number.isInteger(count) || count < 1 || count > 4) {
      setError('Choose a whole number of tickets from 1 to 4.');
      return;
    }
    // Preserve the same request ID on retry, including after an uncertain network result.
    if (!request.current || request.current.eventId !== id || request.current.quantity !== count) {
      request.current = { eventId: id, quantity: count, requestId: window.crypto.randomUUID() };
    }
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      const { data } = await axiosInstance.post('/api/reservations', request.current, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      navigate(`/bookings/${data.bookingReference}`, { replace: true });
    } catch (failure) {
      setError(failure.response?.data?.message || 'The booking result is uncertain. Retry with the same quantity to safely check your booking.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const unavailable = event && (event.remainingTickets < 1 || new Date(event.date) <= new Date());
  return (
    <section>
      <Link to="/festivals">Back to festivals</Link>
      <header className="page-heading"><p className="eyebrow">Your place in the crowd</p><h1>Reserve your tickets</h1><p>Choose 1 to 4 tickets. Availability is checked when you confirm.</p></header>
      {loading ? <p role="status">Loading festival...</p> : <>
        <AlertMessage>{error}</AlertMessage>
        {!event && <PrimaryButton onClick={() => setAttempt(attempt + 1)}>Try again</PrimaryButton>}
        {event && <div className="booking-layout">
          <EventCard event={event} />
          <form className="booking-panel" onSubmit={submit}>
            <h2>Your reservation</h2>
            {unavailable && <AlertMessage>This festival is sold out or has already started.</AlertMessage>}
            <FormField id="quantity" label="Number of tickets (1–4)" type="number" min="1" max="4" step="1" required value={quantity} disabled={saving || unavailable} onChange={(e) => setQuantity(e.target.value)} />
            <p>Ticket value: <strong>{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(event.price * (Number(quantity) || 0))}</strong></p>
            <p>No payment is collected by this academic prototype.</p>
            <PrimaryButton type="submit" disabled={saving || unavailable}>{saving ? 'Confirming reservation...' : 'Confirm reservation'}</PrimaryButton>
            <button type="button" className="secondary-button" disabled={saving} onClick={() => setAttempt(attempt + 1)}>Refresh availability</button>
          </form>
        </div>}
      </>}
    </section>
  );
}
