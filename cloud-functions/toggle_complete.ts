import cloud from '@lafjs/cloud'

export default async function (ctx: FunctionContext) {
  const db = cloud.mongo.db
  const id = ctx.query?.id || ctx.params?.id
  const body = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body
  const { isCompleted } = body || {}

  if (!id) {
    return { code: 1, error: 'id is required' }
  }

  try {
    await db.collection('tasks').updateOne(
      { _id: id },
      { $set: { isCompleted } }
    )
    return { code: 0 }
  } catch (e) {
    console.error('更新任务失败:', e)
    return { code: 1, error: e.message }
  }
}
