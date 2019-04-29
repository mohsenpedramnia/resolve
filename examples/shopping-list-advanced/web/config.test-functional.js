const testFunctionalConfig = {
  target: 'local',
  port: 3000,
  polyfills: ['@babel/polyfill'],
  mode: 'development',
  readModelConnectors: {
    default: {
      module: 'resolve-readmodel-lite',
      options: {
        databaseFile: 'read-models-test-functional.db'
      }
    }
  },
  eventStoreAdapter: {
    module: 'resolve-eventstore-lite',
    options: {
      databaseFile: 'event-store-test-functional.db'
    }
  },
  eventBroker: {
    databaseFile: 'local-bus-broker-test-functional.db'
  }
}

module.exports = testFunctionalConfig
