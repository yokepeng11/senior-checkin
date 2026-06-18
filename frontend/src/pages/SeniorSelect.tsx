import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Senior } from '../types';

export default function SeniorSelect() {
  const navigate = useNavigate();
  const [seniors, setSeniors] = useState<Senior[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSeniors()
      .then(setSeniors)
      .catch(() => setError('Could not connect to server. Is it running?'))
      .finally(() => setLoading(false));
  }, []);

  const phone = (
    <div style={{ minHeight: '100vh', background: '#e7e5df', fontFamily: "'Nunito', sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 402, minHeight: 500, background: '#F4F6F4', borderRadius: 48,
        overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)' }}>
        {/* Dynamic island */}
        <div style={{ margin: '11px auto 0', width: 126, height: 37, borderRadius: 24, background: '#000' }} />

        {/* Back */}
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/')} style={{ border: 'none', background: '#fff', width: 44, height: 44,
            borderRadius: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="22" viewBox="0 0 13 22" fill="none">
              <path d="M11 2L2 11l9 9" stroke="#1F9D55" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={{ fontSize: 24, fontWeight: 900 }}>Good morning!</div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#9aa09c', padding: '6px 24px 20px' }}>
          Please select your name below
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9aa09c', fontSize: 16, fontWeight: 600 }}>
            Loading…
          </div>
        )}

        {error && (
          <div style={{ margin: '0 18px', background: '#fff0f0', borderRadius: 18, padding: 20,
            fontSize: 15, fontWeight: 600, color: '#c0392b' }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <div style={{ padding: '0 18px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {seniors.map(s => (
              <button
                key={s.senior_id}
                onClick={() => navigate(`/senior/${s.senior_id}`)}
                style={{
                  width: '100%', background: '#fff', border: 'none', borderRadius: 22,
                  padding: '16px 20px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 16,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.05)', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 50, height: 50, borderRadius: 16, flexShrink: 0,
                  background: 'radial-gradient(circle at 50% 36%, #34BE76, #1F9D55 72%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 900, color: '#fff',
                }}>
                  {s.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: '#1F2421' }}>{s.name}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#9aa09c', marginTop: 2 }}>
                    ID: {s.senior_id}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return phone;
}
