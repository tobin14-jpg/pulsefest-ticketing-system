import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';
import AlertMessage from '../components/AlertMessage';
import PrimaryButton from '../components/PrimaryButton';

export default function BookingConfirmation() {
  const { reference } = useParams();
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    axiosInstance.get(`/api/reservations/${reference}`, { headers: { Authorization: `Bearer ${user.token}` } })
      .then(({ data }) => { if (active) setBooking(data); })
      .catch((failure) => { if (active) setError(failure.response?.data?.message || 'Unable to load your booking. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reference, user.token, attempt]);

  return <section className="booking-panel confirmation">
    {loading ? <p role="status">Loading booking...</p> : error ? <>
      <h1>Booking details unavailable</h1><AlertMessage>{error}</AlertMessage>
      <PrimaryButton onClick={() => setAttempt(attempt + 1)}>Try again</PrimaryButton>
    </> : booking && <>
      <p className="eyebrow">You're on the list</p><h1>Reservation confirmed</h1>
      <AlertMessage type="success">Your {booking.quantity} {booking.quantity === 1 ? 'ticket is' : 'tickets are'} reserved.</AlertMessage>
      <h2>{booking.eventId?.name || 'Festival'}</h2>
      {booking.eventId && <p>{new Date(booking.eventId.date).toLocaleString('en-AU')} · {booking.eventId.location}</p>}
      <p>Booking reference</p><strong className="booking-reference">{booking.bookingReference}</strong>
      <p>Save this reference and page address for your records. No payment has been taken and no email ticket will be sent.</p>
    </>}
    <Link to="/festivals">Back to festivals</Link>
  </section>;
}
