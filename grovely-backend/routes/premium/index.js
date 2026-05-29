const express = require('express');
const router  = express.Router();
const { sendTestEmail } = require('../../notifications');
const backupsRouter = require('./backups');
const { requireOwner } = require('../../middleware/auth');
const { logPeriodEvent } = require('../../logger');
const { recomputeAllPredictions } = require('../period/_calcHelpers');

// Scheduled backup management (status, history, run-now, verify)
router.use('/backups', backupsRouter);

// GET /api/premium/pantry/catalog/search?q=
// Queries pantry_purchase_history grouped by (name, amount, unit, pieces, store)
// so the same item name with different sizes or stores appears as separate rows.
// Returns the most recent price for each combination.
// Empty q returns top 30 most recently purchased combinations.
router.get('/pantry/catalog/search', (req, res) => {
  const db = req.db;
  const q = (req.query.q ?? '').trim();

  if (!q) {
    const rows = db.prepare(`
      SELECT
        name, amount, unit, density, density_unit, pieces, price, store,
        MAX(added_at) AS last_added_at
      FROM pantry_purchase_history
      GROUP BY name, amount, unit, pieces, store
      ORDER BY last_added_at DESC
      LIMIT 30
    `).all();
    return res.json(rows);
  }

  const rows = db.prepare(`
    SELECT
      name, amount, unit, density, density_unit, pieces, price, store,
      MAX(added_at) AS last_added_at
    FROM pantry_purchase_history
    WHERE name LIKE ? ESCAPE '\\'
    GROUP BY name, amount, unit, pieces, store
    ORDER BY
      CASE WHEN name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
      last_added_at DESC
    LIMIT 30
  `).all(`%${q}%`, `${q}%`);

  res.json(rows);
});

// All premium routes register here.
// requireLicense is applied once to the entire /api/premium prefix in index.js —
// nothing in this file needs to re-check the license.

// Verification endpoint
router.get('/ping', (req, res) => {
  res.json({ premium: true });
});

// POST /api/premium/test-email
// Sends a test email to ACCOUNT1_EMAIL (and ACCOUNT2_EMAIL if set).
router.post('/test-email', async (req, res) => {
  try {
    await sendTestEmail(req.db);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Notification type settings ────────────────────────────────────────────────

// GET  /api/premium/notification-types
// Returns all per-type enabled flags and custom messages.
router.get('/notification-types', (req, res) => {
  const db = req.db;
  try {
    const rows = db.prepare('SELECT type_id, enabled, custom_message FROM notification_type_settings').all();
    const result = {};
    rows.forEach(r => {
      result[r.type_id] = { enabled: r.enabled !== 0, custom_message: r.custom_message || null };
    });
    res.json(result);
  } catch {
    res.json({});
  }
});

// PATCH /api/premium/notification-types/reset-all
// Re-enables all types (called by "Enable all" in the UI).
router.patch('/notification-types/reset-all', (req, res) => {
  const db = req.db;
  db.prepare('UPDATE notification_type_settings SET enabled = 1').run();
  res.json({ ok: true });
});

// PATCH /api/premium/notification-types/:typeId
// Upserts enabled and/or custom_message for a single type.
router.patch('/notification-types/:typeId', (req, res) => {
  const db     = req.db;
  const typeId = req.params.typeId;
  const { enabled, custom_message } = req.body;

  db.prepare('INSERT OR IGNORE INTO notification_type_settings (type_id) VALUES (?)').run(typeId);

  if (enabled !== undefined) {
    db.prepare('UPDATE notification_type_settings SET enabled = ? WHERE type_id = ?').run(enabled ? 1 : 0, typeId);
  }
  if ('custom_message' in req.body) {
    db.prepare('UPDATE notification_type_settings SET custom_message = ? WHERE type_id = ?').run(custom_message || null, typeId);
  }

  res.json({ ok: true });
});

// PATCH /api/premium/period/cycles/:id/adjust
// Adjust Cycle hold-drag gesture — resizes a cycle's start or end date.
// The free /period/cycles/:id/adjust endpoint handles edge-day deletion only.
router.patch('/period/cycles/:id/adjust', requireOwner, (req, res) => {
  const db = req.db;
  const { start_date, end_date } = req.body;
  const id = Number(req.params.id);
  const cycle = db.prepare('SELECT * FROM cycles WHERE id = ?').get(id);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
  const newStart = start_date ?? cycle.start_date;
  const newEnd   = end_date   ?? cycle.end_date;
  if (newEnd && newStart > newEnd)
    return res.status(400).json({ error: 'start_date must be before end_date' });
  db.prepare('UPDATE cycles SET start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newStart, newEnd, id);
  logPeriodEvent(db, { entity: 'cycle', entity_id: id, action: 'update', cycle_id: id, date: newStart });
  res.json({ id, start_date: newStart, end_date: newEnd });
  setImmediate(() => recomputeAllPredictions(db));
});

module.exports = router;
