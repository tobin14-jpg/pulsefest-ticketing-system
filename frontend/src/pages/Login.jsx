import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../axiosConfig';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import AlertMessage from '../components/AlertMessage';

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await axiosInstance.post('/api/auth/login', formData);
      login(response.data);
      navigate(location.state?.from || '/festivals', { replace: true });
    } catch (failure) {
      setError(failure.response?.data?.message || 'Unable to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-panel">
      <p className="eyebrow">Your next live moment starts here</p>
      <h1>Welcome to PulseFest</h1>
      <p>Log in to discover upcoming music festivals.</p>
      <form onSubmit={handleSubmit}>
        <AlertMessage>{error}</AlertMessage>
        <FormField id="email" label="Email" type="email" autoComplete="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
        <FormField id="password" label="Password" type="password" autoComplete="current-password" required value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
        <PrimaryButton type="submit" disabled={loading}>{loading ? 'Logging in…' : 'Log in'}</PrimaryButton>
      </form>
      <p>New here? <Link to="/register">Create an account</Link></p>
    </section>
  );
}
