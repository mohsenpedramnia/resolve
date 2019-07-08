import os from 'os'

const connect = async (pool, sqlite) => {
  let { databaseFile, tableName, ...initOptions } = pool.config
  const escapeId = str => `"${String(str).replace(/(["])/gi, '$1$1')}"`
  const escape = str => `'${String(str).replace(/(['])/gi, '$1$1')}'`

  if (databaseFile == null || databaseFile.constructor !== String) {
    throw new Error(
      'Option "databaseFile" for "resolve-storage-lite" adapter configuration should be string'
    )
  }

  if (tableName != null && tableName.constructor !== String) {
    throw new Error(
      'Option "tableName" for "resolve-storage-lite" adapter configuration should be string'
    )
  } else if (tableName == null) {
    tableName = 'Events'
  }

  const database = await sqlite.open(databaseFile)
  await database.exec(`PRAGMA busy_timeout=1000000`)
  await database.exec(`PRAGMA encoding=${escape('UTF-8')}`)
  await database.exec(`PRAGMA synchronous=EXTRA`)
  if (os.platform() !== 'win32') {
    await database.exec(`PRAGMA journal_mode=WAL`)
  }

  Object.assign(pool, {
    database,
    initOptions,
    tableName,
    escapeId,
    escape
  })
}

export default connect
