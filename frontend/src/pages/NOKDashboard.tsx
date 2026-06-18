import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Dashboard, DashboardSenior } from '../types';

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

function SeniorCard({ s, onClick }: { s: DashboardSenior; onClick: () => void }) {
  const checked = s.today_status.checked_in;
  const rateColor = s.check_in_rate >= 80 ? '#15703C' : s.check_in_rate >= 60 ? '#b5740f' : '#c0392b';
  const rateBg   = s.check_in_rate >= 80 ? '#e3f3e9' : s.check_in_rate >= 60 ? '#fdf0e3' : '#fdecea';

  return (
    <button onClick={onClick} style={{
      width: '100%', background: '#fff', border: 'none', borderRadius: 22,
      padding: '16px 18px', cursor: 'pointer', textAlign: 'left',
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    }}>
      {/* avatar */}
      <div style={{
        width: 50, height: 50, borderRadius: 16, flexShrink: 0,
        background: checked
          ? 'radial-gradient(circle at 50% 36%, #34BE76, #1F9D55 72%)'
          : '#e8e6e2',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 900, color: checked ? '#fff' : '#9aa09c',
      }}>
        {s.name.charAt(0)}
      </div>

      {/* info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#1F2421' }}>{s.name}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: rateColor,
            background: rateBg, padding: '3px 9px', borderRadius: 999 }}>
            {s.check_in_rate}%
          </span>
        </div>
        {checked ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" fill="#1F9D55"/>
              <path d="M7 12.5l3.2 3.3L17 8.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1F9D55' }}>
              Checked in at {fmtTime(s.today_status.last_checkin_time)}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#c4c8c3', display: 'inline-block' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#9aa09c' }}>Not yet checked in today</span>
          </div>
        )}
      </div>
      <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
        <path d="M1 1l6 6-6 6" stroke="#c4c8c3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

export default function NOKDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (spin = false) => {
    if (spin) setRefreshing(true);
    try { setData(await api.getDashboard()); }
    catch { /* keep stale */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const today = new Date().toLocaleDateString('en-SG',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: '#e7e5df', fontFamily: "'Nunito', sans-serif", color: '#1F2421' }}>
      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1F9D55, #2E75B6)',
        padding: '56px 24px 28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <button onClick={() => navigate('/')} style={{
              background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff',
              fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700,
              padding: '6px 14px', borderRadius: 999, cursor: 'pointer', marginBottom: 14,
            }}>← Back</button>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>Caregiver Dashboard</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>{today}</div>
          </div>
          <button onClick={() => load(true)} style={{
            marginTop: 36, width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff',
            cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>↻</span>
          </button>
        </div>

        {/* stats row */}
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'Total', value: data?.total_seniors ?? '—', bg: 'rgba(255,255,255,0.18)' },
            { label: 'Checked In', value: data?.checked_in_today ?? '—', bg: 'rgba(255,255,255,0.25)' },
            { label: 'Pending', value: data?.not_checked_in ?? '—',
              bg: (data?.not_checked_in ?? 0) > 0 ? 'rgba(220,50,50,0.45)' : 'rgba(255,255,255,0.18)' },
          ].map(stat => (
            <div key={stat.label} style={{
              flex: 1, background: stat.bg, borderRadius: 18, padding: '14px 10px',
              textAlign: 'center', color: '#fff',
            }}>
              <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, opacity: 0.9 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* alert banner */}
        {(data?.not_checked_in ?? 0) > 0 && (
          <div style={{
            background: '#FFF7E4', borderRadius: 18, padding: '14px 18px',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="11" fill="#F6A623"/>
              <rect x="11" y="6.5" width="2" height="8" rx="1" fill="#fff"/>
              <circle cx="12" cy="17" r="1.4" fill="#fff"/>
            </svg>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#8a6a16', lineHeight: 1.45 }}>
              <strong>{data!.not_checked_in} senior{data!.not_checked_in > 1 ? 's have' : ' has'} not checked in yet.</strong>{' '}
              An SMS alert will be sent at 12:00 PM if they remain unchecked.
            </div>
          </div>
        )}

        {(data?.not_checked_in ?? 0) === 0 && (data?.total_seniors ?? 0) > 0 && (
          <div style={{
            background: '#e3f3e9', borderRadius: 18, padding: '14px 18px',
            fontSize: 15, fontWeight: 700, color: '#15703C',
          }}>
            ✅ All seniors have checked in today. Great!
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase',
          color: '#9aa09c', padding: '4px 4px 0' }}>Seniors</div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9aa09c', fontSize: 16, fontWeight: 600 }}>
            Loading…
          </div>
        ) : (
          data?.seniors.map(s => (
            <SeniorCard key={s.senior_id} s={s} onClick={() => navigate(`/nok/senior/${s.senior_id}`)} />
          ))
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '8px 18px 28px' }}>
        <button onClick={() => {
          localStorage.removeItem('sc_role');
          navigate('/');
        }} style={{
          border: 'none', background: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 700, color: '#b5b0a8',
          fontFamily: "'Nunito', sans-serif",
        }}>
          Change role / Switch device
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
