/**
 * Email Notification System
 *
 * Architecture:
 *   - Each notification type has: id, category, dateKey(), check(), subject(), html()
 *   - runNotifications(db) checks every type and sends if condition is met and not already sent today
 *   - startNotifications(db) schedules the daily cron (time from notification_time setting) AND runs a
 *     catch-up on startup (catch-up fires immediately if the computer was off at the scheduled cron time)
 *   - rescheduleNotifications(db) rebuilds the cron job from the current notification_time setting;
 *     call this whenever notification_time is updated via PATCH /api/settings/notification_time
 *
 * Adding a new notification type: register a new entry in NOTIFICATION_TYPES. No structural changes needed.
 */

const cron = require('node-cron')
const nodemailer = require('nodemailer')
const { logSystemError, logNotificationRunStart, logNotificationRunEnd, logNotificationSend } = require('../logger')
const { licensePayload } = require('../middleware/license')
const { computeCycleParams, getCalculationCycleState } = require('../routes/period/_calcHelpers')

// ---------------------------------------------------------------------------
// Mailer
// ---------------------------------------------------------------------------

function createTransport () {
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT || '587', 10),
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD
    }
  })
}

async function sendEmail (subject, html, to = process.env.ACCOUNT1_EMAIL) {
  if (process.env.DISABLE_EMAIL === 'true') {
    console.log(`📵 DISABLE_EMAIL=true — skipping send: ${subject}`)
    return
  }
  if (!process.env.MAIL_HOST || !process.env.MAIL_USER || !process.env.MAIL_PASSWORD || !to) {
    console.warn('⚠️  Email env vars not set — skipping send. Set MAIL_HOST, MAIL_USER, MAIL_PASSWORD, ACCOUNT1_EMAIL.')
    return
  }
  const transport = createTransport()
  await transport.sendMail({
    from: `"${_runContext.senderName}" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html
  })
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function daysBetween (dateStrA, dateStrB) {
  return Math.round((new Date(dateStrA) - new Date(dateStrB)) / (1000 * 60 * 60 * 24))
}

function addDays (dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

// ---------------------------------------------------------------------------
// Cron scheduling helpers
// ---------------------------------------------------------------------------

// Parses HH:MM → cron expression. Falls back to 08:00 on invalid input.
function buildCronExpr (timeStr, db) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr ?? '')
  if (match) {
    const h = parseInt(match[1], 10)
    const m = parseInt(match[2], 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${m} ${h} * * *`
  }
  if (timeStr !== undefined && timeStr !== null) {
    logSystemError(db, { source: 'notification', message: `Invalid notification_time "${timeStr}" — falling back to 08:00`, stack: '' })
    console.warn(`⚠️  Invalid notification_time "${timeStr}" — falling back to 08:00`)
  }
  return '0 8 * * *'
}

// ---------------------------------------------------------------------------
// Maintenance — auto-close stale open cycles
// ---------------------------------------------------------------------------

// Closes any open (tap-created) cycle whose last logged day is more than 5 days ago.
// Runs before notification checks so getSummary() always sees clean cycle state.
function autoCloseStale (db) {
  const stale = db.prepare(`
    SELECT c.id, COALESCE(MAX(cd.date), c.start_date) AS last_day
    FROM cycles c
    LEFT JOIN cycle_days cd ON cd.cycle_id = c.id
    WHERE c.end_date IS NULL
    GROUP BY c.id
    HAVING last_day <= date('now', '-5 days')
  `).all()

  for (const cycle of stale) {
    db.prepare(
      'UPDATE cycles SET end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(cycle.last_day, cycle.id)
    console.log(`🔒 Auto-closed cycle ${cycle.id} at ${cycle.last_day} (stale open cycle)`)
  }

  if (stale.length > 0) {
    console.log(`🔒 Auto-closed ${stale.length} stale cycle(s)`)
  }
}

// ---------------------------------------------------------------------------
// Summary calculation (mirrors logic from routes/period/calculations.js)
// ---------------------------------------------------------------------------

const CYCLE_SUMMARY_LOOKBACK_DAYS = 3

function getCycleSummaryContext (db, today, cycleState, avgCycleLength) {
  const lookbackStart = addDays(today, -CYCLE_SUMMARY_LOOKBACK_DAYS)
  const targetCycle = db.prepare(`
    SELECT c.* FROM cycles c
    WHERE c.start_date BETWEEN ? AND ?
      AND DATE(c.created_at) BETWEEN ? AND ?
      AND c.review_state IS NOT 'excluded'
      AND (c.end_date IS NOT NULL OR EXISTS (
        SELECT 1 FROM cycle_days cd WHERE cd.cycle_id = c.id
      ))
      AND NOT EXISTS (
        SELECT 1 FROM notification_log nl
        WHERE nl.type_id = 'cycle_summary'
          AND (
            nl.date_key = 'cycle:' || c.id
            OR (
              nl.date_key NOT LIKE 'cycle:%'
              AND nl.date_key BETWEEN c.start_date AND date(c.start_date, '+3 days')
            )
          )
      )
    ORDER BY c.start_date DESC, c.id DESC
    LIMIT 1
  `).get(lookbackStart, today, lookbackStart, today)

  if (!targetCycle) return null

  const targetIndex = cycleState.cycles.findIndex(cycle => cycle.id === targetCycle.id)
  if (targetIndex <= 0) return null

  const previousCycle = cycleState.cycles[targetIndex - 1]
  const cycleLength = daysBetween(targetCycle.start_date, previousCycle.start_date)
  const eligibleCycleIds = new Set(cycleState.eligibleCycles.map(cycle => cycle.id))
  const missingPeriodPair = cycleState.missingPeriodPairs.find(pair =>
    pair.earlier.id === previousCycle.id && pair.later.id === targetCycle.id
  )

  let comparisonStatus = 'eligible'
  if (cycleLength < 1) {
    comparisonStatus = 'invalid'
  } else if (missingPeriodPair?.reviewState === null) {
    comparisonStatus = 'awaiting_review'
  } else if (missingPeriodPair?.reviewState === 'excluded') {
    comparisonStatus = 'excluded'
  } else if (
    cycleState.unresolvedCycleIds.has(previousCycle.id) ||
    cycleState.unresolvedCycleIds.has(targetCycle.id)
  ) {
    comparisonStatus = 'awaiting_review'
  } else if (
    previousCycle.review_state === 'excluded' ||
    targetCycle.review_state === 'excluded'
  ) {
    comparisonStatus = 'excluded'
  } else if (
    !eligibleCycleIds.has(previousCycle.id) ||
    !eligibleCycleIds.has(targetCycle.id)
  ) {
    comparisonStatus = 'not_included'
  }

  return {
    targetCycleId: targetCycle.id,
    targetStartDate: targetCycle.start_date,
    previousStartDate: previousCycle.start_date,
    previousEndDate: previousCycle.effective_end,
    previousOvulationDate: previousCycle.ovulation_date,
    cycleLength,
    periodLength: daysBetween(previousCycle.effective_end, previousCycle.start_date) + 1,
    cycleLengthEstimate: comparisonStatus === 'eligible' ? avgCycleLength : null,
    comparisonStatus
  }
}

function getSummary (db) {
  const today = new Date().toISOString().split('T')[0]
  const ALPHA = 0.3

  const cycleState = getCalculationCycleState(db)
  const { eligibleCycles, cycleLengths } = cycleState
  const { avgCycleLength, avgPredictionError } = computeCycleParams(db, cycleState)
  const cycleSummary = getCycleSummaryContext(db, today, cycleState, avgCycleLength)

  const cycleStdDev = cycleLengths.length >= 2
    ? Math.round(Math.sqrt(cycleLengths.reduce((s, l) => s + Math.pow(l - avgCycleLength, 2), 0) / cycleLengths.length))
    : null

  const isIrregular = cycleStdDev !== null && cycleStdDev > 7

  // Was it already irregular before the latest cycle was added?
  const prevLengths = cycleLengths.slice(0, -1)
  const prevAvg = prevLengths.length > 0
    ? Math.round(prevLengths.slice(1).reduce((est, l) => ALPHA * l + (1 - ALPHA) * est, prevLengths[0]))
    : 28
  const prevStdDev = prevLengths.length >= 2
    ? Math.round(Math.sqrt(prevLengths.reduce((s, l) => s + Math.pow(l - prevAvg, 2), 0) / prevLengths.length))
    : null
  const wasIrregularBefore = prevStdDev !== null && prevStdDev > 7
  const becameIrregular = isIrregular && !wasIrregularBefore

  const prefRow = db.prepare("SELECT value FROM settings WHERE key = 'period_irregular'").get()
  const irregularSetting = prefRow?.value === '1'

  const lastCycle = eligibleCycles[eligibleCycles.length - 1] ?? null
  const errorAdj = Math.round(avgPredictionError)

  // Next period prediction — always a future date
  let nextPeriodDate = null
  if (lastCycle) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const predicted = new Date(lastCycle.start_date + 'T00:00:00')
    predicted.setDate(predicted.getDate() + avgCycleLength + errorAdj)
    while (predicted < today) {
      predicted.setDate(predicted.getDate() + avgCycleLength + errorAdj)
    }
    nextPeriodDate = predicted.toISOString().split('T')[0]
  }

  // Fertile window + ovulation — read from stored predictions on the most recent
  // cycle (same source as the calendar) to guarantee both surfaces always agree
  const fertileWindow = lastCycle?.predicted_fertile_start
    ? { start: lastCycle.predicted_fertile_start, end: lastCycle.predicted_fertile_end }
    : null
  const ovulationDate = lastCycle?.ovulation_date ?? lastCycle?.predicted_ovulation_date ?? null

  // Is there an active cycle right now?
  const currentCycle = eligibleCycles
    .slice()
    .reverse()
    .find(cycle => cycle.start_date <= today && cycle.effective_end >= today) ?? null

  return { today, avgCycleLength, cycleStdDev, isIrregular, becameIrregular, irregularSetting, lastCycle, nextPeriodDate, fertileWindow, ovulationDate, currentCycle, cycleSummary }
}

// ---------------------------------------------------------------------------
// Email templates — cute and affectionate tone for the household version
// ---------------------------------------------------------------------------

// Set once per run in runNotifications so all templates pick up current settings without arg threading
let _runContext = {
  signoff: 'Sent with love by your household app 💕',
  senderName: 'Grovely 💌'
}

const wrap = (body) => `
<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;background:#fff9fc;border-radius:12px;border:1px solid #f0d6e8;">
  ${body}
  <p style="margin-top:32px;font-size:12px;color:#bbb;">${_runContext.signoff}</p>
</div>`

function cycleSummaryHtml (summary) {
  if (!summary) return wrap('<p>A cycle summary is ready! 📊</p>')

  if (summary.comparisonStatus !== 'eligible') {
    const intervalLine = summary.cycleLength >= 1
      ? `<p>The new start was <strong>${summary.cycleLength} day${summary.cycleLength !== 1 ? 's' : ''}</strong> after the previous logged start.</p>`
      : ''
    const reviewLine = summary.comparisonStatus === 'awaiting_review'
      ? '<p>This interval is awaiting review, so it has not been included in cycle estimates.</p>'
      : '<p>This interval is not eligible for cycle estimates, so no estimate comparison is shown.</p>'
    return wrap(`
      <h2 style="color:#c06;">A cycle summary is ready 📊</h2>
      ${intervalLine}
      ${reviewLine}
      <p>Review the cycle dates in Grovely when convenient. 💗</p>`)
  }

  const ovulationLine = summary.previousOvulationDate
    ? `<p>Ovulation was tracked on <strong>${summary.previousOvulationDate}</strong>.</p>`
    : ''

  return wrap(`
    <h2 style="color:#c06;">A cycle summary is ready 📊</h2>
    <p>Your last cycle was <strong>${summary.cycleLength} day${summary.cycleLength !== 1 ? 's' : ''}</strong> long. Grovely's current cycle-length estimate is <strong>${summary.cycleLengthEstimate} days</strong>.</p>
    <p>Your period lasted <strong>${summary.periodLength} day${summary.periodLength !== 1 ? 's' : ''}</strong> (${summary.previousStartDate} → ${summary.previousEndDate}).</p>
    ${ovulationLine}
    <p>Here's to a smooth new cycle 💗</p>`)
}

// ---------------------------------------------------------------------------
// Notification registry
// ---------------------------------------------------------------------------

/**
 * Each entry:
 *   id        — unique string identifier
 *   category  — 'period' | 'pantry' — used to gate per-category toggles
 *   dateKey   — fn(today, db?, summary?) => string used as the unique date_key in notification_log
 *               Default is today's date. Weekly types return monday of the week.
 *   onSent    — optional fn(today, db). Called after a successful send. Use for post-send state writes
 *               (e.g. setting a flag on the data row). The notification_log entry is written before this fires.
 *   check     — fn(summary, db) => boolean. Return true to send.
 *   subject   — fn(summary) => string
 *   html      — fn(summary) => string (HTML email body)
 */
const NOTIFICATION_TYPES = [

  {
    id: 'period_due_3d',
    category: 'period',
    dateKey: (today) => today,
    check: ({ nextPeriodDate, currentCycle, today }) =>
      !currentCycle && !!nextPeriodDate && daysBetween(nextPeriodDate, today) === 3,
    subject: () => '💗 Your period is coming in 3 days',
    html: ({ nextPeriodDate }) => wrap(`
      <h2 style="color:#c06;">Hey ${_runContext.greeting} 💕</h2>
      <p>Just a little heads-up - your period is expected in <strong>3 days</strong> (around <strong>${nextPeriodDate}</strong>).</p>
      <p>Maybe a good time to make sure you have everything you need. You've got this! 🌸</p>`)
  },

  {
    id: 'period_due_2d',
    category: 'period',
    dateKey: (today) => today,
    check: ({ nextPeriodDate, currentCycle, today }) =>
      !currentCycle && !!nextPeriodDate && daysBetween(nextPeriodDate, today) === 2,
    subject: () => '💗 Period expected in 2 days',
    html: ({ nextPeriodDate }) => wrap(`
      <h2 style="color:#c06;">Hey ${_runContext.greeting} 🌸</h2>
      <p>Your period is expected in <strong>2 days</strong> (around <strong>${nextPeriodDate}</strong>).</p>
      <p>Take it easy, drink some tea, and be gentle with yourself. I love you! 💗</p>`)
  },

  {
    id: 'period_due_1d',
    category: 'period',
    dateKey: (today) => today,
    check: ({ nextPeriodDate, currentCycle, today }) =>
      !currentCycle && !!nextPeriodDate && daysBetween(nextPeriodDate, today) === 1,
    subject: () => '💗 Period expected tomorrow',
    html: () => wrap(`
      <h2 style="color:#c06;">Hey ${_runContext.greeting} 💕</h2>
      <p>Your period is expected <strong>tomorrow</strong>. Make sure you're prepared and be extra gentle with yourself today.</p>
      <p>Sending you all the warmth 🌸</p>`)
  },

  {
    id: 'period_overdue_3d',
    category: 'period',
    dateKey: (today) => today,
    check: ({ nextPeriodDate, currentCycle, today, irregularSetting }) =>
      !irregularSetting && !currentCycle && !!nextPeriodDate && daysBetween(today, nextPeriodDate) === 3,
    subject: () => '🌷 Period is a few days late',
    html: () => wrap(`
      <h2 style="color:#c06;">Hey ${_runContext.greeting} 🌷</h2>
      <p>Your period is a few days late - don't stress, bodies can be unpredictable sometimes!</p>
      <p>Take it easy, I'm thinking of you 💗</p>`)
  },

  {
    id: 'irregular_cycle',
    category: 'period',
    // Fires once when a new cycle tips stddev > 7, keyed to the cycle that caused it
    dateKey: (_today, _db, summary) => summary.lastCycle?.start_date || _today,
    check: ({ becameIrregular, irregularSetting }) => becameIrregular && !irregularSetting,
    subject: () => '📊 Your periods have been a little unpredictable lately',
    html: () => wrap(`
      <h2 style="color:#c06;">Hey ${_runContext.greeting} 💗</h2>
      <p>Your periods have been a little all over the place lately - sometimes earlier, sometimes later than usual.</p>
      <p>That's pretty normal and can happen for all kinds of reasons. Just thought you should know 🌸</p>`)
  },

  {
    id: 'fertile_window_tomorrow',
    category: 'period',
    dateKey: (today) => today,
    check: ({ fertileWindow, today }) =>
      !!fertileWindow && daysBetween(fertileWindow.start, today) === -1,
    subject: () => '🌿 Fertile window starts tomorrow',
    html: ({ fertileWindow }) => wrap(`
      <h2 style="color:#c06;">Hey ${_runContext.greeting} 🌿</h2>
      <p>Your fertile window is predicted to start <strong>tomorrow</strong> (${fertileWindow?.start} – ${fertileWindow?.end}).</p>
      <p>Just a little heads-up! 💗</p>`)
  },

  {
    id: 'fertile_window_start',
    category: 'period',
    dateKey: (today) => today,
    check: ({ fertileWindow, today }) =>
      !!fertileWindow && fertileWindow.start === today,
    subject: () => '🌿 Your fertile window is active today',
    html: ({ fertileWindow }) => wrap(`
      <h2 style="color:#c06;">Hey ${_runContext.greeting} 🌿</h2>
      <p>Your fertile window is <strong>active today</strong> and runs through <strong>${fertileWindow?.end}</strong>.</p>
      <p>Just letting you know! 💗</p>`)
  },

  {
    id: 'ovulation_today',
    category: 'period',
    dateKey: (today) => today,
    check: ({ ovulationDate, today }) => !!ovulationDate && ovulationDate === today,
    subject: () => '🌟 Today is your predicted ovulation day',
    html: () => wrap(`
      <h2 style="color:#c06;">Hey ${_runContext.greeting} 🌟</h2>
      <p>Today is your <strong>predicted ovulation day</strong> - your peak fertility day this cycle.</p>
      <p>Take care of yourself! 💗</p>`)
  },

  {
    id: 'fertile_window_ending',
    category: 'period',
    dateKey: (today) => today,
    check: ({ fertileWindow, today }) =>
      !!fertileWindow && fertileWindow.end === today,
    subject: () => '🌿 Last day of your fertile window',
    html: ({ fertileWindow }) => wrap(`
      <h2 style="color:#c06;">Hey ${_runContext.greeting} 🌿</h2>
      <p>Today is the <strong>last day of your fertile window</strong> (${fertileWindow?.start} – ${fertileWindow?.end}).</p>
      <p>Sending you love! 💗</p>`)
  },

  {
    id: 'pms_window',
    category: 'period',
    dateKey: (today) => today,
    check: ({ nextPeriodDate, currentCycle, today }) =>
      !currentCycle && !!nextPeriodDate && daysBetween(nextPeriodDate, today) === 5,
    subject: () => '🫂 PMS window may be starting',
    html: ({ nextPeriodDate }) => wrap(`
      <h2 style="color:#c06;">Hey ${_runContext.greeting} 🫂</h2>
      <p>Your period is expected in about <strong>5 days</strong> (around ${nextPeriodDate}), which means the PMS window may be starting.</p>
      <p>Be extra kind to yourself this week - snacks, warmth, and rest are all valid. I love you! 💗</p>`)
  },


  {
    id: 'period_ended',
    category: 'period',
    // Dedup is handled by cycles.period_ended_notified (set in onSent), NOT by the notification_log
    // date_key. This makes it immune to start_date edits (issue #27) — the flag lives on the row
    // and survives any field change to that cycle.
    //
    // Stability window (12h): prevents firing while the user is actively editing.
    // Safe for both cron and future live/push delivery — a check that fires mid-edit is blocked,
    // and the 3-day lookback ensures a blocked run gets a second chance once things settle.
    //
    // Constraint for cycle editing UI (issue #27): any route that writes start_date or end_date
    // MUST also set updated_at = CURRENT_TIMESTAMP so the stability window resets correctly.
    dateKey: (today) => today,
    check: ({ today }, db) => {
      const threeDaysAgo = addDays(today, -3)
      const yesterday = addDays(today, -1)
      const ended = db.prepare(`
        SELECT id FROM cycles
        WHERE end_date BETWEEN ? AND ?
          AND period_ended_notified = 0
          AND (updated_at IS NULL OR updated_at < datetime('now', '-12 hours'))
        ORDER BY end_date DESC LIMIT 1
      `).get(threeDaysAgo, yesterday)
      return !!ended
    },
    onSent: (today, db) => {
      const threeDaysAgo = addDays(today, -3)
      const yesterday = addDays(today, -1)
      db.prepare(`
        UPDATE cycles SET period_ended_notified = 1
        WHERE end_date BETWEEN ? AND ?
          AND period_ended_notified = 0
          AND (updated_at IS NULL OR updated_at < datetime('now', '-12 hours'))
      `).run(threeDaysAgo, yesterday)
    },
    subject: () => '🌸 Your period just ended',
    html: ({ today, avgCycleLength }, db) => {
      const yesterday = addDays(today, -1)
      const cycle = db.prepare('SELECT * FROM cycles WHERE end_date = ?').get(yesterday)
      if (!cycle) return wrap('<p>Your period just ended! 🌸</p>')
      const periodLength = daysBetween(cycle.end_date, cycle.start_date) + 1
      return wrap(`
        <h2 style="color:#c06;">Your period just ended 🌸</h2>
        <p>Your period lasted <strong>${periodLength} day${periodLength !== 1 ? 's' : ''}</strong> (${cycle.start_date} → ${cycle.end_date}).</p>
        <p>Your current cycle-length estimate is <strong>${avgCycleLength} days</strong>.</p>
        <p>Rest up - you did great 💗</p>`)
    }
  },

  {
    id: 'pantry_expiry_today',
    category: 'pantry',
    dateKey: (today) => today,
    check: (_summary, db) => {
      const items = db.prepare(
        "SELECT id FROM pantry WHERE status = 'active' AND deleted_at IS NULL AND expiry_date = date('now')"
      ).all()
      return items.length > 0
    },
    subject: () => '🧊 Items expiring today',
    html: (_summary, db) => {
      const items = db.prepare(
        "SELECT name, quantity FROM pantry WHERE status = 'active' AND deleted_at IS NULL AND expiry_date = date('now') ORDER BY name ASC"
      ).all()
      const list = items.map(i => `<li>${i.name}${i.quantity ? ` (${i.quantity})` : ''}</li>`).join('')
      return wrap(`
        <h2 style="color:#c45309;">Items expiring today 🧊</h2>
        <p>These items in your pantry expire today - use them up before they go to waste!</p>
        <ul style="padding-left:1.5em;line-height:1.8;">${list}</ul>`)
    }
  },

  {
    id: 'pantry_expiry_soon',
    category: 'pantry',
    dateKey: (today) => today,
    check: (_summary, db) => {
      const row = db.prepare("SELECT value FROM settings WHERE key = 'pantry_expiry_warning_days'").get()
      const warningDays = Math.max(1, parseInt(row?.value ?? '3', 10))
      const items = db.prepare(
        "SELECT id FROM pantry WHERE status = 'active' AND deleted_at IS NULL AND expiry_date > date('now') AND expiry_date <= date('now', '+' || ? || ' days')"
      ).all(String(warningDays))
      return items.length > 0
    },
    subject: () => '🧊 Items expiring soon',
    html: (_summary, db) => {
      const row = db.prepare("SELECT value FROM settings WHERE key = 'pantry_expiry_warning_days'").get()
      const warningDays = Math.max(1, parseInt(row?.value ?? '3', 10))
      const items = db.prepare(
        "SELECT name, quantity, expiry_date FROM pantry WHERE status = 'active' AND deleted_at IS NULL AND expiry_date > date('now') AND expiry_date <= date('now', '+' || ? || ' days') ORDER BY expiry_date ASC, name ASC"
      ).all(String(warningDays))
      const list = items.map(i => {
        const days = Math.round((new Date(i.expiry_date) - new Date()) / 86400000)
        const when = days === 1 ? 'tomorrow' : `in ${days} days`
        return `<li>${i.name}${i.quantity ? ` (${i.quantity})` : ''} - expires <strong>${when}</strong></li>`
      }).join('')
      return wrap(`
        <h2 style="color:#c45309;">Items expiring soon 🧊</h2>
        <p>These pantry items will expire within the next ${warningDays} day${warningDays !== 1 ? 's' : ''}:</p>
        <ul style="padding-left:1.5em;line-height:1.8;">${list}</ul>`)
    }
  },

  {
    id: 'pantry_expired',
    category: 'pantry',
    // Dedup is handled by pantry.expiry_notified (set in onSent), not by notification_log date_key.
    // Fires once per newly-expired item: check triggers when any active item has expiry_notified = 0,
    // but the email always lists all currently-expired active items so the recipient sees the full picture.
    dateKey: (today) => today,
    check: (_summary, db) => {
      const row = db.prepare(
        "SELECT id FROM pantry WHERE status = 'active' AND deleted_at IS NULL AND expiry_date < date('now') AND expiry_notified = 0 LIMIT 1"
      ).get()
      return !!row
    },
    onSent: (_today, db) => {
      db.prepare(
        "UPDATE pantry SET expiry_notified = 1 WHERE status = 'active' AND deleted_at IS NULL AND expiry_date < date('now')"
      ).run()
    },
    subject: () => '🧊 Items past their expiry date',
    html: (_summary, db) => {
      const items = db.prepare(
        "SELECT name, quantity, expiry_date FROM pantry WHERE status = 'active' AND deleted_at IS NULL AND expiry_date < date('now') ORDER BY expiry_date ASC, name ASC"
      ).all()
      const list = items.map(i => {
        const daysAgo = Math.round((new Date() - new Date(i.expiry_date)) / 86400000)
        const when = daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`
        return `<li>${i.name}${i.quantity ? ` (${i.quantity})` : ''} - expired <strong>${when}</strong></li>`
      }).join('')
      return wrap(`
        <h2 style="color:#c45309;">Items past their expiry date 🧊</h2>
        <p>These pantry items have already expired - you may want to check them:</p>
        <ul style="padding-left:1.5em;line-height:1.8;">${list}</ul>`)
    }
  },

  // ── Partner notifications (sent to ACCOUNT2_EMAIL) ──────────────────────────
  // All three require a valid license AND ACCOUNT2_EMAIL to be configured.
  // They fire on the same conditions as their owner1 counterparts but with a
  // partner-facing tone ("her period is starting") and go to the partner inbox.

  {
    id: 'partner_period_starting',
    category: 'period',
    getTo: () => process.env.ACCOUNT2_EMAIL,
    dateKey: (today) => today,
    check: ({ nextPeriodDate, currentCycle, today }) =>
      !!process.env.ACCOUNT2_EMAIL &&
      !currentCycle && !!nextPeriodDate && daysBetween(nextPeriodDate, today) === 3,
    subject: () => '💗 Heads up - her period is coming in 3 days',
    html: ({ nextPeriodDate }) => wrap(`
      <h2 style="color:#c06;">Heads up 💕</h2>
      <p>Her period is expected in <strong>3 days</strong> (around <strong>${nextPeriodDate}</strong>).</p>
      <p>Maybe a great time to be extra attentive and make sure she has everything she needs. 🌸</p>`)
  },

  {
    id: 'partner_fertile_window',
    category: 'period',
    getTo: () => process.env.ACCOUNT2_EMAIL,
    dateKey: (today) => today,
    check: ({ fertileWindow, today }) =>
      !!process.env.ACCOUNT2_EMAIL &&
      !!fertileWindow && fertileWindow.start === today,
    subject: () => '🌿 Her fertile window is active today',
    html: ({ fertileWindow }) => wrap(`
      <h2 style="color:#c06;">Just so you know 🌿</h2>
      <p>Her fertile window is <strong>active today</strong> and runs through <strong>${fertileWindow?.end}</strong>.</p>
      <p>Sending you both love! 💗</p>`)
  },

  {
    id: 'partner_period_ended',
    category: 'period',
    getTo: () => process.env.ACCOUNT2_EMAIL,
    dateKey: (today) => today,
    check: ({ today }, db) => {
      if (!process.env.ACCOUNT2_EMAIL) return false
      const threeDaysAgo = addDays(today, -3)
      const yesterday = addDays(today, -1)
      const ended = db.prepare(`
        SELECT id FROM cycles
        WHERE end_date BETWEEN ? AND ?
          AND period_ended_notified = 0
          AND (updated_at IS NULL OR updated_at < datetime('now', '-12 hours'))
        ORDER BY end_date DESC LIMIT 1
      `).get(threeDaysAgo, yesterday)
      return !!ended
    },
    subject: () => '🌸 Her period just ended',
    html: ({ today, avgCycleLength }, db) => {
      const yesterday = addDays(today, -1)
      const cycle = db.prepare('SELECT * FROM cycles WHERE end_date = ?').get(yesterday)
      if (!cycle) return wrap('<p>Her period just ended - she may appreciate some extra care today! 🌸</p>')
      const periodLength = daysBetween(cycle.end_date, cycle.start_date) + 1
      return wrap(`
        <h2 style="color:#c06;">Her period just ended 🌸</h2>
        <p>Her period lasted <strong>${periodLength} day${periodLength !== 1 ? 's' : ''}</strong> (${cycle.start_date} → ${cycle.end_date}).</p>
        <p>Her current cycle-length estimate is <strong>${avgCycleLength} days</strong>.</p>
        <p>She may appreciate some extra care and rest right now. 💗</p>`)
    }
  },

  {
    id: 'cycle_summary',
    category: 'period',
    dateKey: (today, _db, summary) => summary.cycleSummary
      ? `cycle:${summary.cycleSummary.targetCycleId}`
      : `none:${today}`,
    check: ({ cycleSummary }) => !!cycleSummary,
    subject: () => '📊 Your cycle summary',
    html: ({ cycleSummary }) => cycleSummaryHtml(cycleSummary)
  }

]

// ---------------------------------------------------------------------------
// Core runner
// ---------------------------------------------------------------------------

const PERIOD_DUE_LEAD_DAYS = { period_due_1d: 1, period_due_2d: 2, period_due_3d: 3 }

async function runNotifications (db, trigger = 'scheduled') {
  autoCloseStale(db)

  const summary = getSummary(db)
  const { today } = summary

  // Read app settings
  const settingRows = db.prepare('SELECT key, value FROM settings').all()
  const appSettings = {}
  settingRows.forEach(r => { appSettings[r.key] = r.value })

  const notificationsEnabled = appSettings.notifications_enabled !== '0'
  const periodEnabled = appSettings.period_notifications_enabled !== '0'
  const pantryEnabled = appSettings.pantry_notifications_enabled !== '0'
  const reminderDays = parseInt(appSettings.reminder_days ?? '3', 10)

  _runContext = {
    signoff: appSettings.notification_signoff || 'Sent with love by your household app 💕',
    senderName: appSettings.notification_sender_name || 'Grovely 💌',
    greeting: appSettings.notification_greeting || 'love'
  }

  // Per-type enabled flags and custom messages
  const typeSettings = {}
  try {
    db.prepare('SELECT type_id, enabled, custom_message FROM notification_type_settings').all()
      .forEach(r => { typeSettings[r.type_id] = r })
  } catch { /* table may not exist on older instances */ }

  if (!licensePayload) {
    console.log('🔒 No active license — notification emails require a premium license')
    return
  }

  if (!notificationsEnabled) {
    console.log('🔕 Notifications disabled — skipping run')
    return
  }

  // Mark this daily run as done for today (prevents duplicate runs on restart).
  // Written only after the license and enabled guards so a license-less or disabled
  // boot does not consume the daily catch-up slot (#174); adding a license or enabling
  // notifications mid-day and restarting will then still fire via the startup catch-up.
  try {
    db.prepare(
      "INSERT OR IGNORE INTO notification_log (type_id, date_key) VALUES ('__daily_run__', ?)"
    ).run(today)
  } catch (_) { /* already recorded */ }

  console.log(`🔔 Running notification checks for ${today}`)

  const run_id = logNotificationRunStart(db, { trigger, run_date: today })

  let total_checked = 0
  let total_sent = 0
  let total_skipped = 0
  let total_errors = 0

  for (const type of NOTIFICATION_TYPES) {
    // Category-level toggles (checked after global toggle, before individual type logic)
    if (type.category === 'period' && !periodEnabled) {
      total_skipped++
      continue
    }
    if (type.category === 'pantry' && !pantryEnabled) {
      total_skipped++
      continue
    }

    // Per-type enabled check
    if (typeSettings[type.id]?.enabled === 0) {
      total_skipped++
      continue
    }

    // Skip period_due types suppressed by reminder_days setting
    if (PERIOD_DUE_LEAD_DAYS[type.id] !== undefined && PERIOD_DUE_LEAD_DAYS[type.id] > reminderDays) {
      total_skipped++
      continue
    }
    const dateKey = type.dateKey(today, db, summary)
    total_checked++

    // Already sent for this date_key?
    const alreadySent = db.prepare(
      'SELECT id FROM notification_log WHERE type_id = ? AND date_key = ?'
    ).get(type.id, dateKey)
    if (alreadySent) {
      total_skipped++
      continue
    }

    // Check condition
    let shouldSend = false
    try {
      shouldSend = type.check(summary, db)
    } catch (err) {
      console.error(`Error checking notification ${type.id}:`, err)
      logSystemError(db, { source: 'notification', message: `Check failed for ${type.id}: ${err.message}`, stack: err.stack })
      total_errors++
      continue
    }

    if (!shouldSend) {
      total_skipped++
      continue
    }

    // Send email
    try {
      const subject = type.subject(summary)
      const customMsg = typeSettings[type.id]?.custom_message?.trim()
      const html = customMsg
        ? wrap(`<h2 style="color:#c06;">Hey ${_runContext.greeting} 💕</h2><p>${customMsg}</p>`)
        : type.html(summary, db)
      const to = type.getTo ? type.getTo() : undefined
      await sendEmail(subject, html, to)
      db.prepare(
        'INSERT OR IGNORE INTO notification_log (type_id, date_key) VALUES (?, ?)'
      ).run(type.id, dateKey)
      if (type.onSent) type.onSent(today, db)
      logNotificationSend(db, { run_id, type_id: type.id })
      console.log(`✅ Notification sent: ${type.id}`)
      total_sent++
    } catch (err) {
      console.error(`Failed to send notification ${type.id}:`, err.message)
      logSystemError(db, { source: 'notification', message: `Send failed for ${type.id}: ${err.message}`, stack: err.stack })
      total_errors++
    }
  }

  logNotificationRunEnd(db, { run_id, total_checked, total_sent, total_skipped, total_errors })
}

// ---------------------------------------------------------------------------
// Startup + cron scheduler
// ---------------------------------------------------------------------------

let _cronJob = null

function rescheduleNotifications (db) {
  if (!_cronJob) return
  const row = db.prepare("SELECT value FROM settings WHERE key = 'notification_time'").get()
  const expr = buildCronExpr(row?.value, db)
  _cronJob.stop()
  _cronJob = cron.schedule(expr, () => {
    runNotifications(db).catch(err => console.error('Scheduled notification run failed:', err))
  })
  console.log(`🕗 Notification cron rescheduled: ${expr}`)
}

function startNotifications (db) {
  // Maintenance always runs on startup regardless of email settings
  autoCloseStale(db)

  const timeRow = db.prepare("SELECT value FROM settings WHERE key = 'notification_time'").get()
  const cronExpr = buildCronExpr(timeRow?.value, db)

  if (process.env.DISABLE_EMAIL === 'true') {
    console.log('📵 DISABLE_EMAIL=true — notification cron disabled')
    // Still schedule daily maintenance so auto-close runs even without email
    cron.schedule(cronExpr, () => autoCloseStale(db))
    console.log(`🕗 Maintenance-only cron scheduled: ${cronExpr}`)
    return
  }

  const today = new Date().toISOString().split('T')[0]

  // Catch-up: if the daily run didn't fire today (computer was off at cron time), run now
  const alreadyRanToday = db.prepare(
    "SELECT id FROM notification_log WHERE type_id = '__daily_run__' AND date_key = ?"
  ).get(today)

  if (!alreadyRanToday) {
    console.log('🔔 Startup catch-up: daily notification run not yet fired today — running now')
    // Run async, don't block startup
    runNotifications(db, 'startup_catchup').catch(err => console.error('Startup notification run failed:', err))
  } else {
    console.log('✅ Notifications already ran today — skipping startup catch-up')
  }

  // Schedule daily at the configured time
  _cronJob = cron.schedule(cronExpr, () => {
    runNotifications(db).catch(err => console.error('Scheduled notification run failed:', err))
  })

  console.log(`🕗 Notification cron scheduled: ${cronExpr}`)
}

async function sendTestEmail (db) {
  const settingRows = db.prepare('SELECT key, value FROM settings').all()
  const appSettings = {}
  settingRows.forEach(r => { appSettings[r.key] = r.value })

  const greeting   = appSettings.notification_greeting    || 'love'
  const signoff    = appSettings.notification_signoff     || 'Sent with love by your household app 💕'
  const senderName = appSettings.notification_sender_name || 'Grovely 💌'

  _runContext = { signoff, senderName, greeting }

  const subject = '📬 Test notification from Grovely'
  const html = wrap(`
    <h2 style="color:#c06;">Hey ${greeting} 💕</h2>
    <p>This is a test notification from your household app - if you're reading this, your email delivery is working perfectly!</p>
    <p>You're all set. 🌸</p>`)

  await sendEmail(subject, html, process.env.ACCOUNT1_EMAIL)
  if (process.env.ACCOUNT2_EMAIL) {
    await sendEmail(subject, html, process.env.ACCOUNT2_EMAIL)
  }
}

module.exports = {
  startNotifications,
  rescheduleNotifications,
  sendTestEmail,
  __test: { cycleSummaryHtml, getCycleSummaryContext, notificationTypes: NOTIFICATION_TYPES }
}
