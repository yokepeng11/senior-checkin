const db = require('./db');
const { randomUUID } = require('crypto');

console.log('🌱 Seeding database with demo data...\n');

db.exec('DELETE FROM alert_log; DELETE FROM daily_status; DELETE FROM checkins; DELETE FROM seniors;');

const seniors = [
  {
    senior_id: 'S001',
    name: 'John Tan',
    phone_number: '+6591234567',
    preferred_checkin_time: '09:00',
    person_in_charge_name: 'Sarah Tan',
    person_in_charge_phone: '+6598765432',
    person_in_charge_email: 'sarah.tan@example.com',
    nok_name: 'Michael Tan',
    next_of_kin_phone: '+6587654321',
    next_of_kin_email: 'michael.tan@example.com',
  },
  {
    senior_id: 'S002',
    name: 'Mary Lee',
    phone_number: '+6592345678',
    preferred_checkin_time: '10:00',
    person_in_charge_name: 'Sarah Tan',
    person_in_charge_phone: '+6598765432',
    person_in_charge_email: 'sarah.tan@example.com',
    nok_name: 'James Lee',
    next_of_kin_phone: '+6576543210',
    next_of_kin_email: 'james.lee@example.com',
  },
  {
    senior_id: 'S003',
    name: 'David Wong',
    phone_number: '+6593456789',
    preferred_checkin_time: '08:00',
    person_in_charge_name: 'Sarah Tan',
    person_in_charge_phone: '+6598765432',
    person_in_charge_email: 'sarah.tan@example.com',
    nok_name: 'Linda Wong',
    next_of_kin_phone: '+6565432109',
    next_of_kin_email: 'linda.wong@example.com',
  },
];

const insertSenior = db.prepare(`
  INSERT INTO seniors (senior_id, name, phone_number, preferred_checkin_time,
    person_in_charge_name, person_in_charge_phone, person_in_charge_email,
    nok_name, next_of_kin_phone, next_of_kin_email)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

seniors.forEach(s =>
  insertSenior.run(s.senior_id, s.name, s.phone_number, s.preferred_checkin_time,
    s.person_in_charge_name, s.person_in_charge_phone, s.person_in_charge_email,
    s.nok_name, s.next_of_kin_phone, s.next_of_kin_email)
);

const insertStatus = db.prepare(`
  INSERT INTO daily_status (status_id, senior_id, date, checked_in_today, last_checkin_time)
  VALUES (?, ?, ?, ?, ?)
`);
const insertCheckin = db.prepare(`
  INSERT INTO checkins (checkin_id, senior_id, checkin_timestamp, device_type, app_version)
  VALUES (?, ?, ?, 'web', '1.0.0')
`);

// Simulate realistic check-in patterns over past 30 days
// S001 John: reliable (90%), S002 Mary: concerning (65%), S003 David: good (85%)
const rates = { S001: 0.90, S002: 0.65, S003: 0.85 };
const today = new Date();

for (let i = 1; i <= 30; i++) {
  const d = new Date(today);
  d.setDate(d.getDate() - i);
  const dateStr = d.toISOString().split('T')[0];

  seniors.forEach(s => {
    const checkedIn = Math.random() < rates[s.senior_id];
    let ts = null;

    if (checkedIn) {
      const hour = parseInt(s.preferred_checkin_time) + (Math.random() < 0.3 ? 1 : 0);
      const min = Math.floor(Math.random() * 60);
      const cd = new Date(d);
      cd.setHours(hour, min, 0, 0);
      ts = cd.toISOString();
      insertCheckin.run(randomUUID(), s.senior_id, ts);
    }

    insertStatus.run(randomUUID(), s.senior_id, dateStr, checkedIn ? 1 : 0, ts);
  });
}

// Today: John ✅  Mary ❌  David ✅
const todayStr = today.toISOString().split('T')[0];

const johnTs = new Date(today);
johnTs.setHours(9, 15, 0, 0);
insertCheckin.run(randomUUID(), 'S001', johnTs.toISOString());
insertStatus.run(randomUUID(), 'S001', todayStr, 1, johnTs.toISOString());

const davidTs = new Date(today);
davidTs.setHours(8, 30, 0, 0);
insertCheckin.run(randomUUID(), 'S003', davidTs.toISOString());
insertStatus.run(randomUUID(), 'S003', todayStr, 1, davidTs.toISOString());

insertStatus.run(randomUUID(), 'S002', todayStr, 0, null);

console.log('✅ Seeded 3 seniors with 30 days of history:');
console.log('   S001: John Tan     — 90% check-in rate — ✅ checked in today');
console.log('   S002: Mary Lee     — 65% check-in rate — ❌ NOT checked in today');
console.log('   S003: David Wong   — 85% check-in rate — ✅ checked in today\n');
