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
      import createEventStoreAdapter from '$resolve.eventStoreAdapter'
      import eventBrokerConfig from '$resolve.eventBroker'
      import createLocalBusBroker from 'resolve-local-event-broker'

      Promise.resolve().then(() => {
        const eventStoreAdapter = createEventStoreAdapter()

        const localBusBroker = createLocalBusBroker({
          ...eventBrokerConfig,
          eventStoreAdapter
        })

        localBusBroker.run()
      })
    `
  }
}
