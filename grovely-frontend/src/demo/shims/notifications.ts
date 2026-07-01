// Stand-in for the email-notifications module. The demo has no SMTP and no
// cron; settings.js calls rescheduleNotifications after a settings change and
// premium routes call sendTestEmail. Both are no-ops here.

export function startNotifications() { /* no-op */ }
export function rescheduleNotifications() { /* no-op */ }
export function sendTestEmail() { return Promise.resolve({ ok: false, demo: true }) }

export default { startNotifications, rescheduleNotifications, sendTestEmail }
