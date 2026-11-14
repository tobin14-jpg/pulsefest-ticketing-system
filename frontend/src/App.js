import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Festivals from './pages/Festivals';
import { useAuth } from './context/AuthContext';

function RequireAuth({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
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
        <Route path="/tasks" element={<Navigate to="/festivals" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></main>
    </Router>
  );
}

export default App;
