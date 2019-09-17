import path from 'path'
import dotenv from 'dotenv'

module.exports = async () => {
  try {
    dotenv.config({ path: '/home/resolve/integration-tests.env' })
  } catch {}

  try {
    dotenv.config({ path: path.join(__dirname, '..', 'integration-tests.env') })
  } catch {}

  process.env.RESOLVE_SNAPSHOT_SECRET_STORE_ARN =
    'arn:aws:secretsmanager:us-east-1:650139044964:secret:postgres/abcd-d37Fac'
  process.env.RESOLVE_SNAPSHOT_DATABASE_CLUSTER_ARN =
    'arn:aws:rds:us-east-1:650139044964:cluster:postgresql-serverless'
  process.env.RESOLVE_SNAPSHOT_DATABASE_NAME = 'abcd'
}
