import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import RoleSelect from './pages/RoleSelect';
import SeniorSetup from './pages/SeniorSetup';
import SeniorHome from './pages/SeniorHome';
import NOKDashboard from './pages/NOKDashboard';
import SeniorDetail from './pages/SeniorDetail';

function SmartRoot() {
  const navigate = useNavigate();
  useEffect(() => {
    const role = localStorage.getItem('sc_role');
    const seniorId = localStorage.getItem('sc_senior_id');
    if (role === 'caregiver') navigate('/nok', { replace: true });
    else if (role === 'senior' && seniorId) navigate(`/senior/${seniorId}`, { replace: true });
    else if (role === 'senior') navigate('/senior/setup', { replace: true });
  }, [navigate]);
  return <RoleSelect />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SmartRoot />} />
        <Route path="/senior/setup" element={<SeniorSetup />} />
        <Route path="/senior/:id" element={<SeniorHome />} />
        <Route path="/nok" element={<NOKDashboard />} />
        <Route path="/nok/senior/:id" element={<SeniorDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
