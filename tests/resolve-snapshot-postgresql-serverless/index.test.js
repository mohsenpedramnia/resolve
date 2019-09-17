import createSnapshotAdapter from 'resolve-snapshot-postgresql-serverless'
import uuid from 'uuid/v4'

const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  RESOLVE_SNAPSHOT_SECRET_STORE_ARN,
  RESOLVE_SNAPSHOT_DATABASE_CLUSTER_ARN,
  RESOLVE_SNAPSHOT_DATABASE_NAME
} = process.env

jest.setTimeout(1000 * 60 * 15)

describe('snapshot adapter', () => {
  test('method "saveSnapshot" and "loadSnapshot" works correctly', async () => {
    const bucketSize = Math.ceil(Math.random() * 10)

    const snapshotAdapter = createSnapshotAdapter({
      awsSecretStoreArn: RESOLVE_SNAPSHOT_SECRET_STORE_ARN,
      dbClusterOrInstanceArn: RESOLVE_SNAPSHOT_DATABASE_CLUSTER_ARN,
      databaseName: RESOLVE_SNAPSHOT_DATABASE_NAME,
      tableName: 'snapshots',
      region: 'us-east-1',
      bucketSize,
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY
    })

    const key = uuid()
    const value = uuid()

    for (let eventIndex = 0; eventIndex <= bucketSize; eventIndex++) {
      await snapshotAdapter.saveSnapshot(key, value)
    }

    expect(await snapshotAdapter.loadSnapshot(key)).toEqual(value)
  })
})
