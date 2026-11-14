import { useEffect, useState } from 'react';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';
import EventCard from '../components/EventCard';
import AlertMessage from '../components/AlertMessage';
import PrimaryButton from '../components/PrimaryButton';

export default function Festivals() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    axiosInstance.get('/api/events', { headers: { Authorization: `Bearer ${user.token}` } })
      .then(({ data }) => { if (active) setEvents(data); })
      .catch((failure) => {
        if (active) setError(failure.response?.data?.message || 'Unable to reach PulseFest. Please try again.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.token, attempt]);

  return (
    <section>
      <header className="page-heading">
        <p className="eyebrow">Find your next live moment</p>
        <h1>Feel the music.<br /><span>Find your festival.</span></h1>
        <p>Explore upcoming festivals and check ticket availability.</p>
      </header>
      <div className="section-heading"><h2>Upcoming festivals</h2><span>All times shown in your local timezone</span></div>
      {loading && <p role="status" className="empty-state">Loading festivals…</p>}
      {!loading && error && <div className="empty-state"><AlertMessage>{error}</AlertMessage><PrimaryButton onClick={() => setAttempt(attempt + 1)}>Try again</PrimaryButton></div>}
      {!loading && !error && events.length === 0 && <div className="empty-state"><h2>The next line-up is on its way.</h2><p>No upcoming festivals yet. Check back soon.</p></div>}
      {!loading && !error && events.length > 0 && <div className="event-grid">{events.map((event) => <EventCard key={event._id} event={event} />)}</div>}
    </section>
  );
}
