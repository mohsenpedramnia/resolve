import { message } from '../constants'

export default ({ resolveConfig, isClient }) => {
  if (isClient) {
    throw new Error(
      `${message.serverAliasInClientCodeError}$resolve.eventBroker`
    )
  }

  if (resolveConfig.target !== 'local') {
    throw new Error('Event broker can be build only in "local" mode')
  }

  return {
    code: `
      import createStorageAdapter from '$resolve.storageAdapter'
      import eventBrokerConfig from '$resolve.eventBroker'
      import createLocalBusBroker from 'resolve-local-event-broker'

      Promise.resolve().then(() => {
        const storageAdapter = createStorageAdapter()

        const localBusBroker = createLocalBusBroker({
          ...eventBrokerConfig,
          storageAdapter
        })

        localBusBroker.run()
      })
    `
  }
}
