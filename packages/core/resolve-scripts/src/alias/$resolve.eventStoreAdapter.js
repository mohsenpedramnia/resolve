import {
  message,
  RESOURCE_CONSTRUCTOR_ONLY,
  RUNTIME_ENV_ANYWHERE,
  IMPORT_CONSTRUCTOR
} from '../constants'
import importResource from '../import_resource'

export default ({ resolveConfig, isClient }) => {
  if (isClient) {
    throw new Error(
      `${message.serverAliasInClientCodeError}$resolve.eventStoreAdapter`
    )
  }

  if (!resolveConfig.eventStoreAdapter) {
    throw new Error(`${message.configNotContainSectionError}.eventStoreAdapter`)
  }

  const imports = []
  const constants = []
  const exports = []

  importResource({
    resourceName: 'eventStoreAdapter',
    resourceValue: resolveConfig.eventStoreAdapter,
    runtimeMode: RUNTIME_ENV_ANYWHERE,
    importMode: RESOURCE_CONSTRUCTOR_ONLY,
    instanceMode: IMPORT_CONSTRUCTOR,
    imports,
    constants
  })

  exports.push('export default eventStoreAdapter')

  return {
    code: [...imports, ...constants, ...exports].join('\r\n')
  }
}
