// Stand-in for the structured DB logger. The demo has no logs dashboard and no
// reason to fill log tables, so every logger call is a no-op. logNotification
// RunStart returns a fake id to satisfy callers that pass it on.

export function logSystemError() { /* no-op */ }
export function logNotificationRunStart() { return 0 }
export function logNotificationRunEnd() { /* no-op */ }
export function logNotificationSend() { /* no-op */ }
export function logPeriodEvent() { /* no-op */ }
export function logPeriodCalculation() { /* no-op */ }

export default {
  logSystemError,
  logNotificationRunStart,
  logNotificationRunEnd,
  logNotificationSend,
  logPeriodEvent,
  logPeriodCalculation,
}
