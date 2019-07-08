const connect = async (pool, { MySQL, escapeId, escape }) => {
  let { tableName, ...connectionOptions } = pool.config

  if (tableName != null && tableName.constructor !== String) {
    throw new Error(
      'Option "tableName" for "resolve-storage-mysql" adapter configuration should be string'
    )
  } else if (tableName == null) {
    tableName = 'Events'
  }

  const connection = await MySQL.createConnection(connectionOptions)

  Object.assign(pool, {
    connection,
    tableName,
    escapeId,
    escape
  })
}

export default connect
