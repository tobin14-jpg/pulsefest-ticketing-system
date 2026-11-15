import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Festivals from './pages/Festivals';
import ReserveTickets from './pages/ReserveTickets';
import BookingConfirmation from './pages/BookingConfirmation';
import { useAuth } from './context/AuthContext';

function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  return user ? children : <Navigate to="/login" state={{ from: location.pathname }} replace />;
}

function App() {
  return (
    <Router>
      <Navbar />
      <main className="page-container"><Routes>
        <Route path="/" element={<Navigate to="/festivals" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/festivals" element={<RequireAuth><Festivals /></RequireAuth>} />
        <Route path="/festivals/:id/reserve" element={<RequireAuth><ReserveTickets /></RequireAuth>} />
        <Route path="/bookings/:reference" element={<RequireAuth><BookingConfirmation /></RequireAuth>} />
        <Route path="/tasks" element={<Navigate to="/festivals" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></main>
    </Router>
  );
}

export default App;
