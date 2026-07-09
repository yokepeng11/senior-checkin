import { useNavigate } from 'react-router-dom';
import { useLang } from '../LangContext';
import { t } from '../i18n';

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

export default function RoleSelect() {
  const navigate = useNavigate();
  const { lang, setLang } = useLang();
  // Scale font sizes up slightly for Chinese characters
  const zf = (base: number) => lang === 'zh' ? Math.round(base * 1.4) : Math.round(base * 1.1);

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
            localStorage.setItem('sc_role', 'caregiver');
            navigate('/nok');
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
