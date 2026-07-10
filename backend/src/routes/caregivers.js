const express = require('express');
const router = express.Router();
const db = require('../db');
const { randomUUID } = require('crypto');
const { normalisePhone } = require('../phoneUtils');

// GET /api/caregivers/senior-by-code/:code
// Look up a senior by invite code — used by caregiver to preview before linking
router.get('/senior-by-code/:code', (req, res) => {
  const senior = db.prepare(
    'SELECT senior_id, name, invite_code FROM seniors WHERE invite_code = ? AND is_active = 1'
  ).get(req.params.code.toUpperCase().trim());
  if (!senior) return res.status(404).json({ error: 'Invalid code. Please check with your senior.' });
  res.json({ senior_id: senior.senior_id, name: senior.name });
});

// POST /api/caregivers/link
// Body: { caregiver_phone: "82687111", invite_code: "AH7K2M" }
// Links a caregiver (by phone) to a senior (by invite code)
router.post('/link', (req, res) => {
  const { caregiver_phone, invite_code } = req.body;
  if (!caregiver_phone || !invite_code)
    return res.status(400).json({ error: 'caregiver_phone and invite_code are required' });

  const senior = db.prepare(
    'SELECT senior_id, name FROM seniors WHERE invite_code = ? AND is_active = 1'
  ).get(invite_code.toUpperCase().trim());
  if (!senior) return res.status(404).json({ error: 'Invalid invite code' });

  const normPhone = normalisePhone(caregiver_phone);
  db.prepare(`
    INSERT INTO caregiver_senior_links (link_id, senior_id, caregiver_phone)
    VALUES (?, ?, ?)
    ON CONFLICT(senior_id, caregiver_phone) DO NOTHING
  `).run(randomUUID(), senior.senior_id, normPhone);

  res.json({ ok: true, senior_id: senior.senior_id, senior_name: senior.name });
});

// DELETE /api/caregivers/link
// Body: { caregiver_phone: "82687111", senior_id: "S123456" }
// Unlinks a caregiver from a senior
router.delete('/link', (req, res) => {
  const { caregiver_phone, senior_id } = req.body;
  if (!caregiver_phone || !senior_id)
    return res.status(400).json({ error: 'caregiver_phone and senior_id are required' });
  const normPhone = normalisePhone(caregiver_phone);
  db.prepare('DELETE FROM caregiver_senior_links WHERE senior_id = ? AND caregiver_phone = ?')
    .run(senior_id, normPhone);
  res.json({ ok: true });
});

module.exports = router;
