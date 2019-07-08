const connect = async (pool, MongoClient) => {
  let { url, tableName, ...connectionOptions } = pool.config

  if (tableName != null && tableName.constructor !== String) {
    throw new Error(
      'Option "tableName" for "resolve-storage-mongo" adapter configuration should be string'
    )
  } else if (tableName == null) {
    tableName = 'Events'
  }

  const client = await MongoClient.connect(url, {
    ...connectionOptions,
    useNewUrlParser: true
  })
  const database = await client.db()
  const collection = await database.collection(tableName)

  Object.assign(pool, {
    client,
    database,
    collection
  })
}

export default connect
