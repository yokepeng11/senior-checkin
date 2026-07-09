const express = require('express');
const router = express.Router();
const db = require('../db');
const { randomUUID } = require('crypto');

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

module.exports = router;
