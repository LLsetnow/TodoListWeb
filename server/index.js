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

async function connectDB() {
  const client = new MongoClient(MONGO_URL, {
    serverSelectionTimeoutMS: 5000,
  })
  try {
    await client.connect()
    db = client.db(DB_NAME)
    await db.collection('users').createIndex({ email: 1 }, { unique: true })
    await db.collection('tasks').createIndex({ userId: 1 })
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

app.post('/register', checkDB, async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.json({ code: 1, error: 'Email and password are required' })
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

    const hashed = await bcrypt.hash(password, 10)
    const verificationToken = generateToken()
    const user = {
      _id: generateId(),
      email,
      password: hashed,
      verified: false,
      verificationToken,
      createdAt: new Date(),
    }
    await db.collection('users').insertOne(user)

    if (resend) {
      try {
        await resend.emails.send({
          from: 'Todo App <onboarding@resend.dev>',
          to: email,
          subject: 'Verify your email',
          html: `<p>Welcome! Click the link below to verify your email:</p><p><a href="${APP_URL}/verify-email?token=${verificationToken}">Verify Email</a></p>`,
        })
      } catch {
        // Don't fail registration if email sending fails
      }
    }

    res.json({ code: 0, message: 'Registration successful. Please check your email to verify your account.' })
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

    if (!user.verified) {
      return res.json({ code: 1, error: 'Please verify your email before logging in' })
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ code: 0, data: { token, userId: user._id } })
  } catch (e) {
    res.json({ code: 1, error: e.message })
  }
})

app.get('/verify-email', checkDB, async (req, res) => {
  try {
    const { token } = req.query
    if (!token) {
      return res.send('<h2>Invalid verification link.</h2>')
    }
    const user = await db.collection('users').findOne({ verificationToken: token })
    if (!user) {
      return res.send('<h2>Invalid or expired verification link.</h2>')
    }
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { verified: true }, $unset: { verificationToken: '' } }
    )
    res.send('<h2>Email verified! You can now log in.</h2>')
  } catch (e) {
    res.send(`<h2>Verification failed: ${e.message}</h2>`)
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
        req.path.startsWith('/verify-email') || req.path.startsWith('/fetch_tasks') ||
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
