import cloud from '@lafjs/cloud'

export default async function (ctx: FunctionContext) {
  const db = cloud.mongo.db
  const id = ctx.query?.id || ctx.params?.id

  if (!id) {
    return { code: 1, error: 'id is required' }
  }

  try {
    await db.collection('tasks').deleteOne({ _id: id })
    return { code: 0 }
  } catch (e) {
    console.error('删除任务失败:', e)
    return { code: 1, error: e.message }
  }
}
