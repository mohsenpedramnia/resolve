import { declareRuntimeEnv } from 'resolve-scripts'

const devConfig = {
  target: 'local',
  port: declareRuntimeEnv('PORT', '3000'),
  polyfills: ['@babel/polyfill'],
  mode: 'development',
  eventBroker: {
    launchBroker: false,
    databaseFile: 'data/local-bus-broker.db'
  },
  storageAdapter: {
    module: 'resolve-storage-lite',
    options: {
      databaseFile: 'data/event-store.db',
      tableName: 'Events'
    }
  }
}

export default devConfig
