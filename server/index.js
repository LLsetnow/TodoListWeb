import 'dotenv/config'
import express from 'express'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Resend } from 'resend'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import path from 'path'
import { existsSync } from 'fs'

const MONGO_URL = process.env.MONGO_URL || 'mongodb://root:0v024U15C03DApeF@test-db-mongodb.ns-27q1wqr8.svc:27017'
const DB_NAME = process.env.DB_NAME || 'todo'
const JWT_SECRET = process.env.JWT_SECRET
const RESEND_API_KEY = process.env.RESEND_API_KEY
const PORT = process.env.PORT || 3000
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`

if (!JWT_SECRET) {
  console.error('JWT_SECRET is required. Set it in .env')
  process.exit(1)
}

const resend = RESEND_API_KEY && RESEND_API_KEY !== 're_placeholder' ? new Resend(RESEND_API_KEY) : null

const app = express()
app.use(express.json())

let db

function generateId() {
  return Date.now().toString(16) + Math.random().toString(16).slice(2, 14)
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function connectDB() {
  const client = new MongoClient(MONGO_URL, {
    serverSelectionTimeoutMS: 5000,
  })
  try {
    await client.connect()
    db = client.db(DB_NAME)
    await db.collection('users').createIndex({ email: 1 }, { unique: true })
    await db.collection('tasks').createIndex({ userId: 1 })
    await db.collection('verify_codes').createIndex({ email: 1 }, { unique: true })
    await db.collection('verify_codes').createIndex({ createdAt: 1 }, { expireAfterSeconds: 600 })
    console.log('MongoDB connected')
  } catch (e) {
    console.error('MongoDB 连接失败:', e.message)
  }
}

function checkDB(req, res, next) {
  if (!db) return res.status(503).json({ code: 1, error: 'Database not available' })
  next()
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ code: 1, error: 'Authentication required' })
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET)
    req.userId = payload.userId
    next()
  } catch {
    return res.status(401).json({ code: 1, error: 'Invalid or expired token' })
  }
}

// === Auth routes (public) ===

// Send 6-digit verification code
app.post('/send-verify-code', checkDB, async (req, res) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.json({ code: 1, error: 'Email is required' })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.json({ code: 1, error: 'Invalid email format' })
    }

    const existingUser = await db.collection('users').findOne({ email })
    if (existingUser) {
      return res.json({ code: 1, error: 'Email already registered' })
    }

    const code = generateCode()
    await db.collection('verify_codes').updateOne(
      { email },
      { $set: { email, code, createdAt: new Date() } },
      { upsert: true }
    )

    if (resend) {
      try {
        await resend.emails.send({
          from: 'Todo App <onboarding@resend.dev>',
          to: email,
          subject: '邮箱验证码',
          html: `<p>您的验证码是：</p><h2 style="letter-spacing:6px">${code}</h2><p>验证码 10 分钟内有效。</p>`,
        })
      } catch (e) {
        await db.collection('verify_codes').deleteOne({ email })
        return res.json({ code: 1, error: 'Failed to send email: ' + e.message })
      }
    }

    res.json({ code: 0, message: 'Verification code sent' })
  } catch (e) {
    res.json({ code: 1, error: e.message })
  }
})

// Register with verification code
app.post('/register', checkDB, async (req, res) => {
  try {
    const { email, password, code } = req.body
    if (!email || !password || !code) {
      return res.json({ code: 1, error: 'Email, password and verification code are required' })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.json({ code: 1, error: 'Invalid email format' })
    }
    if (password.length < 6) {
      return res.json({ code: 1, error: 'Password must be at least 6 characters' })
    }

    const existing = await db.collection('users').findOne({ email })
    if (existing) {
      return res.json({ code: 1, error: 'Email already registered' })
    }

    const record = await db.collection('verify_codes').findOne({ email })
    if (!record) {
      return res.json({ code: 1, error: 'Verification code not found. Please send code first.' })
    }
    if (record.code !== code) {
      return res.json({ code: 1, error: 'Invalid verification code' })
    }

    const hashed = await bcrypt.hash(password, 10)
    const user = {
      _id: generateId(),
      email,
      password: hashed,
      createdAt: new Date(),
    }
    await db.collection('users').insertOne(user)
    await db.collection('verify_codes').deleteOne({ email })

    res.json({ code: 0, message: 'Registration successful' })
  } catch (e) {
    res.json({ code: 1, error: e.message })
  }
})

app.post('/login', checkDB, async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.json({ code: 1, error: 'Email and password are required' })
    }

    const user = await db.collection('users').findOne({ email })
    if (!user) {
      return res.json({ code: 1, error: 'Invalid email or password' })
    }

    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      return res.json({ code: 1, error: 'Invalid email or password' })
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ code: 0, data: { token, userId: user._id } })
  } catch (e) {
    res.json({ code: 1, error: e.message })
  }
})

// Delete user (requires email + password to confirm)
app.post('/delete-user', checkDB, async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.json({ code: 1, error: 'Email and password are required' })
    }

    const user = await db.collection('users').findOne({ email })
    if (!user) {
      return res.json({ code: 1, error: 'User not found' })
    }

    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      return res.json({ code: 1, error: 'Invalid password' })
    }

    await db.collection('tasks').deleteMany({ userId: user._id })
    await db.collection('users').deleteOne({ _id: user._id })
    await db.collection('verify_codes').deleteOne({ email })

    res.json({ code: 0, message: 'User deleted' })
  } catch (e) {
    res.json({ code: 1, error: e.message })
  }
})

// === Task routes (require auth) ===

app.get('/fetch_tasks', checkDB, authMiddleware, async (req, res) => {
  try {
    const tasks = await db.collection('tasks').find({ userId: req.userId }).toArray()
    res.json(tasks.map(t => ({
      id: t._id,
      value: t.value,
      isCompleted: t.isCompleted || false,
    })))
  } catch (e) {
    res.json({ code: 1, error: e.message })
  }
})

app.post('/add_task', checkDB, authMiddleware, async (req, res) => {
  try {
    const { value, isCompleted = false } = req.body
    if (!value) return res.json({ code: 1, error: 'value is required' })
    const _id = generateId()
    await db.collection('tasks').insertOne({ _id, userId: req.userId, value, isCompleted })
    res.json({ code: 0, data: { id: _id, value, isCompleted } })
  } catch (e) {
    res.json({ code: 1, error: e.message })
  }
})

app.post('/delete_task', checkDB, authMiddleware, async (req, res) => {
  try {
    const { id } = req.query
    if (!id) return res.json({ code: 1, error: 'id is required' })
    await db.collection('tasks').deleteOne({ _id: id, userId: req.userId })
    res.json({ code: 0 })
  } catch (e) {
    res.json({ code: 1, error: e.message })
  }
})

app.post('/toggle_complete', checkDB, authMiddleware, async (req, res) => {
  try {
    const { id } = req.query
    const { isCompleted } = req.body
    if (!id) return res.json({ code: 1, error: 'id is required' })
    await db.collection('tasks').updateOne({ _id: id, userId: req.userId }, { $set: { isCompleted } })
    res.json({ code: 0 })
  } catch (e) {
    res.json({ code: 1, error: e.message })
  }
})

// Production: serve built frontend from dist/
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(__dirname, '..', 'dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
  // SPA fallback
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/register') || req.path.startsWith('/login') ||
        req.path.startsWith('/send-verify-code') || req.path.startsWith('/delete-user') || req.path.startsWith('/fetch_tasks') ||
        req.path.startsWith('/add_task') || req.path.startsWith('/delete_task') ||
        req.path.startsWith('/toggle_complete')) {
      return next()
    }
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// Start server
connectDB()
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`))
