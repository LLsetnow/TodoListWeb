import express from 'express'
import { MongoClient } from 'mongodb'

const MONGO_URL = 'mongodb://root:0v024U15C03DApeF@test-db-mongodb.ns-27q1wqr8.svc:27017'
const DB_NAME = 'todo'

const app = express()
app.use(express.json())

let db

async function connectDB() {
  const client = new MongoClient(MONGO_URL, {
    serverSelectionTimeoutMS: 5000,
  })
  try {
    await client.connect()
    db = client.db(DB_NAME)
    console.log('MongoDB connected')
  } catch (e) {
    console.error('MongoDB 连接失败:', e.message)
  }
}

app.get('/fetch_tasks', async (_req, res) => {
  try {
    const tasks = await db.collection('tasks').find().toArray()
    res.json(tasks.map(t => ({
      id: t._id,
      value: t.value,
      isCompleted: t.isCompleted || false,
    })))
  } catch (e) {
    res.json({ code: 1, error: e.message })
  }
})

app.post('/add_task', async (req, res) => {
  try {
    const { value, isCompleted = false } = req.body
    if (!value) return res.json({ code: 1, error: 'value is required' })
    const _id = Date.now().toString(16) + Math.random().toString(16).slice(2, 14)
    await db.collection('tasks').insertOne({ _id, value, isCompleted })
    res.json({ code: 0, data: { id: _id, value, isCompleted } })
  } catch (e) {
    res.json({ code: 1, error: e.message })
  }
})

app.post('/delete_task', async (req, res) => {
  try {
    const { id } = req.query
    if (!id) return res.json({ code: 1, error: 'id is required' })
    await db.collection('tasks').deleteOne({ _id: id })
    res.json({ code: 0 })
  } catch (e) {
    res.json({ code: 1, error: e.message })
  }
})

app.post('/toggle_complete', async (req, res) => {
  try {
    const { id } = req.query
    const { isCompleted } = req.body
    if (!id) return res.json({ code: 1, error: 'id is required' })
    await db.collection('tasks').updateOne({ _id: id }, { $set: { isCompleted } })
    res.json({ code: 0 })
  } catch (e) {
    res.json({ code: 1, error: e.message })
  }
})

const PORT = 3000
connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
})
