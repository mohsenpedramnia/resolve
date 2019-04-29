import createCommandExecutor from 'resolve-command'
import createQueryExecutor from 'resolve-query'

const initResolve = async resolve => {
  const {
    eventStoreAdapter: createEventStoreAdapter,
    snapshotAdapter: createSnapshotAdapter,
    readModelConnectors: readModelConnectorsCreators
  } = resolve.assemblies

  const baseStorageAdapter = createEventStoreAdapter()
  const eventStoreAdapter = Object.create(baseStorageAdapter, {
    saveEvent: {
      value: async event => {
        await baseStorageAdapter.saveEvent(event)
        await resolve.publishEvent(event)
      }
    }
  })

  resolve.readModels = resolve.readModels.slice(0)
  for (let index = 0; index < resolve.readModels.length; index++) {
    resolve.readModels[index] = Object.create(resolve.readModels[index], {
      executeCommand: { get: () => resolve.executeCommand, enumerable: true },
      executeQuery: { get: () => resolve.executeQuery, enumerable: true }
    })
  }

  const { aggregates, readModels, viewModels } = resolve
  const snapshotAdapter = createSnapshotAdapter()

  const readModelConnectors = {}
  for (const name of Object.keys(readModelConnectorsCreators)) {
    readModelConnectors[name] = readModelConnectorsCreators[name]()
  }

  const executeCommand = createCommandExecutor({
    eventStoreAdapter,
    aggregates,
    snapshotAdapter
  })

  const executeQuery = createQueryExecutor({
    eventStoreAdapter,
    readModelConnectors,
    snapshotAdapter,
    doUpdateRequest: resolve.doUpdateRequest,
    readModels,
    viewModels
  })

  Object.assign(resolve, {
    executeCommand,
    executeQuery
  })

  Object.defineProperties(resolve, {
    readModelConnectors: { value: readModelConnectors },
    snapshotAdapter: { value: snapshotAdapter },
    eventStoreAdapter: { value: eventStoreAdapter }
  })
}

export default initResolve
