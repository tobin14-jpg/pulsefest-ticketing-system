import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import AlertMessage from '../components/AlertMessage';

export default function CreateFestival() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', description: '', date: '', location: '', price: '', capacity: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const change = (e) => setForm({ ...form, [e.target.id]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    const date = new Date(form.date);
    const price = Number(form.price);
    const capacity = Number(form.capacity);
    if (!form.name.trim() || !form.location.trim() || !Number.isFinite(date.getTime()) || date <= new Date() ||
      form.price === '' || !Number.isFinite(price) || price < 0 || form.capacity === '' || !Number.isSafeInteger(capacity) || capacity < 0) {
      setError('Complete all required fields with a future date, non-negative price and whole-number capacity.');
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      await axiosInstance.post('/api/events', { ...form, name: form.name.trim(), location: form.location.trim(), date: date.toISOString(), price, capacity }, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      navigate('/organiser', { replace: true, state: { message: 'Festival created successfully.' } });
    } catch (failure) {
      setError(failure.response?.data?.message || 'The result is uncertain. Check the dashboard before trying to create this festival again.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };
  return <section className="event-form-panel">
    <Link to="/organiser">Back to dashboard</Link><p className="eyebrow">Bring the crowd together</p><h1>Create festival</h1>
    <form onSubmit={submit}>
      <AlertMessage>{error}</AlertMessage>
      <fieldset disabled={saving}>
        <FormField id="name" label="Festival name" required maxLength={120} value={form.name} onChange={change} />
        <div className="form-field"><label htmlFor="description">Description (optional)</label><textarea id="description" rows={4} maxLength={2000} value={form.description} onChange={change} /></div>
        <FormField id="date" label="Date and time (your local timezone)" type="datetime-local" required value={form.date} onChange={change} />
        <FormField id="location" label="Location" required maxLength={200} value={form.location} onChange={change} />
        <FormField id="price" label="Ticket price (AUD)" type="number" min="0" step="0.01" required value={form.price} onChange={change} />
        <FormField id="capacity" label="Total ticket capacity" type="number" min="0" step="1" required value={form.capacity} onChange={change} />
        <PrimaryButton type="submit">{saving ? 'Creating festival...' : 'Create festival'}</PrimaryButton>
      </fieldset>
    </form>
  </section>;
}
