// Stand-in for the live-activity (SSE) module. The demo is single-user and has
// no server to push to, so every broadcast is a no-op. Routes still call
// emitActivity(req, event) after writes; it simply does nothing here.

export function emitActivity() { /* no-op: no other clients in a single-tab demo */ }
export function broadcast() { /* no-op */ }
export function addClient() { return 0 }
export function removeClient() { /* no-op */ }

export default { emitActivity, broadcast, addClient, removeClient }
