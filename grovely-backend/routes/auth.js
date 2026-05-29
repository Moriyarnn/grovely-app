const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const rateLimit = require('express-rate-limit')
const { requireAuth } = require('../middleware/auth')

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' }
})

module.exports = (db) => {
  router.post('/login', loginLimiter, (req, res) => {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = bcrypt.compareSync(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    )

    res.json({ token, role: user.role, username: user.username })
  })

  router.get('/me', requireAuth, (req, res) => {
    res.json({ id: req.user.id, username: req.user.username, role: req.user.role })
  })

  if (process.env.NODE_ENV !== 'production') {
    router.post('/dev-switch', (req, res) => {
      const { role } = req.body
      if (!role || !['owner1', 'owner2'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' })
      }
      const user = db.prepare('SELECT * FROM users WHERE role = ?').get(role)
      if (!user) return res.status(404).json({ error: `No user with role: ${role}` })
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      )
      res.json({ token, role: user.role, username: user.username })
    })
  }

  return router
}
