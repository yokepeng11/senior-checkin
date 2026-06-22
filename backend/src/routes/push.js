const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/push/subscribe
// Body: { senior_id, subscription: { endpoint, keys: { p256dh, auth } } }
router.post('/subscribe', (req, res) => {
  const { senior_id, subscription } = req.body;
  if (!senior_id || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // Upsert — same endpoint can change senior or re-register
  db.prepare(`
    INSERT INTO push_subscriptions (senior_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      senior_id = excluded.senior_id,
      p256dh    = excluded.p256dh,
      auth      = excluded.auth,
      created_at = datetime('now')
  `).run(senior_id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);

  res.json({ ok: true });
});

module.exports = router;
