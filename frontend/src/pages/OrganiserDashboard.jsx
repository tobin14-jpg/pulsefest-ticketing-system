import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';
import EventCard from '../components/EventCard';
import AlertMessage from '../components/AlertMessage';
import PrimaryButton from '../components/PrimaryButton';

export default function OrganiserDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    axiosInstance.get('/api/events/manage', { headers: { Authorization: `Bearer ${user.token}` } })
      .then(({ data }) => { if (active) setEvents(data); })
      .catch((failure) => { if (active) setError(failure.response?.data?.message || 'Events could not be loaded. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.token, attempt]);

  return <section>
    <header className="page-heading"><p className="eyebrow">Behind the music</p><h1>Organiser dashboard</h1><p>Create festivals and manage ticket availability.</p><Link className="primary-button" to="/organiser/events/new">Create festival</Link></header>
    <AlertMessage type="success">{location.state?.message}</AlertMessage>
    <div className="section-heading"><h2>All festival events</h2><span>Includes past and sold-out festivals</span></div>
    {loading ? <p role="status">Loading events...</p> : error ? <div><AlertMessage>{error}</AlertMessage><PrimaryButton onClick={() => setAttempt(attempt + 1)}>Try again</PrimaryButton></div> : events.length === 0 ? <div className="empty-state"><h2>No festivals yet</h2><p>Create your first festival to open ticket reservations.</p></div> :
      <div className="event-grid">{events.map((event) => <EventCard key={event._id} event={event}>
        <p>{event.reservedTickets} reserved / {event.capacity} total tickets</p>
        <Link className="primary-button" to={`/organiser/events/${event._id}/capacity`}>Edit ticket capacity</Link>
      </EventCard>)}</div>}
  </section>;
}
