const disconnect = async pool => {
  try {
    await pool.rdsDataService
      .executeStatement({
        resourceArn: pool.dbClusterOrInstanceArn,
        secretArn: pool.awsSecretStoreArn,
        database: 'postgres',
        continueAfterTimeout: false,
        includeResultMetadata: true,
        sql: `SELECT pg_terminate_backend(pg_backend_pid());`
      })
      .promise()
  } catch (error) {}
}

export default disconnect
