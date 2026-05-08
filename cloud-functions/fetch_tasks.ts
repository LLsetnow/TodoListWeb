import cloud from '@lafjs/cloud'

export default async function (ctx: FunctionContext) {
  const db = cloud.mongo.db

  try {
    const tasks = await db.collection('tasks').find().toArray()
    return tasks.map(t => ({
      id: t._id,
      value: t.value,
      isCompleted: t.isCompleted || false,
    }))
  } catch (e) {
    console.error('获取任务失败:', e)
    return { code: 1, error: e.message }
  }
}
