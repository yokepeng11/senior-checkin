const express = require('express');
const router = express.Router();
const db = require('../db');

function genInviteCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

// GET /api/seniors
router.get('/', (req, res) => {
  const seniors = db.prepare('SELECT * FROM seniors WHERE is_active = 1 ORDER BY name').all();
  res.json(seniors);
});

// GET /api/seniors/:id
router.get('/:id', (req, res) => {
  const senior = db.prepare('SELECT * FROM seniors WHERE senior_id = ?').get(req.params.id);
  if (!senior) return res.status(404).json({ error: 'Senior not found' });

  // Auto-generate invite code if missing (handles old records and first-time deploys)
  if (!senior.invite_code) {
    let code;
    do { code = genInviteCode(); }
    while (db.prepare('SELECT 1 FROM seniors WHERE invite_code = ?').get(code));
    db.prepare('UPDATE seniors SET invite_code = ? WHERE senior_id = ?').run(code, senior.senior_id);
    senior.invite_code = code;
  }

  res.json(senior);
});

// POST /api/seniors
router.post('/', (req, res) => {
  const {
    name, phone_number, preferred_checkin_time = '09:00',
    person_in_charge_name, person_in_charge_phone, person_in_charge_email,
    nok_name, next_of_kin_phone, next_of_kin_email,
  } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  const senior_id = `S${String(Date.now()).slice(-6)}`;
  let invite_code;
  do { invite_code = genInviteCode(); }
  while (db.prepare('SELECT 1 FROM seniors WHERE invite_code = ?').get(invite_code));

  db.prepare(`
    INSERT INTO seniors
      (senior_id, name, phone_number, preferred_checkin_time,
       person_in_charge_name, person_in_charge_phone, person_in_charge_email,
       nok_name, next_of_kin_phone, next_of_kin_email, invite_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(senior_id, name, phone_number, preferred_checkin_time,
    person_in_charge_name, person_in_charge_phone, person_in_charge_email,
    nok_name, next_of_kin_phone, next_of_kin_email, invite_code);

  res.status(201).json(db.prepare('SELECT * FROM seniors WHERE senior_id = ?').get(senior_id));
});

// PUT /api/seniors/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM seniors WHERE senior_id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Senior not found' });

  const {
    name, phone_number, preferred_checkin_time,
    person_in_charge_name, person_in_charge_phone, person_in_charge_email,
    nok_name, next_of_kin_phone, next_of_kin_email,
  } = req.body;

  db.prepare(`
    UPDATE seniors SET
      name = ?, phone_number = ?, preferred_checkin_time = ?,
      person_in_charge_name = ?, person_in_charge_phone = ?, person_in_charge_email = ?,
      nok_name = ?, next_of_kin_phone = ?, next_of_kin_email = ?
    WHERE senior_id = ?
  `).run(
    name ?? existing.name,
    phone_number ?? existing.phone_number,
    preferred_checkin_time ?? existing.preferred_checkin_time,
    person_in_charge_name ?? existing.person_in_charge_name,
    person_in_charge_phone ?? existing.person_in_charge_phone,
    person_in_charge_email ?? existing.person_in_charge_email,
    nok_name ?? existing.nok_name,
    next_of_kin_phone ?? existing.next_of_kin_phone,
    next_of_kin_email ?? existing.next_of_kin_email,
    req.params.id,
  );

  res.json(db.prepare('SELECT * FROM seniors WHERE senior_id = ?').get(req.params.id));
});

// DELETE /api/seniors/:id (soft delete)
router.delete('/:id', (req, res) => {
  db.prepare('UPDATE seniors SET is_active = 0 WHERE senior_id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
