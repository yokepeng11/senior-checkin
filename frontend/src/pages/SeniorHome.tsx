import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Senior, DailyStatus } from '../types';
import { useLang } from '../LangContext';
import { t } from '../i18n';

// ── SVG sun (white rays, for the button) ──────────────────────────────────────
function SunWhite({ size = 58 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="16" fill="#fff" />
      <g stroke="#fff" strokeWidth="7" strokeLinecap="round">
        <line x1="50"  y1="8"    x2="50"  y2="22" />
        <line x1="79.7" y1="20.3" x2="69.8" y2="30.2" />
        <line x1="92"  y1="50"   x2="78"  y2="50" />
        <line x1="79.7" y1="79.7" x2="69.8" y2="69.8" />
        <line x1="50"  y1="92"   x2="50"  y2="78" />
        <line x1="20.3" y1="79.7" x2="30.2" y2="69.8" />
        <line x1="8"   y1="50"   x2="22"  y2="50" />
        <line x1="20.3" y1="20.3" x2="30.2" y2="30.2" />
      </g>
    </svg>
  );
}

// ── SVG sun (amber, for confirmation screen) ──────────────────────────────────
function SunAmber({ size = 150 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="17" fill="#FFB733" />
      <g stroke="#F6A623" strokeWidth="7" strokeLinecap="round">
        <line x1="50"  y1="7"    x2="50"  y2="22" />
        <line x1="80.4" y1="19.6" x2="69.8" y2="30.2" />
        <line x1="93"  y1="50"   x2="78"  y2="50" />
        <line x1="80.4" y1="80.4" x2="69.8" y2="69.8" />
        <line x1="50"  y1="93"   x2="50"  y2="78" />
        <line x1="19.6" y1="80.4" x2="30.2" y2="69.8" />
        <line x1="7"   y1="50"   x2="22"  y2="50" />
        <line x1="19.6" y1="19.6" x2="30.2" y2="30.2" />
      </g>
    </svg>
  );
}

// ── Sliders icon for settings button ─────────────────────────────────────────
function SettingsIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
      <g stroke="#5a605b" strokeWidth="2.3" strokeLinecap="round">
        <line x1="4" y1="8" x2="24" y2="8" />
        <line x1="4" y1="14" x2="24" y2="14" />
        <line x1="4" y1="20" x2="24" y2="20" />
      </g>
      <circle cx="10" cy="8" r="3.4" fill="#F4F6F4" stroke="#5a605b" strokeWidth="2.3" />
      <circle cx="18" cy="14" r="3.4" fill="#F4F6F4" stroke="#5a605b" strokeWidth="2.3" />
      <circle cx="9"  cy="20" r="3.4" fill="#F4F6F4" stroke="#5a605b" strokeWidth="2.3" />
    </svg>
  );
}


// ── helpers ───────────────────────────────────────────────────────────────────
function fmtTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

function fmtNow() {
  const d = new Date();
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

function fmtDate(lang: string) {
  const locale = lang === 'zh' ? 'zh-SG' : 'en-SG';
  return new Date().toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
}

// Convert VAPID public key from base64url to Uint8Array (required by pushManager.subscribe)
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0))).buffer;
}

// ── main component ────────────────────────────────────────────────────────────
type Screen = 'main' | 'confirm' | 'settings';

export default function SeniorHome() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lang, setLang } = useLang();
  const zf = (base: number) => Math.round(base * 1.4);

  const [senior, setSenior] = useState<Senior | null>(null);
  const [status, setStatus] = useState<DailyStatus | null>(null);
  const [screen, setScreen] = useState<Screen>('main');
  const [checkInTime, setCheckInTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [pressing, setPressing] = useState(false);
  const [prefIdx, setPrefIdx] = useState(2); // default 9:00 AM
  const [settingsName, setSettingsName] = useState('');
  const [settingsNokName, setSettingsNokName] = useState('');
  const [settingsNokPhone, setSettingsNokPhone] = useState('');
  const [notifStatus, setNotifStatus] = useState<'unknown'|'granted'|'denied'|'unsupported'>('unknown');
  const [notifLoading, setNotifLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const TIMES = ['8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM',
                 '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM'];

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [s, st] = await Promise.all([api.getSenior(id), api.getTodayStatus(id)]);
      setSenior(s);
      setStatus(st);
      setSettingsName(s.name || '');
      setSettingsNokName(s.person_in_charge_name || '');
      setSettingsNokPhone(s.person_in_charge_phone || '');
      // init time picker from saved setting
      const savedTime = s.preferred_checkin_time; // "09:00"
      const [h] = (savedTime || '09:00').split(':').map(Number);
      const idx = TIMES.findIndex(t => {
        const tH = parseInt(t);
        const tHadj = t.includes('PM') && tH !== 12 ? tH + 12 : (t.includes('AM') && tH === 12 ? 0 : tH);
        return tHadj === h;
      });
      if (idx >= 0) setPrefIdx(idx);
    } catch {
      // Backend may have reset (free tier) — try to silently recreate from cached profile
      const cached = localStorage.getItem('sc_senior_profile');
      if (cached) {
        try {
          const p = JSON.parse(cached);
          const created = await api.createSenior({
            name: p.name,
            phone_number: '',
            person_in_charge_name: p.nokName,
            person_in_charge_phone: p.nokPhone,
            preferred_checkin_time: p.prefTime,
          });
          localStorage.setItem('sc_senior_id', created.senior_id);
          navigate(`/senior/${created.senior_id}`, { replace: true });
          return;
        } catch { /* fall through to setup */ }
      }
      localStorage.removeItem('sc_senior_id');
      navigate('/senior/setup', { replace: true });
    }
    finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Push notification status check + auto re-subscribe if already granted ────
  useEffect(() => {
    if (!id) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setNotifStatus('unsupported'); return;
    }
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

    if (Notification.permission === 'granted') {
      setNotifStatus('granted');
      // Auto re-subscribe silently — handles Render DB resets where senior_id changes
      if (vapidKey) {
        (async () => {
          try {
            const reg = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;
            const existing = await reg.pushManager.getSubscription();
            const sub = existing ?? await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey),
            });
            const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
            await api.subscribePush(id, { endpoint, keys: keys as { p256dh: string; auth: string } });
          } catch { /* best effort */ }
        })();
      }
    } else if (Notification.permission === 'denied') {
      setNotifStatus('denied');
    } else {
      setNotifStatus('unknown');
    }
  }, [id]);

  // ── Turn off notifications ────────────────────────────────────────────────────
  const turnOffNotifications = async () => {
    setNotifLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api.unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setNotifStatus('unknown');
    } catch { /* best effort */ }
    setNotifLoading(false);
  };

  // ── Enable notifications — called from a button tap (required by iOS) ────────
  const enableNotifications = async () => {
    if (!id) return;
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) { alert(lang === 'zh' ? '通知尚未配置，请稍后重试。' : 'Notifications are not configured yet. Please try again later.'); return; }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert(lang === 'zh' ? '您的设备不支持推送通知。' : 'Your device does not support push notifications.'); return;
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
      await api.subscribePush(id, { endpoint, keys: keys as { p256dh: string; auth: string } });
    } catch (e) {
      console.error('Push subscribe error:', e);
    }
  };

  const handleCheckin = async () => {
    if (!id || pressing || status?.checked_in) return;
    setPressing(true);
    setTimeout(() => setPressing(false), 200);

    try {
      const result = await api.checkin(id);
      const t = fmtTime(result.confirmed_at) || fmtNow();
      setCheckInTime(t);
      setScreen('confirm');
      if ('vibrate' in navigator) navigator.vibrate([80, 30, 80]);
      timerRef.current = setTimeout(() => {
        setScreen('main');
        setStatus({ checked_in: true, last_checkin_time: result.confirmed_at, date: new Date().toISOString().split('T')[0] });
      }, 3200);
    } catch {
      alert(lang === 'zh' ? '无法记录报到，请重试。' : 'Could not record check-in. Please try again.');
    }
  };

  const handleReset = () => {
    clearTimeout(timerRef.current);
    setScreen('main');
    setStatus(prev => prev ? { ...prev, checked_in: false, last_checkin_time: null } : null);
    setCheckInTime('');
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const saveSettings = async () => {
    if (!id) return;
    const label = TIMES[prefIdx];
    const h24 = (() => {
      const [hStr] = label.split(':');
      let h = parseInt(hStr);
      if (label.includes('PM') && h !== 12) h += 12;
      if (label.includes('AM') && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:00`;
    })();
    try {
      await api.updateSenior(id, {
        name: settingsName,
        person_in_charge_name: settingsNokName,
        person_in_charge_phone: settingsNokPhone,
        preferred_checkin_time: h24,
      });
      setSenior(prev => prev ? {
        ...prev,
        name: settingsName,
        person_in_charge_name: settingsNokName,
        person_in_charge_phone: settingsNokPhone,
      } : prev);
      // Keep cached profile in sync so silent recovery stays up to date
      localStorage.setItem('sc_senior_profile', JSON.stringify({
        name: settingsName,
        nokName: settingsNokName,
        nokPhone: settingsNokPhone,
        prefTime: h24,
      }));
    } catch {}
    setScreen('main');
  };

  const firstName = senior?.name?.split(' ')[0] ?? 'Friend';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#e7e5df', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 48 }}>☀️</div>
      </div>
    );
  }

  // ── Confirmation screen ───────────────────────────────────────────────────
  const ConfirmScreen = (
    <div style={{
      flex: 1,
      background: 'linear-gradient(180deg, #FFF7E4 0%, #EAF6EE 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 40,
    }}>
      {/* halo + sun */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center',
        justifyContent: 'center', width: 200, height: 200 }}>
        <div className="anim-halo" style={{
          position: 'absolute', width: 190, height: 190, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,184,51,0.5) 0%, rgba(255,184,51,0) 68%)',
        }} />
        <div className="anim-sun-in">
          <SunAmber size={150} />
        </div>
      </div>

      <div className="anim-fade-up delay-250" style={{ fontSize: zf(32), fontWeight: 900, color: '#15703C', marginTop: 30 }}>
        {t(lang, 'checkinSuccess')}
      </div>
      <div className="anim-fade-up delay-400" style={{ fontSize: zf(21), fontWeight: 700, color: '#6b8a76', marginTop: 8 }}>
        {t(lang, 'greatDay')}
      </div>
      <div className="anim-fade-up delay-550" style={{
        position: 'absolute', bottom: 64,
        fontSize: zf(17), fontWeight: 700, color: '#a7b0a9',
      }}>
        {t(lang, 'checkedInAt')} {checkInTime}
      </div>
    </div>
  );

  // ── Settings screen ───────────────────────────────────────────────────────
  const inputSt: React.CSSProperties = {
    width: '100%', border: 'none', outline: 'none',
    background: '#f5f4f0', borderRadius: 12, padding: '11px 14px',
    fontSize: zf(16), fontWeight: 700, color: '#1F2421',
    fontFamily: "'Nunito', sans-serif", boxSizing: 'border-box',
  };

  const SettingsScreen = (
    <div style={{ flex: 1, background: '#F4F6F4', display: 'flex', flexDirection: 'column',
      paddingTop: 'max(env(safe-area-inset-top), 52px)' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 18px 16px' }}>
        <button onClick={() => setScreen('main')} style={{
          border: 'none', background: '#fff', width: 44, height: 44,
          borderRadius: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="13" height="22" viewBox="0 0 13 22" fill="none">
            <path d="M11 2L2 11l9 9" stroke="#1F9D55" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div style={{ fontSize: zf(24), fontWeight: 900, marginLeft: 16 }}>{t(lang, 'settings')}</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '6px 18px 24px' }}>
        {/* your details */}
        <div style={{ fontSize: zf(13), fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase',
          color: '#9aa09c', margin: '8px 6px 10px' }}>{t(lang, 'yourDetailsSetting')}</div>
        <div style={{ background: '#fff', borderRadius: 22, padding: '18px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: zf(14), fontWeight: 700, color: '#8a8f8b', marginBottom: 6 }}>{t(lang, 'yourName')}</div>
          <input style={inputSt} value={settingsName} onChange={e => setSettingsName(e.target.value)} placeholder={t(lang, 'yourName')} />
        </div>

        {/* time section */}
        <div style={{ fontSize: zf(13), fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase',
          color: '#9aa09c', margin: '20px 6px 10px' }}>{t(lang, 'dailyReminder')}</div>
        <div style={{ background: '#fff', borderRadius: 22, padding: '18px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: zf(14), fontWeight: 700, color: '#8a8f8b', marginBottom: 12 }}>{t(lang, 'preferredCheckinTime')}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <button onClick={() => setPrefIdx(i => Math.max(i - 1, 0))} style={{
              width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: '#eef1ee', color: '#1F9D55', fontSize: 30, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>−</button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: zf(28), fontWeight: 900,
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

        {/* caregiver */}
        <div style={{ fontSize: zf(13), fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase',
          color: '#9aa09c', margin: '20px 6px 10px' }}>{t(lang, 'caregiverNok')}</div>
        <div style={{ background: '#fff', borderRadius: 22, padding: '18px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: zf(14), fontWeight: 700, color: '#8a8f8b', marginBottom: 6 }}>{t(lang, 'caregiverName')}</div>
          <input style={{ ...inputSt, marginBottom: 14 }} value={settingsNokName}
            onChange={e => setSettingsNokName(e.target.value)} placeholder={t(lang, 'caregiverName')} />
          <div style={{ fontSize: zf(14), fontWeight: 700, color: '#8a8f8b', marginBottom: 6 }}>{t(lang, 'contactNumber')}</div>
          <input style={inputSt} value={settingsNokPhone} type="tel"
            onChange={e => setSettingsNokPhone(e.target.value)} placeholder="+65 9123 4567" />
        </div>

        {/* notifications */}
        <div style={{ fontSize: zf(13), fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase',
          color: '#9aa09c', margin: '20px 6px 10px' }}>{t(lang, 'notifications')}</div>
        <div style={{ background: '#fff', borderRadius: 22, padding: '18px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          {notifStatus === 'granted' ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 26 }}>🔔</span>
                <div>
                  <div style={{ fontSize: zf(16), fontWeight: 800, color: '#1F9D55' }}>{t(lang, 'notifOn')}</div>
                  <div style={{ fontSize: zf(13), fontWeight: 600, color: '#9aa09c', marginTop: 2 }}>
                    {t(lang, 'notifOnSub')}
                  </div>
                </div>
              </div>
              <button onClick={turnOffNotifications} disabled={notifLoading} style={{
                width: '100%', border: 'none', borderRadius: 12, padding: '12px',
                background: notifLoading ? '#f5f4f0' : '#fdecea',
                cursor: notifLoading ? 'not-allowed' : 'pointer',
                fontSize: zf(15), fontWeight: 800, color: '#c0392b',
                fontFamily: "'Nunito', sans-serif",
              }}>
                {notifLoading ? t(lang, 'turningOff') : t(lang, 'turnOff')}
              </button>
            </div>
          ) : notifStatus === 'denied' ? (
            <div>
              <div style={{ fontSize: zf(15), fontWeight: 700, color: '#c0392b', marginBottom: 6 }}>
                {t(lang, 'notifBlocked')}
              </div>
              <div style={{ fontSize: zf(13), fontWeight: 600, color: '#9aa09c', lineHeight: 1.5 }}>
                {t(lang, 'notifBlockedSub')}
              </div>
            </div>
          ) : notifStatus === 'unsupported' ? (
            <div style={{ fontSize: zf(14), fontWeight: 600, color: '#9aa09c' }}>
              {t(lang, 'notifUnsupported')}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: zf(15), fontWeight: 700, color: '#1F2421', marginBottom: 8 }}>
                {t(lang, 'notifUnknownTitle')}
              </div>
              <button onClick={enableNotifications} style={{
                width: '100%', border: 'none', borderRadius: 14,
                padding: '14px', cursor: 'pointer',
                background: 'radial-gradient(circle at 50% 36%, #34BE76, #1F9D55 72%)',
                fontSize: zf(16), fontWeight: 900, color: '#fff',
                fontFamily: "'Nunito', sans-serif",
              }}>
                {t(lang, 'turnOn')}
              </button>
            </div>
          )}
        </div>

        {/* language */}
        <div style={{ fontSize: zf(13), fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase',
          color: '#9aa09c', margin: '20px 6px 10px' }}>{t(lang, 'language')}</div>
        <div style={{ background: '#fff', borderRadius: 22, padding: '18px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['en', 'zh'] as const).map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                flex: 1, border: 'none', borderRadius: 14, padding: '14px',
                cursor: 'pointer', fontSize: zf(18), fontWeight: 800,
                fontFamily: "'Nunito', sans-serif",
                background: lang === l ? 'radial-gradient(circle at 50% 36%, #34BE76, #1F9D55 72%)' : '#f5f4f0',
                color: lang === l ? '#fff' : '#5a605b',
                transition: 'background 0.18s, color 0.18s',
              }}>
                {l === 'en' ? t(lang, 'langEn') : t(lang, 'langZh')}
              </button>
            ))}
          </div>
        </div>

        {/* info banner */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start',
          background: '#FFF7E4', borderRadius: 18, padding: '14px 16px', marginTop: 18 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="11" fill="#F6A623"/>
            <rect x="11" y="6.5" width="2" height="8" rx="1" fill="#fff"/>
            <circle cx="12" cy="17" r="1.4" fill="#fff"/>
          </svg>
          <div style={{ fontSize: zf(14), fontWeight: 600, color: '#8a6a16', lineHeight: 1.45 }}>
            {t(lang, 'alertBanner')}
          </div>
        </div>

        {/* save */}
        <button onClick={saveSettings} style={{
          marginTop: 20, width: '100%',
          background: 'radial-gradient(circle at 50% 36%, #34BE76, #1F9D55 72%)',
          border: 'none', borderRadius: 18, padding: '16px', cursor: 'pointer',
          fontSize: zf(18), fontWeight: 900, color: '#fff',
        }}>
          {t(lang, 'saveSettings')}
        </button>

        {/* change role */}
        <button onClick={() => {
          localStorage.removeItem('sc_role');
          localStorage.removeItem('sc_senior_id');
          navigate('/');
        }} style={{
          marginTop: 12, width: '100%', background: 'none', border: 'none',
          cursor: 'pointer', fontSize: zf(14), fontWeight: 700, color: '#b5b0a8',
          fontFamily: "'Nunito', sans-serif",
        }}>
          {t(lang, 'changeRole')}
        </button>
      </div>
    </div>
  );

  // ── Main screen ───────────────────────────────────────────────────────────
  const MainScreen = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
      padding: 'env(safe-area-inset-top, 60px) 28px env(safe-area-inset-bottom, 28px)',
      paddingTop: 'max(env(safe-area-inset-top), 60px)',
      paddingBottom: 'max(env(safe-area-inset-bottom), 28px)' }}>
      {/* header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: zf(22), fontWeight: 700, color: '#8a8f8b' }}>{t(lang, 'goodMorning')}</div>
        <div style={{ fontSize: zf(38), fontWeight: 900, letterSpacing: '-0.8px', marginTop: 2 }}>{firstName}</div>
        <div style={{ fontSize: zf(17), fontWeight: 700, color: '#aeb2ae', marginTop: 12 }}>{fmtDate(lang)}</div>
      </div>

      {/* button or already-checked */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        {status?.checked_in ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>☀️</div>
            <div style={{ fontSize: zf(22), fontWeight: 800, color: '#1F9D55' }}>{t(lang, 'allDone')}</div>
            <div style={{ fontSize: zf(16), fontWeight: 700, color: '#aeb2ae', marginTop: 8 }}>
              {t(lang, 'checkedInAt')} {fmtTime(status.last_checkin_time)}
            </div>
            <div style={{ fontSize: zf(15), fontWeight: 600, color: '#c4c8c3', marginTop: 4 }}>{t(lang, 'seeTomorrow')}</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: zf(17), fontWeight: 700, color: '#aeb2ae', textAlign: 'center', letterSpacing: '0.1px' }}>
              {t(lang, 'tapToCheckin')}
            </div>
            <button
              onClick={handleCheckin}
              className={pressing ? 'anim-press' : 'anim-breathe'}
              style={{
                width: 240, height: 240, borderRadius: 9999, border: 'none', cursor: 'pointer',
                padding: 0,
                background: 'radial-gradient(circle at 50% 36%, #34BE76, #1F9D55 72%)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
                color: '#fff', fontFamily: "'Nunito', sans-serif",
              }}
              aria-label="Tap to check in for today"
            >
              <SunWhite size={52} />
              <span style={{ fontSize: zf(27), fontWeight: 900, letterSpacing: '0.2px' }}>{t(lang, 'buttonLabel')}</span>
              <span style={{ fontSize: zf(15), fontWeight: 700, opacity: 0.85, letterSpacing: '0.3px' }}>
                {t(lang, 'buttonSub')}
              </span>
            </button>
          </>
        )}
      </div>

      {/* footer bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        {status?.checked_in ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            background: '#e3f3e9', color: '#15703C',
            padding: '13px 18px', borderRadius: 16, fontSize: zf(16), fontWeight: 800, flex: 1,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" fill="#1F9D55"/>
              <path d="M7 12.5l3.2 3.3L17 8.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t(lang, 'checkedInAt')} {fmtTime(status.last_checkin_time)}
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            background: '#ececea', color: '#7d827e',
            padding: '13px 18px', borderRadius: 16, fontSize: zf(16), fontWeight: 800, flex: 1,
          }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#c4c8c3', display: 'inline-block' }} />
            {t(lang, 'notYet')}
          </div>
        )}

        {/* Settings icon */}
        <button onClick={() => setScreen('settings')} aria-label="Settings" style={{
          flexShrink: 0, width: 52, height: 52, borderRadius: 16, border: 'none', cursor: 'pointer',
          background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SettingsIcon />
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: '#F4F6F4',
      fontFamily: "'Nunito', sans-serif", WebkitFontSmoothing: 'antialiased',
      display: 'flex', flexDirection: 'column' }}>
      {screen === 'confirm' && ConfirmScreen}
      {screen === 'settings' && SettingsScreen}
      {screen === 'main' && MainScreen}
    </div>
  );
}
