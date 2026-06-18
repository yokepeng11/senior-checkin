import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Senior, CheckinHistory, Report } from '../types';

function fmtTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

function fmtDateShort(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtDayLabel(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-SG', { weekday: 'short' }).slice(0, 3);
}

// ── Weekly bar chart (exact design from dc.html) ─────────────────────────────
function WeekBars({ history }: { history: CheckinHistory[] }) {
  const last7 = [...history].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {last7.map(day => {
        const ok = !!day.checked_in_today;
        return (
          <div key={day.date} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              height: 64, borderRadius: 12,
              background: ok ? '#1F9D55' : 'rgba(242,201,76,0.2)',
              border: ok ? 'none' : '2px dashed #E0A93B',
              display: 'flex', alignItems: ok ? 'flex-end' : 'center',
              justifyContent: 'center', paddingBottom: ok ? 8 : 0,
            }}>
              {ok ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12.5l4.2 4.3L19 7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M7 7l10 10M17 7L7 17" stroke="#C98A1E" strokeWidth="2.6" strokeLinecap="round"/>
                </svg>
              )}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800,
              color: ok ? '#6b726e' : '#C98A1E', marginTop: 7 }}>
              {fmtDayLabel(day.date)}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: ok ? '#aeb2ae' : '#d3b27a' }}>
              {ok ? fmtTime(day.last_checkin_time) : 'missed'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Caregiver report card (exact design from dc.html) ────────────────────────
function ReportCard({ report, label }: { report: Report; label: string }) {
  const missed = report.missed_dates;
  const avgTime = (() => {
    const times = report.history.filter(d => d.checked_in_today && d.last_checkin_time)
      .map(d => new Date(d.last_checkin_time!));
    if (!times.length) return null;
    const avg = times.reduce((s, d) => s + d.getHours() * 60 + d.getMinutes(), 0) / times.length;
    const h = Math.floor(avg / 60), m = Math.round(avg % 60);
    const ap = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
  })();

  const headlineOk = report.check_in_rate >= 80;
  const headline = headlineOk
    ? `${report.senior.name.split(' ')[0]}'s week looked good.`
    : `${report.senior.name.split(' ')[0]} missed ${report.missed_days} day${report.missed_days > 1 ? 's' : ''} this period.`;

  return (
    <div style={{
      background: '#fff', borderRadius: 18, overflow: 'hidden',
      boxShadow: '0 12px 40px rgba(0,0,0,0.10)', marginBottom: 24,
    }}>
      {/* gradient header */}
      <div style={{
        background: 'linear-gradient(120deg, #1F9D55, #2E75B6)',
        padding: '24px 28px', color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="16" fill="#fff"/>
              <g stroke="#fff" strokeWidth="8" strokeLinecap="round">
                <line x1="50" y1="9" x2="50" y2="22"/>
                <line x1="80" y1="20" x2="70" y2="30"/>
                <line x1="91" y1="50" x2="78" y2="50"/>
                <line x1="80" y1="80" x2="70" y2="70"/>
                <line x1="50" y1="91" x2="50" y2="78"/>
                <line x1="20" y1="80" x2="30" y2="70"/>
                <line x1="9"  y1="50" x2="22" y2="50"/>
                <line x1="20" y1="20" x2="30" y2="30"/>
              </g>
            </svg>
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '1px', opacity: 0.9 }}>
            DAILY CHECK-IN · {label.toUpperCase()}
          </div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 900 }}>{headline}</div>
        <div style={{ fontSize: 15, fontWeight: 600, opacity: 0.9, marginTop: 4 }}>
          {label} report · last {report.total_days} days
        </div>
      </div>

      {/* stats row */}
      <div style={{ padding: '24px 28px 0' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1, background: '#e3f3e9', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#15703C', lineHeight: 1 }}>
              {report.checked_in_days}<span style={{ fontSize: 18, color: '#7bbf97' }}>/{report.total_days}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#4f7a62', marginTop: 6 }}>Days checked in</div>
          </div>
          {avgTime && (
            <div style={{ flex: 1, background: '#eef3f8', borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#1E5A91', lineHeight: 1 }}>
                {avgTime.split(' ')[0]}<span style={{ fontSize: 16, color: '#84a6c5' }}> {avgTime.split(' ')[1]}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#5a7e9e', marginTop: 6 }}>Avg check-in</div>
            </div>
          )}
          <div style={{ flex: 1, background: report.missed_days > 0 ? '#fdf0e3' : '#e3f3e9', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 900,
              color: report.missed_days > 0 ? '#b5740f' : '#15703C', lineHeight: 1 }}>
              {report.missed_days}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700,
              color: report.missed_days > 0 ? '#a07b3e' : '#4f7a62', marginTop: 6 }}>
              {report.missed_days === 1 ? 'Missed day' : 'Missed days'}
            </div>
          </div>
        </div>

        {/* week bars */}
        {report.history.length >= 7 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.5px',
              textTransform: 'uppercase', color: '#9aa09c', marginBottom: 14 }}>
              Last 7 days
            </div>
            <WeekBars history={report.history} />
          </>
        )}

        {/* missed dates alert */}
        {missed.length > 0 && (
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            background: '#FFF7E4', borderRadius: 14, padding: '14px 16px', marginTop: 20,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="11" fill="#F6A623"/>
              <rect x="11" y="6.5" width="2" height="8" rx="1" fill="#fff"/>
              <circle cx="12" cy="17" r="1.4" fill="#fff"/>
            </svg>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#8a6a16', lineHeight: 1.5 }}>
              {missed.length === 1
                ? <><strong>{fmtDateShort(missed[0])}</strong> — no check-in by 12:00 PM.</>
                : <>{missed.length} missed dates: {missed.map(d => fmtDateShort(d)).join(', ')}.</>
              }
            </div>
          </div>
        )}

        {missed.length === 0 && (
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1F9D55', marginTop: 16 }}>
            🎉 No missed check-ins this period!
          </div>
        )}
      </div>

      {/* footer */}
      <div style={{
        borderTop: '1px solid #f0f0ee', padding: '14px 28px',
        fontSize: 13, fontWeight: 600, color: '#aeb2ae',
        display: 'flex', justifyContent: 'space-between', marginTop: 20,
      }}>
        <span>Sent to {report.senior.person_in_charge_name || 'caregiver'} · person-in-charge</span>
        <span>{label.includes('7') ? 'Every Monday' : 'Every 1st of month'}</span>
      </div>
    </div>
  );
}

// ── Calendar grid ─────────────────────────────────────────────────────────────
function CalendarGrid({ history }: { history: CheckinHistory[] }) {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#9aa09c' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {sorted.map(day => (
          <div key={day.date} title={`${day.date} — ${day.checked_in_today ? `checked in ${fmtTime(day.last_checkin_time)}` : 'missed'}`}
            style={{
              aspectRatio: '1', borderRadius: 8, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800,
              background: day.checked_in_today ? '#1F9D55' : '#f0ede8',
              color: day.checked_in_today ? '#fff' : '#c4c8c3',
            }}>
            {new Date(day.date + 'T00:00:00').getDate()}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SeniorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [senior, setSenior] = useState<Senior | null>(null);
  const [history, setHistory] = useState<CheckinHistory[]>([]);
  const [weekly, setWeekly] = useState<Report | null>(null);
  const [monthly, setMonthly] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'calendar' | 'reports'>('calendar');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getSenior(id),
      api.getHistory(id, 30),
      api.getWeeklyReport(id),
      api.getMonthlyReport(id),
    ]).then(([s, h, w, m]) => { setSenior(s); setHistory(h); setWeekly(w); setMonthly(m); })
      .finally(() => setLoading(false));
  }, [id]);

  const checkedCount = history.filter(d => d.checked_in_today).length;
  const rate = history.length ? Math.round(checkedCount / history.length * 100) : 0;

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#e7e5df', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>☀️</div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#e7e5df', fontFamily: "'Nunito', sans-serif", color: '#1F2421' }}>
      {/* header */}
      <div style={{ background: 'linear-gradient(135deg, #1F9D55, #2E75B6)', padding: '52px 22px 24px' }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff',
          fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700,
          padding: '6px 14px', borderRadius: 999, cursor: 'pointer', marginBottom: 16,
        }}>← Dashboard</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 16, flexShrink: 0,
            background: 'rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 900, color: '#fff',
          }}>{senior?.name.charAt(0)}</div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{senior?.name}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>
              ID: {senior?.senior_id} · Check-in: {senior?.preferred_checkin_time}
            </div>
          </div>
        </div>

        {/* mini stats */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: '30-day rate', value: `${rate}%` },
            { label: 'Checked in', value: checkedCount },
            { label: 'Missed', value: history.length - checkedCount },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.18)',
              borderRadius: 14, padding: '12px 8px', textAlign: 'center', color: '#fff' }}>
              <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, opacity: 0.85 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #f0f0ee' }}>
        {(['calendar', 'reports'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '14px', border: 'none', cursor: 'pointer',
            fontFamily: "'Nunito', sans-serif", fontSize: 16, fontWeight: 800,
            background: 'transparent',
            color: tab === t ? '#1F9D55' : '#9aa09c',
            borderBottom: tab === t ? '2.5px solid #1F9D55' : '2.5px solid transparent',
          }}>
            {t === 'calendar' ? 'Calendar' : 'Reports'}
          </button>
        ))}
      </div>

      {/* content */}
      <div style={{ padding: '20px 18px' }}>
        {tab === 'calendar' && (
          <>
            <div style={{ background: '#fff', borderRadius: 22, padding: '20px 18px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Last 30 Days</div>
              <CalendarGrid history={history} />
              <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 12, fontWeight: 700, color: '#9aa09c' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#1F9D55', display: 'inline-block' }} /> Checked in
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#f0ede8', display: 'inline-block' }} /> Missed
                </span>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 22, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              {[...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((day, i, arr) => (
                <div key={day.date} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 20px',
                  borderBottom: i < arr.length - 1 ? '1px solid #f5f5f3' : 'none',
                }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#1F2421' }}>{fmtDateShort(day.date)}</span>
                  {day.checked_in_today ? (
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1F9D55' }}>✓ {fmtTime(day.last_checkin_time)}</span>
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#c4c8c3' }}>Not checked in</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'reports' && (
          <>
            {weekly && <ReportCard report={weekly} label="Weekly (7 days)" />}
            {monthly && <ReportCard report={monthly} label="Monthly (30 days)" />}

            <div style={{ background: '#fff', borderRadius: 22, padding: '18px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)', fontSize: 14, fontWeight: 600, color: '#8a857c', lineHeight: 1.55 }}>
              <div style={{ fontWeight: 800, color: '#1F2421', marginBottom: 6 }}>📧 Automated schedule</div>
              <div>Weekly reports emailed every <strong>Monday 9:00 AM</strong> → {senior?.person_in_charge_email || '—'}</div>
              <div style={{ marginTop: 6 }}>Monthly reports on the <strong>1st of each month</strong>.</div>
              <div style={{ marginTop: 6 }}>SMS alerts at <strong>12:00 PM</strong> if no check-in → {senior?.person_in_charge_phone || '—'}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
