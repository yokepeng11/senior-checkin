import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../LangContext';
import { t } from '../i18n';
import { api } from '../api';

// Sun SVG — from design
function SunIcon({ size = 58, color = '#1F9D55' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="16" fill={color} />
      <g stroke={color} strokeWidth="7" strokeLinecap="round">
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

// Returns a stable per-device UUID used as the caregiver's identity
function getDeviceId(): string {
  let id = localStorage.getItem('sc_caregiver_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('sc_caregiver_id', id);
  }
  return id;
}

export default function RoleSelect() {
  const navigate = useNavigate();
  const { lang, setLang } = useLang();
  const zf = (base: number) => Math.round(base * 1.4);

  // 'select' → role choice, 'enter-code' → invite code input, 'confirm' → show found senior
  const [step, setStep] = useState<'select' | 'enter-code' | 'confirm'>('select');
  const [codeInput, setCodeInput] = useState('');
  const [codeResult, setCodeResult] = useState<{ senior_id: string; name: string } | null>(null);
  const [codeError, setCodeError] = useState('');
  const [codeLinking, setCodeLinking] = useState(false);

  const findSeniorByCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (code.length < 4) { setCodeError('Please enter the full 6-character code.'); return; }
    setCodeError('');
    setCodeLinking(true);
    try {
      const result = await api.getSeniorByCode(code);
      setCodeResult(result);
      setStep('confirm');
    } catch {
      setCodeError('Code not found. Please check with your senior.');
    } finally { setCodeLinking(false); }
  };

  const confirmLink = async () => {
    if (!codeResult) return;
    setCodeLinking(true);
    try {
      const deviceId = getDeviceId();
      await api.linkCaregiverToSenior(deviceId, codeInput.trim().toUpperCase());
      localStorage.setItem('sc_role', 'caregiver');
      navigate('/nok', { replace: true });
    } catch {
      setCodeError('Could not link. Please try again.');
      setCodeLinking(false);
    }
  };

  // ── Invite-code entry step ────────────────────────────────────────────────
  if (step === 'enter-code' || step === 'confirm') {
    return (
      <div style={{
        minHeight: '100vh', background: '#e7e5df',
        fontFamily: "'Nunito', sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Back */}
          <button onClick={() => { setStep('select'); setCodeInput(''); setCodeError(''); setCodeResult(null); }} style={{
            border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 15, fontWeight: 700, color: '#8a857c',
            fontFamily: "'Nunito', sans-serif", marginBottom: 28, padding: 0,
          }}>← Back</button>

          {/* Icon + title */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 72, height: 72, borderRadius: 22,
              background: 'linear-gradient(135deg, #2E75B6, #1a5490)',
              boxShadow: '0 12px 28px rgba(46,117,182,0.3)',
              marginBottom: 16, fontSize: 34,
            }}>👨‍👩‍👧</div>
            <div style={{ fontSize: zf(26), fontWeight: 900, color: '#1F2421' }}>
              {step === 'confirm' ? 'Senior Found!' : 'Enter Invite Code'}
            </div>
            <div style={{ fontSize: zf(15), fontWeight: 600, color: '#8a857c', marginTop: 6 }}>
              {step === 'confirm'
                ? 'Confirm to link this senior to your dashboard.'
                : 'Ask your senior to open their app → Settings → Invite Code.'}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 20, padding: '22px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
            {step === 'enter-code' && <>
              <input
                type="text"
                value={codeInput}
                onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeError(''); }}
                onKeyDown={e => e.key === 'Enter' && findSeniorByCode()}
                placeholder="e.g. AH7K2M"
                maxLength={6}
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box',
                  border: codeError ? '2px solid #e74c3c' : '2px solid #e8e6e2',
                  borderRadius: 14, padding: '16px 18px',
                  fontSize: zf(26), fontWeight: 900, letterSpacing: '10px', textAlign: 'center',
                  fontFamily: 'monospace', color: '#1F9D55', outline: 'none',
                }}
              />
              {codeError && <div style={{ color: '#e74c3c', fontSize: 13, fontWeight: 700, marginTop: 8 }}>{codeError}</div>}
              <button onClick={findSeniorByCode} disabled={codeLinking} style={{
                width: '100%', marginTop: 18, border: 'none', borderRadius: 16, padding: '16px',
                background: codeLinking ? '#c8e6d4' : 'linear-gradient(135deg, #2E75B6, #1a5490)',
                fontSize: zf(17), fontWeight: 900, color: '#fff',
                fontFamily: "'Nunito', sans-serif", cursor: 'pointer',
              }}>
                {codeLinking ? 'Searching…' : 'Find Senior →'}
              </button>
            </>}

            {step === 'confirm' && codeResult && <>
              <div style={{ background: '#f0f7f3', borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
                <div style={{ fontSize: zf(22), fontWeight: 900, color: '#1F9D55' }}>{codeResult.name}</div>
                <div style={{ fontSize: zf(14), fontWeight: 600, color: '#9aa09c', marginTop: 4 }}>Code: {codeInput}</div>
              </div>
              {codeError && <div style={{ color: '#e74c3c', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{codeError}</div>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setStep('enter-code')} style={{
                  flex: 1, border: '2px solid #e8e6e2', borderRadius: 16, padding: '14px',
                  background: '#fff', fontSize: zf(16), fontWeight: 800, color: '#9aa09c',
                  fontFamily: "'Nunito', sans-serif", cursor: 'pointer',
                }}>Back</button>
                <button onClick={confirmLink} disabled={codeLinking} style={{
                  flex: 2, border: 'none', borderRadius: 16, padding: '14px',
                  background: codeLinking ? '#c8e6d4' : 'linear-gradient(135deg, #2E75B6, #1a5490)',
                  fontSize: zf(16), fontWeight: 900, color: '#fff',
                  fontFamily: "'Nunito', sans-serif", cursor: 'pointer',
                }}>
                  {codeLinking ? 'Linking…' : 'Confirm & Open Dashboard ✓'}
                </button>
              </div>
            </>}
          </div>
        </div>
      </div>
    );
  }

  // ── Role select step ──────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: '#e7e5df',
      fontFamily: "'Nunito', sans-serif",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Language toggle — top right */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <div style={{
            display: 'flex', background: '#fff', borderRadius: 12,
            padding: 4, gap: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            {(['en', 'zh'] as const).map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                border: 'none', cursor: 'pointer', borderRadius: 10,
                padding: '9px 20px', fontSize: 17, fontWeight: 800,
                fontFamily: "'Nunito', sans-serif",
                background: lang === l ? '#1F9D55' : 'transparent',
                color: lang === l ? '#fff' : '#8a857c',
                transition: 'background 0.18s, color 0.18s',
              }}>
                {l === 'en' ? 'EN' : '中文'}
              </button>
            ))}
          </div>
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 80, height: 80, borderRadius: 24,
            background: 'radial-gradient(circle at 50% 36%, #34BE76, #1F9D55 72%)',
            boxShadow: '0 12px 28px rgba(31,157,85,0.35)',
            marginBottom: 20 }}>
            <SunIcon size={44} color="#fff" />
          </div>
          <div style={{ fontSize: zf(34), fontWeight: 900, letterSpacing: '-0.8px', color: '#1F2421' }}>
            {t(lang, 'appTitle')}
          </div>
          <div style={{ fontSize: zf(16), fontWeight: 600, color: '#8a857c', marginTop: 6 }}>
            {t(lang, 'orgName')}
          </div>
        </div>

        {/* Senior button */}
        <button
          onClick={() => {
            localStorage.setItem('sc_role', 'senior');
            const seniorId = localStorage.getItem('sc_senior_id');
            if (seniorId) navigate(`/senior/${seniorId}`);
            else navigate('/senior/setup');
          }}
          style={{
            width: '100%', background: '#fff', border: 'none',
            borderRadius: 24, padding: '22px 24px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 18,
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            marginBottom: 14, textAlign: 'left',
          }}
        >
          <div style={{
            width: 64, height: 64, borderRadius: 20, flexShrink: 0,
            background: 'radial-gradient(circle at 50% 36%, #34BE76, #1F9D55 72%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <SunIcon size={36} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: zf(22), fontWeight: 900, color: '#1F2421' }}>{t(lang, 'iAmSenior')}</div>
            <div style={{ fontSize: zf(15), fontWeight: 600, color: '#8a857c', marginTop: 3 }}>
              {t(lang, 'seniorSubtitle')}
            </div>
          </div>
        </button>

        {/* NOK button */}
        <button
          onClick={() => {
            const deviceId = localStorage.getItem('sc_caregiver_id');
            if (deviceId) {
              // Returning caregiver — already set up, go straight to dashboard
              localStorage.setItem('sc_role', 'caregiver');
              navigate('/nok', { replace: true });
            } else {
              // New caregiver — ask for invite code first
              setStep('enter-code');
            }
          }}
          style={{
            width: '100%', background: '#fff', border: 'none',
            borderRadius: 24, padding: '22px 24px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 18,
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            textAlign: 'left',
          }}
        >
          <div style={{
            width: 64, height: 64, borderRadius: 20, flexShrink: 0,
            background: 'linear-gradient(135deg, #2E75B6, #1a5490)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30,
          }}>
            👨‍👩‍👧
          </div>
          <div>
            <div style={{ fontSize: zf(22), fontWeight: 900, color: '#1F2421' }}>{t(lang, 'iAmCaregiver')}</div>
            <div style={{ fontSize: zf(15), fontWeight: 600, color: '#8a857c', marginTop: 3 }}>
              {t(lang, 'caregiverSubtitle')}
            </div>
          </div>
        </button>

        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 13, fontWeight: 600, color: '#b5b0a8' }}>
          {t(lang, 'version')}
        </div>
      </div>
    </div>
  );
}
