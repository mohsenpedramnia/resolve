import { declareRuntimeEnv } from 'resolve-scripts'

export default {
  target: 'cloud',
  mode: 'production',
  staticPath: declareRuntimeEnv('RESOLVE_CLOUD_STATIC_URL'),
  subscribeAdapter: {
    module: 'resolve-subscribe-mqtt',
    options: {}
  },
  storageAdapter: {
    module: 'resolve-storage-dynamo',
    options: {
      tableName: declareRuntimeEnv('RESOLVE_EVENT_STORE_TABLE'),
      skipInit: true
    }
  }
}
