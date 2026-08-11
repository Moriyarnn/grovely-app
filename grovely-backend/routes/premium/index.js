const express = require('express');
const router  = express.Router();
const { sendTestEmail } = require('../../notifications');
const backupsRouter = require('./backups');
const { requireOwner } = require('../../middleware/auth');
const { logPeriodEvent } = require('../../logger');
const { recomputeAllPredictions } = require('../period/_calcHelpers');
const { MIN_CYCLE_GAP } = require('../period/_shortCyclePairs');
const { emitActivity } = require('../../realtime');

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

  const latestStorePrices = `
    WITH latest_per_store AS (
      SELECT p.*,
        ROW_NUMBER() OVER (
          PARTITION BY lower(p.name), p.amount, p.unit, p.pieces, lower(COALESCE(p.store, ''))
          ORDER BY p.added_at DESC, p.id DESC
        ) AS store_rank
      FROM pantry_purchase_history p
    ), latest_variants AS (
      SELECT p.*,
        MIN(CASE WHEN trim(COALESCE(p.store, '')) <> '' THEN p.price END) OVER (
          PARTITION BY lower(p.name), p.amount, p.unit, p.pieces
        ) AS lowest_recent_price,
        FIRST_VALUE(p.store) OVER (
          PARTITION BY lower(p.name), p.amount, p.unit, p.pieces
          ORDER BY CASE WHEN trim(COALESCE(p.store, '')) <> '' AND p.price IS NOT NULL THEN 0 ELSE 1 END,
                   p.price ASC, p.added_at DESC, p.id DESC
        ) AS lowest_recent_store,
        COUNT(CASE WHEN trim(COALESCE(p.store, '')) <> '' AND p.price IS NOT NULL THEN 1 END) OVER (
          PARTITION BY lower(p.name), p.amount, p.unit, p.pieces
        ) AS recent_store_count
      FROM latest_per_store p
      WHERE p.store_rank = 1
    )
  `;

  if (!q) {
    const rows = db.prepare(`
      ${latestStorePrices}
      SELECT p.name, p.amount, p.unit, p.density, p.density_unit, p.pieces, p.price, p.store,
        c.category, p.added_at AS last_added_at,
        p.lowest_recent_price, p.lowest_recent_store, p.recent_store_count
      FROM latest_variants p
      LEFT JOIN pantry_item_catalog c ON c.name = p.name COLLATE NOCASE
      ORDER BY p.added_at DESC
      LIMIT 30
    `).all();
    return res.json(rows);
  }

  const rows = db.prepare(`
    ${latestStorePrices}
    SELECT p.name, p.amount, p.unit, p.density, p.density_unit, p.pieces, p.price, p.store,
      c.category, p.added_at AS last_added_at,
      p.lowest_recent_price, p.lowest_recent_store, p.recent_store_count
    FROM latest_variants p
      LEFT JOIN pantry_item_catalog c ON c.name = p.name COLLATE NOCASE
      WHERE p.name LIKE ? ESCAPE '\\'
    ORDER BY
        CASE WHEN p.name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
      p.added_at DESC
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
  const today = new Date().toISOString().split('T')[0];
  const futureDate = newStart > today ? newStart : (newEnd && newEnd > today ? newEnd : null);
  if (futureDate)
    return res.status(400).json({ error: "Can't log future dates", code: 'FUTURE_CYCLE_DATE', date: futureDate });

  const currentEnd = cycle.end_date ?? cycle.start_date;
  let existingDay = null;
  if (newStart < cycle.start_date) {
    existingDay = db.prepare(`
      SELECT date FROM cycle_days
      WHERE cycle_id <> ? AND date >= ? AND date < ?
      ORDER BY date ASC LIMIT 1
    `).get(id, newStart, cycle.start_date);
  }
  if (!existingDay && newEnd && newEnd > currentEnd) {
    existingDay = db.prepare(`
      SELECT date FROM cycle_days
      WHERE cycle_id <> ? AND date > ? AND date <= ?
      ORDER BY date ASC LIMIT 1
    `).get(id, currentEnd, newEnd);
  }
  if (existingDay)
    return res.status(409).json({ error: 'This day is already logged', code: 'CYCLE_DAY_EXISTS', date: existingDay.date });

  const overlappingCycle = db.prepare(`
    SELECT c.id
    FROM cycles c
    WHERE c.id <> ?
      AND c.start_date <= ?
      AND COALESCE(
        c.end_date,
        (SELECT MAX(cd.date) FROM cycle_days cd WHERE cd.cycle_id = c.id),
        c.start_date
      ) >= ?
    LIMIT 1
  `).get(id, newEnd ?? newStart, newStart);
  if (overlappingCycle)
    return res.status(409).json({ error: 'Adjusted period overlaps an existing period' });
  const datesChanged = newStart !== cycle.start_date || newEnd !== cycle.end_date;
  const reviewState = datesChanged && cycle.review_state === 'confirmed' ? null : cycle.review_state;
  let confirmedFollowingCycleId = null;
  // Short-pair confirmation is stored on the later cycle. Moving an earlier
  // start changes the pair being reviewed, so reopen that confirmation.
  if (newStart !== cycle.start_date && reviewState !== 'excluded') {
    const followingCycle = db.prepare(`
      SELECT id, start_date, review_state
      FROM cycles
      WHERE id <> ?
        AND review_state IS NOT 'excluded'
        AND start_date > ?
      ORDER BY start_date ASC
      LIMIT 1
    `).get(id, newStart);
    if (followingCycle?.review_state === 'confirmed') {
      const gap = Math.round(
        (new Date(`${followingCycle.start_date}T00:00:00`).getTime() - new Date(`${newStart}T00:00:00`).getTime()) / 86400000
      );
      if (gap > 0 && gap < MIN_CYCLE_GAP) confirmedFollowingCycleId = followingCycle.id;
    }
  }
  const adjustRange = db.transaction(() => {
    db.prepare('UPDATE cycles SET start_date = ?, end_date = ?, review_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newStart, newEnd, reviewState, id);
    if (confirmedFollowingCycleId !== null) {
      db.prepare('UPDATE cycles SET review_state = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(confirmedFollowingCycleId);
    }
    logPeriodEvent(db, { entity: 'cycle', entity_id: id, action: 'update', cycle_id: id, date: newStart });

    const emptyOutsideDays = db.prepare(`
      SELECT cd.id, cd.date
      FROM cycle_days cd
      WHERE cd.cycle_id = ?
        AND (cd.date < ? OR (? IS NOT NULL AND cd.date > ?))
        AND cd.flow_intensity IS NULL
        AND (cd.notes IS NULL OR trim(cd.notes) = '')
        AND NOT EXISTS (SELECT 1 FROM symptoms s WHERE s.cycle_day_id = cd.id)
    `).all(id, newStart, newEnd, newEnd);
    if (emptyOutsideDays.length > 0) {
      const placeholders = emptyOutsideDays.map(() => '?').join(',');
      db.prepare(`DELETE FROM cycle_days WHERE id IN (${placeholders})`).run(...emptyOutsideDays.map(day => day.id));
      emptyOutsideDays.forEach(day => {
        logPeriodEvent(db, { entity: 'cycle_day', entity_id: day.id, action: 'delete', cycle_id: id, date: day.date });
      });
    }
    recomputeAllPredictions(db);
    return emptyOutsideDays.length;
  });
  const removedEmptyDays = adjustRange();
  emitActivity(req, { type: 'period.change', action: 'cycle', dates: [newStart] });
  res.json({ id, start_date: newStart, end_date: newEnd, removed_empty_days: removedEmptyDays });
});

module.exports = router;
