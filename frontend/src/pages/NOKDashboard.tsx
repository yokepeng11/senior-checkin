import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Dashboard, DashboardSenior } from '../types';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0))).buffer;
}

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

const HIDDEN_KEY = 'sc_hidden_seniors'; // persists deleted senior names across DB resets

function loadHidden(): string[] {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'); } catch { return []; }
}

export default function NOKDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifStatus, setNotifStatus] = useState<'unknown'|'asking-phone'|'granted'|'denied'|'unsupported'>('unknown');
  const [caregiverPhone, setCaregiverPhone] = useState('');
  const [editMode, setEditMode] = useState(false);
  // Names of seniors the caregiver has deleted — persisted so they don't reappear after DB reset
  const [hiddenNames, setHiddenNames] = useState<string[]>(loadHidden);

  const load = async (spin = false) => {
    if (spin) setRefreshing(true);
    try { setData(await api.getDashboard()); }
    catch { /* keep stale */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  // Auto-refresh every 60 s so stats stay current without a manual reload
  useEffect(() => {
    const interval = setInterval(() => load(), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Also refresh whenever the app comes back to the foreground
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const removeSenior = async (senior_id: string, name: string) => {
    if (!confirm(`Remove ${name} from the dashboard?`)) return;
    try {
      await api.deleteSenior(senior_id);
    } catch { /* best effort — still hide locally even if API fails */ }
    // Always persist the name so they won't reappear even after a DB reset
    const updated = [...hiddenNames, name];
    setHiddenNames(updated);
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(updated));
    setData(prev => prev ? {
      ...prev,
      seniors: prev.seniors.filter(s => s.senior_id !== senior_id),
      total_seniors: prev.total_seniors - 1,
    } : prev);
  };

  // Check current notification permission (read-only, no prompt)
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setNotifStatus('unsupported'); return;
    }
    if (Notification.permission === 'granted') setNotifStatus('granted');
    else if (Notification.permission === 'denied') setNotifStatus('denied');
    else setNotifStatus('unknown');
  }, []);

  // Step 1 — show phone input first
  const handleEnableClick = () => setNotifStatus('asking-phone');

  // Step 2 — called after phone entered and confirmed (iOS user gesture)
  const enableNotifications = async () => {
    if (!caregiverPhone.trim()) { alert('Please enter your phone number.'); return; }
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Notifications are not available. Make sure the app is installed from the Home Screen.');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      setNotifStatus(perm === 'granted' ? 'granted' : 'denied');
      if (perm !== 'granted') return;

      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/push/caregiver-subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: caregiverPhone.trim(), subscription: { endpoint, keys } }),
      });
    } catch (e) {
      console.error('Caregiver push subscribe error:', e);
    }
  };

  // Compute stats from the locally-filtered list so deleted seniors don't inflate the counts
  const visibleSeniors = (data?.seniors ?? []).filter(s => !hiddenNames.includes(s.name));
  const totalVisible    = visibleSeniors.length;
  const checkedInVisible = visibleSeniors.filter(s => s.today_status.checked_in).length;
  const pendingVisible  = totalVisible - checkedInVisible;

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
            <button onClick={() => { localStorage.removeItem('sc_role'); navigate('/'); }} style={{
              background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff',
              fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700,
              padding: '6px 14px', borderRadius: 999, cursor: 'pointer', marginBottom: 14,
            }}>← Back</button>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>Caregiver Dashboard</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>{today}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 36 }}>
            <button onClick={() => setEditMode(e => !e)} style={{
              width: 44, height: 44, borderRadius: '50%',
              background: editMode ? 'rgba(220,50,50,0.5)' : 'rgba(255,255,255,0.18)',
              border: 'none', color: '#fff', cursor: 'pointer',
              fontSize: 15, fontWeight: 900, fontFamily: "'Nunito', sans-serif",
            }}>
              {editMode ? '✕' : '✏️'}
            </button>
            <button onClick={() => load(true)} style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff',
              cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            </button>
          </div>
        </div>

        {/* stats row */}
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'Total',      value: loading ? '—' : totalVisible,     bg: 'rgba(255,255,255,0.18)' },
            { label: 'Checked In', value: loading ? '—' : checkedInVisible, bg: 'rgba(255,255,255,0.25)' },
            { label: 'Pending',    value: loading ? '—' : pendingVisible,
              bg: pendingVisible > 0 ? 'rgba(220,50,50,0.45)' : 'rgba(255,255,255,0.18)' },
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
        {!loading && pendingVisible > 0 && (
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
              <strong>{pendingVisible} senior{pendingVisible > 1 ? 's have' : ' has'} not checked in yet.</strong>{' '}
              A WhatsApp alert will be sent at 12:00 PM if they remain unchecked.
            </div>
          </div>
        )}

        {!loading && pendingVisible === 0 && totalVisible > 0 && (
          <div style={{
            background: '#e3f3e9', borderRadius: 18, padding: '14px 18px',
            fontSize: 15, fontWeight: 700, color: '#15703C',
          }}>
            ✅ All seniors have checked in today. Great!
          </div>
        )}

        {/* Notification opt-in */}
        {notifStatus === 'unknown' && (
          <div style={{ background: '#fff', borderRadius: 18, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 28 }}>🔔</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1F2421' }}>Get notified at 12pm</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#9aa09c', marginTop: 2 }}>
                Only receive alerts for seniors assigned to you.
              </div>
            </div>
            <button onClick={handleEnableClick} style={{
              border: 'none', borderRadius: 12, padding: '10px 16px', cursor: 'pointer',
              background: 'radial-gradient(circle at 50% 36%, #34BE76, #1F9D55 72%)',
              fontSize: 14, fontWeight: 900, color: '#fff', fontFamily: "'Nunito', sans-serif",
              whiteSpace: 'nowrap',
            }}>Enable</button>
          </div>
        )}
        {notifStatus === 'asking-phone' && (
          <div style={{ background: '#fff', borderRadius: 18, padding: '18px 18px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1F2421', marginBottom: 6 }}>🔔 Enable Notifications</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#9aa09c', marginBottom: 14 }}>
              Enter your phone number so we can link you to your seniors.
            </div>
            <input
              type="tel"
              placeholder="e.g. +65 8268 7111"
              value={caregiverPhone}
              onChange={e => setCaregiverPhone(e.target.value)}
              style={{
                width: '100%', border: 'none', outline: 'none', boxSizing: 'border-box',
                background: '#f5f4f0', borderRadius: 12, padding: '12px 14px',
                fontSize: 16, fontWeight: 700, color: '#1F2421',
                fontFamily: "'Nunito', sans-serif", marginBottom: 12,
              }}
            />
            <button onClick={enableNotifications} style={{
              width: '100%', border: 'none', borderRadius: 12, padding: '13px', cursor: 'pointer',
              background: 'radial-gradient(circle at 50% 36%, #34BE76, #1F9D55 72%)',
              fontSize: 15, fontWeight: 900, color: '#fff', fontFamily: "'Nunito', sans-serif",
            }}>Confirm & Enable</button>
          </div>
        )}
        {notifStatus === 'granted' && (
          <div style={{ background: '#e3f3e9', borderRadius: 18, padding: '12px 18px',
            fontSize: 14, fontWeight: 700, color: '#15703C' }}>
            🔔 Notifications on — you'll be alerted at 12pm if anyone misses check-in.
          </div>
        )}
        {notifStatus === 'denied' && (
          <div style={{ background: '#fdecea', borderRadius: 18, padding: '12px 18px',
            fontSize: 14, fontWeight: 700, color: '#c0392b' }}>
            🔕 Notifications blocked. Go to phone Settings → this app → Notifications → Allow.
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase',
          color: '#9aa09c', padding: '4px 4px 0' }}>Seniors</div>

        {editMode && (
          <div style={{ background: '#fdecea', borderRadius: 14, padding: '10px 16px',
            fontSize: 14, fontWeight: 700, color: '#c0392b' }}>
            Tap ✕ on a senior to remove them from the dashboard.
          </div>
        )}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9aa09c', fontSize: 16, fontWeight: 600 }}>
            Loading…
          </div>
        ) : (
          data?.seniors
            .filter(s => !hiddenNames.includes(s.name))
            .map(s => (
              <div key={s.senior_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <SeniorCard s={s} onClick={() => !editMode && navigate(`/nok/senior/${s.senior_id}`)} />
                </div>
                {editMode && (
                  <button onClick={() => removeSenior(s.senior_id, s.name)} style={{
                    width: 44, height: 44, borderRadius: '50%', border: 'none',
                    background: '#e74c3c', color: '#fff', cursor: 'pointer',
                    fontSize: 20, fontWeight: 900, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>✕</button>
                )}
              </div>
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
