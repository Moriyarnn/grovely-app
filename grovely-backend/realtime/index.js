// Live activity — Server-Sent Events (SSE) push for real-time sync between
// household accounts. One-way server -> client. Pure live push: no replay, no
// backfill, no persistence. Events fired while a session is not connected are
// simply lost for that session.
//
// FORWARD-COMPAT (#137 multi-account): targeting is ALWAYS "every connected
// client whose user id != the actor's id" - never filtered by role. Today that
// resolves to the other of owner1/owner2; with N accounts it already means
// "everyone in the household except the person who made the change". Do not add
// role-based filtering here.

let nextId = 1
const clients = new Map() // connId -> { userId, res }  (multiple sessions per user supported)

function addClient(userId, res) {
  const id = nextId++
  clients.set(id, { userId, res })
  return id
}

function removeClient(id) {
  clients.delete(id)
}

// Broadcast to every connection except those belonging to the actor.
function broadcast(actorId, data) {
  const frame = `data: ${JSON.stringify(data)}\n\n`
  for (const { userId, res } of clients.values()) {
    if (userId === actorId) continue
    try { res.write(frame) } catch {}
  }
}

// Keep idle connections alive through reverse proxies (comment frames are ignored
// by EventSource).
setInterval(() => {
  for (const { res } of clients.values()) {
    try { res.write(': ping\n\n') } catch {}
  }
}, 25000).unref?.()

// Route-facing helper: gate on the actor's broadcast preference (default on when
// the row is absent), resolve the actor's display name, then broadcast. Never
// throws into the request path.
function emitActivity(req, event) {
  try {
    const db = req.db
    const actorId = req.user && req.user.id
    if (!db || !actorId) return
    const pref = db.prepare(
      "SELECT value FROM user_preferences WHERE user_id = ? AND key = 'live_activity_broadcast'"
    ).get(actorId)
    const broadcastOn = pref ? pref.value === '1' : true // default on
    if (!broadcastOn) return
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(actorId)
    const actorName = (user && user.username) || 'Someone'
    broadcast(actorId, { ...event, actorId, actorName, ts: Date.now() })
  } catch {}
}

module.exports = { addClient, removeClient, broadcast, emitActivity }
