import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../axiosConfig';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import AlertMessage from '../components/AlertMessage';

export default function Register() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await axiosInstance.post('/api/auth/register', formData);
      login(response.data);
      navigate('/festivals');
    } catch (failure) {
      setError(failure.response?.data?.message || 'Unable to register. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-panel">
      <p className="eyebrow">Join the crowd</p>
      <h1>Create your account</h1>
      <p>Discover music festivals with PulseFest.</p>
      <form onSubmit={handleSubmit}>
        <AlertMessage>{error}</AlertMessage>
        <FormField id="name" label="Name" autoComplete="name" required maxLength={120} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
        <FormField id="email" label="Email" type="email" autoComplete="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
        <FormField id="password" label="Password" type="password" autoComplete="new-password" required value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
        <PrimaryButton type="submit" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</PrimaryButton>
      </form>
      <p>Already registered? <Link to="/login">Log in</Link></p>
    </section>
  );
}
