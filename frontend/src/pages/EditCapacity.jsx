import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';
import FormField from '../components/FormField';
import AlertMessage from '../components/AlertMessage';
import PrimaryButton from '../components/PrimaryButton';

export default function EditCapacity() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [capacity, setCapacity] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const submitting = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    axiosInstance.get(`/api/events/${id}`, { headers: { Authorization: `Bearer ${user.token}` } })
      .then(({ data }) => { if (active) { setEvent(data); setCapacity(String(data.capacity)); } })
      .catch((failure) => { if (active) setError(failure.response?.data?.message || 'This festival could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, user.token, attempt]);
  const reserved = event ? event.capacity - event.remainingTickets : 0;
  const submit = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    const value = Number(capacity);
    if (capacity === '' || !Number.isSafeInteger(value) || value < reserved) {
      setError(`Enter a whole-number capacity of at least ${reserved}.`);
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      await axiosInstance.patch(`/api/events/${id}`, { capacity: value }, { headers: { Authorization: `Bearer ${user.token}` } });
      navigate('/organiser', { replace: true, state: { message: 'Ticket capacity updated successfully.' } });
    } catch (failure) {
      setError(failure.response?.data?.message || 'Capacity could not be updated. Please try again.');
    } finally { submitting.current = false; setSaving(false); }
  };
  return <section className="event-form-panel">
    <Link to="/organiser">Back to dashboard</Link><h1>Edit ticket capacity</h1>
    {loading ? <p role="status">Loading festival...</p> : <>
      <AlertMessage>{error}</AlertMessage>
      {event && <form onSubmit={submit}>
        <h2>{event.name}</h2><p>{reserved} tickets reserved. Capacity cannot be reduced below this number. New bookings may change it while you edit.</p>
        <FormField id="capacity" label="Total ticket capacity" type="number" min={reserved} step="1" required disabled={saving} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving capacity...' : 'Save capacity'}</PrimaryButton>
      </form>}
      <button className="secondary-button" type="button" disabled={saving} onClick={() => setAttempt(attempt + 1)}>Refresh event</button>
    </>}
  </section>;
}
