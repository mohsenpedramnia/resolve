import { declareRuntimeEnv } from 'resolve-scripts'

const testFunctionalConfig = {
  target: 'local',
  port: declareRuntimeEnv('PORT', '3000'),
  polyfills: ['@babel/polyfill'],
  mode: 'development',
  storageAdapter: {
    module: 'resolve-storage-lite',
    options: {
      databaseFile: 'data/event-store-test-functional.db',
      tableName: 'Events'
    }
  },
  eventBroker: {
    launchBroker: false,
    databaseFile: 'data/local-bus-broker-test-functional.db'
  }
}

export default testFunctionalConfig
