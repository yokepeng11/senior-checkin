const cron = require('node-cron');
const db = require('../db');
const { randomUUID } = require('crypto');
const webpush = require('web-push');

// Configure web-push with VAPID keys (set these as env vars on Render)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@feiyue.org.sg',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Normalise phone number to E.164 format for WhatsApp (e.g. "+6591234567")
function normalisePhone(raw) {
  if (!raw) return null;
  // Strip spaces, dashes, parentheses
  let digits = raw.replace(/[\s\-().]/g, '');
  // If it starts with +, keep as-is; otherwise assume Singapore (+65)
  if (!digits.startsWith('+')) digits = '+65' + digits;
  return digits;
}

async function sendWhatsApp(phone, message, seniorId = null) {
  const to = normalisePhone(phone);
  if (!to) return;

  // Log regardless so we can see it in Render logs
  console.log(`\n💬 WhatsApp → ${to}`);
  console.log(`   ${message}`);

  // Log to alert_log
  db.prepare(
    'INSERT INTO alert_log (alert_id, senior_id, alert_date, alert_type, sent_at, recipient, content) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    randomUUID(),
    seniorId,
    new Date().toISOString().split('T')[0],
    'whatsapp',
    new Date().toISOString(),
    to,
    message
  );

  // Send via Twilio WhatsApp if credentials are configured
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_WHATSAPP_FROM) {
    console.log('   ⚠️  Twilio not configured — message logged only.');
    return;
  }

  try {
    const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await twilio.messages.create({
      body: message,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      to: `whatsapp:${to}`,
    });
    console.log('   ✅ WhatsApp sent.');
  } catch (err) {
    console.error('   ❌ WhatsApp send failed:', err.message);
  }
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
  // Disabled — alerts are now triggered externally via cron-job.org
  // hitting POST /api/debug/run-alerts to avoid duplicates on Render free tier
  return;
  cron.schedule('0 4 * * *', async () => {   // 04:00 UTC = 12:00 SGT
    const today = new Date(Date.now() + 8 * 3600000).toISOString().split('T')[0];
    console.log(`\n⏰ 12pm SGT alert check for ${today}`);

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

    // Group by caregiver phone to avoid duplicate messages to the same person
    const byPhone = {};
    missed.forEach(senior => {
      const phone = senior.person_in_charge_phone || senior.next_of_kin_phone;
      if (!phone) return;
      if (!byPhone[phone]) byPhone[phone] = [];
      byPhone[phone].push(senior);
    });

    for (const [phone, group] of Object.entries(byPhone)) {
      const names = group.map(s => s.name).join(', ');
      const picName = group[0].person_in_charge_name || 'Caregiver';
      const msg =
        `Hi ${picName}, this is an automated reminder from Fei Yue Community Services.\n\n` +
        `The following senior(s) under your care have *not checked in* by 12pm today:\n` +
        `👤 ${names}\n\n` +
        `Please check on them to ensure their well-being.\n` +
        `Centre contact: ${process.env.CENTRE_PHONE || '+65 6511 5100'}`;
      await sendWhatsApp(phone, msg, group[0].senior_id);
    }

    // Push to matched caregiver devices only (by phone number)
    const byPhone = {};
    missed.forEach(s => {
      let phone = (s.person_in_charge_phone || s.next_of_kin_phone || '').replace(/[\s\-().]/g, '');
      if (!phone) return;
      if (!phone.startsWith('+')) phone = '+65' + phone;
      if (!byPhone[phone]) byPhone[phone] = [];
      byPhone[phone].push(s);
    });

    for (const [phone, group] of Object.entries(byPhone)) {
      const subs = db.prepare('SELECT * FROM caregiver_push_subscriptions WHERE phone = ?').all(phone);
      if (subs.length === 0) continue;
      const names = group.map(s => s.name).join(', ');
      console.log(`\n🔔 Pushing to caregiver ${phone} — ${names}`);
      for (const sub of subs) {
        await sendPush(sub, {
          title: `⚠️ ${group.length} senior${group.length > 1 ? 's have' : ' has'} not checked in`,
          body: `${names} — please follow up.`,
          url: '/nok',
        }, true);
      }
    }
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

// Send push notification to a single subscription, remove it if stale
async function sendPush(sub, payload, isCaregiver = false) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
  } catch (err) {
    // 404/410 = subscription expired — remove it
    if (err.statusCode === 404 || err.statusCode === 410) {
      const table = isCaregiver ? 'caregiver_push_subscriptions' : 'push_subscriptions';
      db.prepare(`DELETE FROM ${table} WHERE endpoint = ?`).run(sub.endpoint);
    } else {
      console.error('Push send error:', err.message);
    }
  }
}

function schedulePushReminders() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.log('⚠️  VAPID keys not set — push reminders disabled.');
    return;
  }

  // Run every minute. Send reminder any time within the 60-minute window
  // AFTER the senior's preferred time, as long as not already sent today.
  // This means a Render restart or brief sleep won't cause a missed notification.
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const sgtMs = now.getTime() + 8 * 3_600_000;
    const sgtDate = new Date(sgtMs);
    const sgtHour = String(sgtDate.getUTCHours()).padStart(2, '0');
    const sgtMin  = sgtDate.getUTCMinutes();
    const today   = sgtDate.toISOString().split('T')[0];

    // Only act during the first 59 minutes of each hour
    if (sgtMin >= 59) return;

    // Find seniors whose preferred hour matches and haven't been reminded or checked in today
    const seniors = db.prepare(`
      SELECT s.senior_id, s.name FROM seniors s
      LEFT JOIN daily_status ds ON s.senior_id = ds.senior_id AND ds.date = ?
      WHERE s.is_active = 1
        AND substr(s.preferred_checkin_time, 1, 2) = ?
        AND (ds.checked_in_today  IS NULL OR ds.checked_in_today  = 0)
        AND (ds.push_reminder_sent IS NULL OR ds.push_reminder_sent = 0)
    `).all(today, sgtHour);

    if (seniors.length === 0) return;

    console.log(`\n🔔 Push reminders — SGT ${sgtHour}:${String(sgtMin).padStart(2,'0')} — ${seniors.map(s => s.name).join(', ')}`);

    for (const senior of seniors) {
      const subs = db.prepare('SELECT * FROM push_subscriptions WHERE senior_id = ?').all(senior.senior_id);

      let sent = false;
      for (const sub of subs) {
        await sendPush(sub, {
          title: `☀️ Good Morning, ${senior.name.split(' ')[0]}!`,
          body: "It's time to check in. Tap to open the app and press the button.",
          url: '/',
        });
        sent = true;
      }

      // Mark reminder as sent so we don't repeat it this hour
      if (sent) {
        db.prepare(`
          INSERT INTO daily_status (status_id, senior_id, date, push_reminder_sent)
          VALUES (?, ?, ?, 1)
          ON CONFLICT(senior_id, date) DO UPDATE SET push_reminder_sent = 1
        `).run(randomUUID(), senior.senior_id, today);
      }
    }
  });
}

module.exports = { scheduleDailyReset, scheduleSMSAlerts, scheduleWeeklyReport, scheduleMonthlyReport, schedulePushReminders };
