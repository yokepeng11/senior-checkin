import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

function SunIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="16" fill="#fff" />
      <g stroke="#fff" strokeWidth="7" strokeLinecap="round">
        <line x1="50" y1="8"  x2="50" y2="22" />
        <line x1="79.7" y1="20.3" x2="69.8" y2="30.2" />
        <line x1="92" y1="50" x2="78" y2="50" />
        <line x1="79.7" y1="79.7" x2="69.8" y2="69.8" />
        <line x1="50" y1="92" x2="50" y2="78" />
        <line x1="20.3" y1="79.7" x2="30.2" y2="69.8" />
        <line x1="8"  y1="50" x2="22" y2="50" />
        <line x1="20.3" y1="20.3" x2="30.2" y2="30.2" />
      </g>
    </svg>
  );
}

const TIMES = ['8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM',
               '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM'];

const inputStyle: React.CSSProperties = {
  width: '100%', border: 'none', outline: 'none',
  background: '#f5f4f0', borderRadius: 14, padding: '14px 16px',
  fontSize: 17, fontWeight: 700, color: '#1F2421',
  fontFamily: "'Nunito', sans-serif", boxSizing: 'border-box',
};

export default function SeniorSetup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [nokName, setNokName] = useState('');
  const [nokPhone, setNokPhone] = useState('');
  const [prefIdx, setPrefIdx] = useState(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!nokName.trim()) { setError("Please enter your caregiver's name."); return; }
    if (!nokPhone.trim()) { setError("Please enter your caregiver's contact number."); return; }

    setSaving(true);
    setError('');

    const label = TIMES[prefIdx];
    const h24 = (() => {
      const [hStr] = label.split(':');
      let h = parseInt(hStr);
      if (label.includes('PM') && h !== 12) h += 12;
      if (label.includes('AM') && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:00`;
    })();

    try {
      const created = await api.createSenior({
        name: name.trim(),
        phone_number: '',
        person_in_charge_name: nokName.trim(),
        person_in_charge_phone: nokPhone.trim(),
        preferred_checkin_time: h24,
      });
      // Save full profile so the app can silently recover if backend resets
      localStorage.setItem('sc_senior_id', created.senior_id);
      localStorage.setItem('sc_senior_profile', JSON.stringify({
        name: name.trim(),
        nokName: nokName.trim(),
        nokPhone: nokPhone.trim(),
        prefTime: h24,
      }));
      navigate(`/senior/${created.senior_id}`, { replace: true });
    } catch {
      setError('Could not save. Please check your connection and try again.');
      setSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#e7e5df',
      fontFamily: "'Nunito', sans-serif", color: '#1F2421',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '40px 24px 60px',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 72, height: 72, borderRadius: 22,
            background: 'radial-gradient(circle at 50% 36%, #34BE76, #1F9D55 72%)',
            boxShadow: '0 12px 28px rgba(31,157,85,0.30)',
            marginBottom: 16,
          }}>
            <SunIcon />
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px' }}>
            Welcome!
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#8a857c', marginTop: 6 }}>
            Let's set up your profile to get started.
          </div>
        </div>

        {/* Your details */}
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.7px',
          textTransform: 'uppercase', color: '#9aa09c', margin: '0 4px 10px' }}>
          Your details
        </div>
        <div style={{ background: '#fff', borderRadius: 22,
          padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#8a8f8b', marginBottom: 8 }}>
            Your name
          </div>
          <input
            style={inputStyle}
            placeholder="e.g. Mary Tan"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        {/* Preferred check-in time */}
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.7px',
          textTransform: 'uppercase', color: '#9aa09c', margin: '0 4px 10px' }}>
          Daily check-in time
        </div>
        <div style={{ background: '#fff', borderRadius: 22,
          padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#8a8f8b', marginBottom: 14 }}>
            Preferred check-in time
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <button onClick={() => setPrefIdx(i => Math.max(i - 1, 0))} style={{
              width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: '#eef1ee', color: '#1F9D55', fontSize: 28, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>−</button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 26, fontWeight: 900,
              color: '#1F9D55', letterSpacing: '-0.5px' }}>
              {TIMES[prefIdx]}
            </div>
            <button onClick={() => setPrefIdx(i => Math.min(i + 1, TIMES.length - 1))} style={{
              width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: '#eef1ee', color: '#1F9D55', fontSize: 28, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>+</button>
          </div>
        </div>

        {/* Caregiver/NOK */}
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.7px',
          textTransform: 'uppercase', color: '#9aa09c', margin: '0 4px 10px' }}>
          Caregiver / next of kin
        </div>
        <div style={{ background: '#fff', borderRadius: 22,
          padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#8a8f8b', marginBottom: 8 }}>
            Caregiver name
          </div>
          <input
            style={{ ...inputStyle, marginBottom: 14 }}
            placeholder="e.g. Sarah Tan"
            value={nokName}
            onChange={e => setNokName(e.target.value)}
          />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#8a8f8b', marginBottom: 8 }}>
            Contact number
          </div>
          <input
            style={inputStyle}
            placeholder="e.g. +65 9123 4567"
            value={nokPhone}
            onChange={e => setNokPhone(e.target.value)}
            type="tel"
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fdecea', borderRadius: 14, padding: '12px 16px',
            fontSize: 15, fontWeight: 700, color: '#c0392b', marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', border: 'none', borderRadius: 18,
            padding: '18px',
            background: saving ? '#a8d5b8' : 'radial-gradient(circle at 50% 36%, #34BE76, #1F9D55 72%)',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 19, fontWeight: 900, color: '#fff',
            fontFamily: "'Nunito', sans-serif",
            boxShadow: saving ? 'none' : '0 8px 20px rgba(31,157,85,0.30)',
          }}
        >
          {saving ? 'Setting up…' : 'Get Started'}
        </button>

        {/* Change role */}
        <button
          onClick={() => {
            localStorage.removeItem('sc_role');
            navigate('/');
          }}
          style={{
            width: '100%', border: 'none', background: 'none',
            marginTop: 16, cursor: 'pointer',
            fontSize: 14, fontWeight: 700, color: '#9aa09c',
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          ← Not a Senior? Change role
        </button>
      </div>
    </div>
  );
}
