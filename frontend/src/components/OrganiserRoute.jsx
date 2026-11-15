import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AlertMessage from './AlertMessage';

export default function OrganiserRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.role !== 'organiser') return <section><h1>Organiser access required</h1><AlertMessage>This account cannot manage festival events.</AlertMessage><Link to="/festivals">Back to festivals</Link></section>;
  return children;
}
