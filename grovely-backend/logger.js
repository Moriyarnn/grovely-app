/**
 * Structured application logger.
 * Every function writes to the DB table AND calls console.log — one call covers both.
 * Pass `db` from the calling route or service.
 *
 * Rules:
 *   - Do NOT log personal health content (notes text, symptom names)
 *   - Log only IDs, dates, and computed metadata
 */

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

function logSystemError (db, { source, message, stack = null }) {
  db.prepare(
    'INSERT INTO log_system_errors (source, message, stack) VALUES (?, ?, ?)'
  ).run(source, message, stack ?? null)
  console.error(`[log_system_errors] source=${source} message=${message}`)
}

/**
 * Call at the START of a notification run to get a run_id.
 * Returns the new run id so you can pass it to logNotificationSend / logNotificationRunEnd.
 */
function logNotificationRunStart (db, { trigger, run_date }) {
  const result = db.prepare(
    'INSERT INTO log_system_notification_runs (trigger, run_date) VALUES (?, ?)'
  ).run(trigger, run_date)
  const run_id = result.lastInsertRowid
  console.log(`[log_system_notification_runs] run_id=${run_id} trigger=${trigger} run_date=${run_date}`)
  return run_id
}

/**
 * Call at the END of a notification run with final counters.
 */
function logNotificationRunEnd (db, { run_id, total_checked, total_sent, total_skipped, total_errors }) {
  db.prepare(`
    UPDATE log_system_notification_runs
    SET total_checked = ?, total_sent = ?, total_skipped = ?, total_errors = ?
    WHERE id = ?
  `).run(total_checked, total_sent, total_skipped, total_errors, run_id)
  console.log(`[log_system_notification_runs] run_id=${run_id} checked=${total_checked} sent=${total_sent} skipped=${total_skipped} errors=${total_errors}`)
}

function logNotificationSend (db, { run_id, type_id }) {
  db.prepare(
    'INSERT INTO log_system_notification_sends (run_id, type_id) VALUES (?, ?)'
  ).run(run_id, type_id)
  console.log(`[log_system_notification_sends] run_id=${run_id} type_id=${type_id}`)
}

// ---------------------------------------------------------------------------
// Period
// ---------------------------------------------------------------------------

function logPeriodEvent (db, { entity, entity_id, action, cycle_id, date }) {
  db.prepare(
    'INSERT INTO log_period_events (entity, entity_id, action, cycle_id, date) VALUES (?, ?, ?, ?, ?)'
  ).run(entity, entity_id, action, cycle_id, date)
  console.log(`[log_period_events] entity=${entity} entity_id=${entity_id} action=${action} cycle_id=${cycle_id} date=${date}`)
}

function logPeriodCalculation (db, {
  source,
  avg_cycle_length = null,
  avg_period_length = null,
  next_period_date = null,
  ovulation_date = null,
  fertile_window_start = null,
  fertile_window_end = null,
  is_irregular = 0,
  cycle_std_dev = null,
  data_warnings_count = 0,
  total_cycles_tracked = null
}) {
  db.prepare(`
    INSERT INTO log_period_calculations (
      source, avg_cycle_length, avg_period_length, next_period_date,
      ovulation_date, fertile_window_start, fertile_window_end,
      is_irregular, cycle_std_dev, data_warnings_count, total_cycles_tracked
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    source, avg_cycle_length, avg_period_length, next_period_date,
    ovulation_date, fertile_window_start, fertile_window_end,
    is_irregular ? 1 : 0, cycle_std_dev, data_warnings_count, total_cycles_tracked
  )
  console.log(`[log_period_calculations] source=${source} next_period=${next_period_date} avg_cycle=${avg_cycle_length} irregular=${is_irregular}`)
}

module.exports = {
  logSystemError,
  logNotificationRunStart,
  logNotificationRunEnd,
  logNotificationSend,
  logPeriodEvent,
  logPeriodCalculation
}
