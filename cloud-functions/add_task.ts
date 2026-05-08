import cloud from '@lafjs/cloud'

export default async function (ctx: FunctionContext) {
  const db = cloud.mongo.db
  const { value, isCompleted = false } = ctx.body

  if (!value) {
    return { code: 1, error: 'value is required' }
  }

  try {
    const _id = Date.now().toString(16) + Math.random().toString(16).slice(2, 14)
    const task = { _id, value, isCompleted }
    await db.collection('tasks').insertOne(task)
    return {
      code: 0,
      data: { id: _id, value, isCompleted },
    }
  } catch (e) {
    console.error('添加任务失败:', e)
    return { code: 1, error: e.message }
  }
}
