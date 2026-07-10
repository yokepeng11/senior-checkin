const express = require('express');
const router = express.Router();
const db = require('../db');
const { randomUUID } = require('crypto');
const { normalisePhone } = require('../phoneUtils');

// ── GET /api/debug/status ─────────────────────────────────────────────────────
// Returns configuration state and DB counts so we can diagnose issues
router.get('/status', (req, res) => {
  const seniors = db.prepare('SELECT senior_id, name, person_in_charge_phone, preferred_checkin_time FROM seniors WHERE is_active = 1').all();
  const seniorSubs = db.prepare('SELECT senior_id, endpoint FROM push_subscriptions').all();
  const caregiverSubs = db.prepare('SELECT endpoint, created_at FROM caregiver_push_subscriptions').all();
  const today = new Date(Date.now() + 8 * 3600000).toISOString().split('T')[0];
  const todayStatus = db.prepare('SELECT senior_id, checked_in_today FROM daily_status WHERE date = ?').all(today);
  const recentAlerts = db.prepare('SELECT alert_type, sent_at, recipient, content FROM alert_log ORDER BY sent_at DESC LIMIT 10').all();

  res.json({
    config: {
      vapid_configured: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      twilio_configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM),
      twilio_from: process.env.TWILIO_WHATSAPP_FROM || null,
      frontend_url: process.env.FRONTEND_URL || null,
    },
    seniors: seniors.map(s => ({
      ...s,
      checked_in_today: todayStatus.find(t => t.senior_id === s.senior_id)?.checked_in_today ?? 'no row',
      has_push_sub: seniorSubs.some(sub => sub.senior_id === s.senior_id),
    })),
    caregiver_push_subs: caregiverSubs.length,
    senior_push_subs: seniorSubs.length,
    today_sgt: today,
    recent_alerts: recentAlerts,
  });
});

// ── POST /api/debug/test-push ─────────────────────────────────────────────────
// Immediately sends a test push to ALL registered devices (senior + caregiver)
router.post('/test-push', async (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(400).json({ error: 'VAPID keys not configured on Render' });
  }

  const webpush = require('web-push');
  webpush.setVapidDetails(
    'mailto:admin@feiyue.org.sg',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const results = [];

  // Senior subs
  const seniorSubs = db.prepare('SELECT ps.*, s.name FROM push_subscriptions ps JOIN seniors s ON ps.senior_id = s.senior_id').all();
  for (const sub of seniorSubs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: '☀️ Test Notification', body: `Hello ${sub.name.split(' ')[0]}! Notifications are working.` })
      );
      results.push({ type: 'senior', name: sub.name, status: 'sent' });
    } catch (err) {
      results.push({ type: 'senior', name: sub.name, status: 'failed', error: err.message });
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
      }
    }
  }

  // Caregiver subs
  const caregiverSubs = db.prepare('SELECT * FROM caregiver_push_subscriptions').all();
  for (const sub of caregiverSubs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: '🔔 Test Alert', body: 'Caregiver notifications are working!', url: '/nok' })
      );
      results.push({ type: 'caregiver', status: 'sent' });
    } catch (err) {
      results.push({ type: 'caregiver', status: 'failed', error: err.message });
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.prepare('DELETE FROM caregiver_push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
      }
    }
  }

  res.json({ results, total: results.length });
});

// ── POST /api/debug/test-whatsapp ─────────────────────────────────────────────
// Body: { phone: "+6591234567" }  — sends a test WhatsApp to that number
router.post('/test-whatsapp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Provide { phone: "+6591234567" }' });

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_WHATSAPP_FROM) {
    return res.status(400).json({ error: 'Twilio env vars not configured on Render' });
  }

  // Normalise
  let to = phone.replace(/[\s\-().]/g, '');
  if (!to.startsWith('+')) to = '+65' + to;

  try {
    const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const msg = await twilio.messages.create({
      body: `✅ Test message from Fei Yue Senior Check-In system. WhatsApp alerts are working!`,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      to: `whatsapp:${to}`,
    });
    res.json({ ok: true, sid: msg.sid, to });
  } catch (err) {
    res.status(500).json({ error: err.message, code: err.code });
  }
});

// ── POST /api/debug/run-alerts ────────────────────────────────────────────────
// Manually triggers the 12pm alert check right now.
// Called by an external cron service (e.g. cron-job.org) at 12pm SGT.
router.post('/run-alerts', async (req, res) => {
  const today = new Date(Date.now() + 8 * 3600000).toISOString().split('T')[0];
  console.log(`\n⏰ Manual alert trigger for ${today}`);

  const missed = db.prepare(`
    SELECT s.* FROM seniors s
    LEFT JOIN daily_status ds ON s.senior_id = ds.senior_id AND ds.date = ?
    WHERE s.is_active = 1 AND (ds.checked_in_today IS NULL OR ds.checked_in_today = 0)
  `).all(today);

  if (missed.length === 0) {
    return res.json({ ok: true, message: 'All seniors checked in — no alerts needed.', missed: 0 });
  }

  const results = { whatsapp: [], push: [] };

  // WhatsApp alerts
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) {
    const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const byPhone = {};
    missed.forEach(s => {
      const phone = s.person_in_charge_phone || s.next_of_kin_phone;
      if (!phone) return;
      if (!byPhone[phone]) byPhone[phone] = [];
      byPhone[phone].push(s);
    });
    for (const [phone, group] of Object.entries(byPhone)) {
      let to = phone.replace(/[\s\-().]/g, '');
      if (!to.startsWith('+')) to = '+65' + to;
      const names = group.map(s => s.name).join(', ');
      const picName = group[0].person_in_charge_name || 'Caregiver';
      const msg =
        `Hi ${picName}, this is an automated reminder from Fei Yue Community Services.\n\n` +
        `The following senior(s) under your care have *not checked in* by 12pm today:\n` +
        `👤 ${names}\n\n` +
        `Please check on them to ensure their well-being.\n` +
        `Centre contact: ${process.env.CENTRE_PHONE || '+65 6511 5100'}`;
      try {
        await twilio.messages.create({
          body: msg,
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
          to: `whatsapp:${to}`,
        });
        results.whatsapp.push({ to, status: 'sent' });
        db.prepare(
          'INSERT INTO alert_log (alert_id, senior_id, alert_date, alert_type, sent_at, recipient, content) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(randomUUID(), group[0].senior_id, today, 'whatsapp', new Date().toISOString(), to, msg);
      } catch (err) {
        results.whatsapp.push({ to, status: 'failed', error: err.message });
      }
    }
  } else {
    results.whatsapp.push({ status: 'skipped', reason: 'Twilio not configured' });
  }

  // Push alerts to matched caregiver devices only
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    const webpush = require('web-push');
    webpush.setVapidDetails('mailto:admin@feiyue.org.sg', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

    // For each missed senior, find all linked caregivers and push to their devices
    // Group by caregiver phone so each caregiver gets ONE notification listing all their missed seniors
    const caregiverMissed = {};
    for (const senior of missed) {
      const links = db.prepare('SELECT caregiver_phone FROM caregiver_senior_links WHERE senior_id = ?').all(senior.senior_id);
      for (const link of links) {
        if (!caregiverMissed[link.caregiver_phone]) caregiverMissed[link.caregiver_phone] = [];
        caregiverMissed[link.caregiver_phone].push(senior);
      }
    }

    for (const [phone, group] of Object.entries(caregiverMissed)) {
      const subs = db.prepare('SELECT * FROM caregiver_push_subscriptions WHERE phone = ?').all(phone);
      if (subs.length === 0) continue;
      const names = group.map(s => s.name).join(', ');
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: `⚠️ ${group.length} senior${group.length > 1 ? 's have' : ' has'} not checked in`,
              body: `${names} — please follow up.`,
              url: '/nok',
            })
          );
          results.push({ phone, status: 'sent', seniors: names });
        } catch (err) {
          results.push({ phone, status: 'failed', error: err.message });
          if (err.statusCode === 404 || err.statusCode === 410) {
            db.prepare('DELETE FROM caregiver_push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
          }
        }
      }
    }
  } else {
    results.push.push({ status: 'skipped', reason: 'VAPID not configured' });
  }

  res.json({ ok: true, missed: missed.length, seniors: missed.map(s => s.name), results });
});

// ── POST /api/debug/send-push-reminders ──────────────────────────────────────
// Called by cron-job.org at each preferred check-in time (e.g. 9:00 AM SGT).
// Sends push reminders to seniors whose preferred time matches current SGT hour.
router.post('/send-push-reminders', async (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(400).json({ error: 'VAPID keys not configured' });
  }

  const webpush = require('web-push');
  webpush.setVapidDetails('mailto:admin@feiyue.org.sg', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  // Current SGT time
  const now = new Date();
  const sgtMs = now.getTime() + 8 * 3600000;
  const sgtDate = new Date(sgtMs);
  const sgtHour = String(sgtDate.getUTCHours()).padStart(2, '0');
  const today = sgtDate.toISOString().split('T')[0];

  console.log(`\n🔔 External push-reminder trigger — SGT ${sgtHour}:00 on ${today}`);

  // Find seniors whose preferred time matches this hour, not yet reminded, not yet checked in
  const seniors = db.prepare(`
    SELECT s.senior_id, s.name FROM seniors s
    LEFT JOIN daily_status ds ON s.senior_id = ds.senior_id AND ds.date = ?
    WHERE s.is_active = 1
      AND substr(s.preferred_checkin_time, 1, 2) = ?
      AND (ds.checked_in_today  IS NULL OR ds.checked_in_today  = 0)
      AND (ds.push_reminder_sent IS NULL OR ds.push_reminder_sent = 0)
  `).all(today, sgtHour);

  if (seniors.length === 0) {
    return res.json({ ok: true, message: `No seniors due for a reminder at ${sgtHour}:00 SGT (already sent or checked in).`, sent: 0 });
  }

  const results = [];
  for (const senior of seniors) {
    const subs = db.prepare('SELECT * FROM push_subscriptions WHERE senior_id = ?').all(senior.senior_id);
    let sent = false;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: `☀️ Good Morning, ${senior.name.split(' ')[0]}!`,
            body: "It's time to check in. Tap to open the app and press the button.",
            url: '/',
          })
        );
        results.push({ senior: senior.name, status: 'sent' });
        console.log(`  ✅ Push sent to ${senior.name}`);
        sent = true;
      } catch (err) {
        results.push({ senior: senior.name, status: 'failed', error: err.message });
        if (err.statusCode === 404 || err.statusCode === 410) {
          db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
        }
      }
    }
    if (sent) {
      db.prepare(`
        INSERT INTO daily_status (status_id, senior_id, date, push_reminder_sent)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(senior_id, date) DO UPDATE SET push_reminder_sent = 1
      `).run(randomUUID(), senior.senior_id, today);
    }
  }

  res.json({ ok: true, sgtHour, seniors: seniors.map(s => s.name), results });
});

module.exports = router;
