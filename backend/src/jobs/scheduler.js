const cron = require('node-cron');
const db = require('../db');
const { randomUUID } = require('crypto');

function mockSendSMS(phone, message, seniorId = null) {
  // Replace this block with Twilio in production:
  // const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await client.messages.create({ body: message, from: process.env.TWILIO_FROM_NUMBER, to: phone });
  console.log(`\n📱 SMS → ${phone}`);
  console.log(`   ${message}`);

  db.prepare(
    'INSERT INTO alert_log (alert_id, senior_id, alert_date, alert_type, sent_at, recipient, content) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    randomUUID(),
    seniorId,
    new Date().toISOString().split('T')[0],
    'sms',
    new Date().toISOString(),
    phone,
    message
  );
}

function mockSendEmail(email, subject, body) {
  // Replace with nodemailer in production:
  // const transporter = nodemailer.createTransporter({ host: process.env.SMTP_HOST, ... });
  // await transporter.sendMail({ from: process.env.SMTP_FROM, to: email, subject, html: body });
  console.log(`\n📧 EMAIL → ${email}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   ${body.slice(0, 300)}...`);
}

function scheduleDailyReset() {
  // Midnight: ensure daily_status rows exist for all active seniors
  cron.schedule('0 0 * * *', () => {
    const today = new Date().toISOString().split('T')[0];
    const seniors = db.prepare('SELECT senior_id FROM seniors WHERE is_active = 1').all();

    console.log(`\n🔄 Midnight reset — initialising daily_status for ${today}`);
    seniors.forEach(s => {
      db.prepare(`
        INSERT INTO daily_status (status_id, senior_id, date, checked_in_today, last_checkin_time)
        VALUES (?, ?, ?, 0, NULL)
        ON CONFLICT(senior_id, date) DO NOTHING
      `).run(randomUUID(), s.senior_id, today);
    });
  });
}

function scheduleSMSAlerts() {
  // 12:00 PM: alert NOK/PIC for seniors who have not checked in
  cron.schedule('0 12 * * *', () => {
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n⏰ 12pm alert check for ${today}`);

    const missed = db.prepare(`
      SELECT s.* FROM seniors s
      LEFT JOIN daily_status ds ON s.senior_id = ds.senior_id AND ds.date = ?
      WHERE s.is_active = 1 AND (ds.checked_in_today IS NULL OR ds.checked_in_today = 0)
    `).all(today);

    if (missed.length === 0) {
      console.log('✅ All seniors have checked in today — no alerts needed.');
      return;
    }

    console.log(`⚠️  ${missed.length} senior(s) have not checked in: ${missed.map(s => s.name).join(', ')}`);

    // Group by contact phone to avoid duplicate SMS to same recipient
    const byPhone = {};
    missed.forEach(senior => {
      const phone = senior.person_in_charge_phone || senior.next_of_kin_phone;
      if (!phone) return;
      if (!byPhone[phone]) byPhone[phone] = [];
      byPhone[phone].push(senior);
    });

    Object.entries(byPhone).forEach(([phone, group]) => {
      const names = group.map(s => `${s.name} (ID: ${s.senior_id})`).join(', ');
      const msg = `Alert: The following seniors have not checked in by 12pm today: ${names}. Please contact them to ensure their well-being. Centre contact: ${process.env.CENTRE_PHONE || '+6565123456'}`;
      mockSendSMS(phone, msg, group[0].senior_id);
    });
  });
}

function scheduleWeeklyReport() {
  // Every Monday at 9:00 AM
  cron.schedule('0 9 * * 1', () => {
    console.log('\n📊 Generating weekly check-in reports...');
    const seniors = db.prepare('SELECT * FROM seniors WHERE is_active = 1').all();

    seniors.forEach(senior => {
      const email = senior.person_in_charge_email || senior.next_of_kin_email;
      if (!email) return;

      const history = db.prepare(`
        SELECT date, checked_in_today FROM daily_status
        WHERE senior_id = ? ORDER BY date DESC LIMIT 7
      `).all(senior.senior_id);

      const checkedIn = history.filter(d => d.checked_in_today).length;
      const rate = history.length ? Math.round((checkedIn / history.length) * 100) : 0;
      const missed = history.filter(d => !d.checked_in_today).map(d => d.date);

      const picName = senior.person_in_charge_name || 'Caregiver';
      const dateRange = history.length
        ? `${history[history.length - 1].date} to ${history[0].date}`
        : 'this week';

      const body = `Dear ${picName},\n\nHere is the weekly check-in report for ${senior.name} (${dateRange}).\n\nCheck-in rate: ${checkedIn}/${history.length} days (${rate}%)\n${missed.length ? `Missed dates: ${missed.join(', ')}` : 'No missed check-ins!'}\n\nStatus: ${rate >= 80 ? '✅ Good engagement' : rate >= 60 ? '⚠️ Declining — please follow up' : '🚨 Critical — requires immediate attention'}\n\nFei Yue Community Services, Eldercare Services Division`;

      mockSendEmail(email, `Weekly Check-In Report – ${senior.name} (${dateRange})`, body);
    });
  });
}

function scheduleMonthlyReport() {
  // First of every month at 9:00 AM
  cron.schedule('0 9 1 * *', () => {
    console.log('\n📊 Generating monthly check-in reports...');
    const seniors = db.prepare('SELECT * FROM seniors WHERE is_active = 1').all();
    const monthLabel = new Date().toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });

    seniors.forEach(senior => {
      const email = senior.person_in_charge_email || senior.next_of_kin_email;
      if (!email) return;

      const history = db.prepare(`
        SELECT date, checked_in_today FROM daily_status
        WHERE senior_id = ? ORDER BY date DESC LIMIT 30
      `).all(senior.senior_id);

      const checkedIn = history.filter(d => d.checked_in_today).length;
      const rate = history.length ? Math.round((checkedIn / history.length) * 100) : 0;
      const missed = history.filter(d => !d.checked_in_today).map(d => d.date);

      const picName = senior.person_in_charge_name || 'Caregiver';

      const body = `Dear ${picName},\n\nHere is the monthly check-in report for ${senior.name} (${monthLabel}).\n\nCheck-in rate: ${checkedIn}/${history.length} days (${rate}%)\n${missed.length ? `Missed dates: ${missed.join(', ')}` : 'No missed check-ins!'}\n\nTrend: ${rate >= 80 ? '✅ Stable — good engagement' : rate >= 60 ? '⚠️ Declining — consider a welfare visit' : '🚨 Critical — immediate follow-up required'}\n\nFei Yue Community Services, Eldercare Services Division`;

      mockSendEmail(email, `Monthly Check-In Report – ${senior.name} – ${monthLabel}`, body);
    });
  });
}

module.exports = { scheduleDailyReset, scheduleSMSAlerts, scheduleWeeklyReport, scheduleMonthlyReport };
