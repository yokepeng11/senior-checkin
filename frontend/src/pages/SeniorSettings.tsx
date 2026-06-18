import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Save } from 'lucide-react';
import { api } from '../api';
import type { Senior } from '../types';

const HOURS = Array.from({ length: 5 }, (_, i) => {
  const h = 8 + i;
  return { value: `${String(h).padStart(2, '0')}:00`, label: `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}` };
});

export default function SeniorSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [senior, setSenior] = useState<Senior | null>(null);
  const [form, setForm] = useState({
    preferred_checkin_time: '09:00',
    phone_number: '',
    person_in_charge_name: '',
    person_in_charge_phone: '',
    person_in_charge_email: '',
    nok_name: '',
    next_of_kin_phone: '',
    next_of_kin_email: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getSenior(id).then(s => {
      setSenior(s);
      setForm({
        preferred_checkin_time: s.preferred_checkin_time || '09:00',
        phone_number: s.phone_number || '',
        person_in_charge_name: s.person_in_charge_name || '',
        person_in_charge_phone: s.person_in_charge_phone || '',
        person_in_charge_email: s.person_in_charge_email || '',
        nok_name: s.nok_name || '',
        next_of_kin_phone: s.next_of_kin_phone || '',
        next_of_kin_email: s.next_of_kin_email || '',
      });
    });
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.updateSenior(id, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert('Could not save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, type = 'text', hint?: string) => (
    <div className="mb-5">
      <label className="block text-gray-600 font-semibold text-base mb-2">{label}</label>
      {hint && <p className="text-gray-400 text-sm mb-2">{hint}</p>}
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg focus:border-green-400 focus:outline-none transition-colors"
        style={{ fontSize: '18px' }}
      />
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex-none bg-white border-b border-gray-100 px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 text-gray-500 active:scale-90 transition-transform">
          <ChevronLeft size={28} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Settings</h1>
          <p className="text-gray-400 text-sm">{senior?.name}</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 py-5">

        {/* Check-in time */}
        <div className="senior-card mb-5">
          <h2 className="text-lg font-bold text-gray-700 mb-4">⏰ Reminder Time</h2>
          <label className="block text-gray-600 font-semibold text-base mb-3">
            Preferred check-in time
          </label>
          <p className="text-gray-400 text-sm mb-3">
            You will receive a reminder at this time each day. Maximum: 12:00 PM.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {HOURS.map(h => (
              <button
                key={h.value}
                onClick={() => setForm(f => ({ ...f, preferred_checkin_time: h.value }))}
                className={`py-3 rounded-xl text-base font-semibold transition-colors ${
                  form.preferred_checkin_time === h.value
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>

        {/* Phone */}
        <div className="senior-card mb-5">
          <h2 className="text-lg font-bold text-gray-700 mb-4">📱 My Phone Number</h2>
          {field('Phone number', 'phone_number', 'tel', 'Format: +65 1234 5678')}
        </div>

        {/* Person in charge */}
        <div className="senior-card mb-5">
          <h2 className="text-lg font-bold text-gray-700 mb-4">👤 Person-in-Charge</h2>
          <p className="text-gray-400 text-sm mb-4">
            This person will receive SMS alerts if you do not check in by 12 PM, and weekly/monthly reports by email.
          </p>
          {field('Name', 'person_in_charge_name')}
          {field('Phone (for SMS alerts)', 'person_in_charge_phone', 'tel')}
          {field('Email (for reports)', 'person_in_charge_email', 'email')}
        </div>

        {/* NOK */}
        <div className="senior-card mb-8">
          <h2 className="text-lg font-bold text-gray-700 mb-4">🏠 Next of Kin (Backup)</h2>
          <p className="text-gray-400 text-sm mb-4">
            Used as backup if the person-in-charge is unavailable.
          </p>
          {field('Name', 'nok_name')}
          {field('Phone', 'next_of_kin_phone', 'tel')}
          {field('Email', 'next_of_kin_email', 'email')}
        </div>
      </div>

      {/* Save button */}
      <div className="flex-none bg-white border-t border-gray-100 px-5 py-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-3 bg-green-500 text-white font-bold rounded-2xl py-4 text-xl active:scale-95 transition-all disabled:opacity-60"
        >
          <Save size={22} />
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
