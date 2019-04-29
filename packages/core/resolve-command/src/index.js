export function CommandError(message = 'Command error') {
  Error.call(this)
  this.name = 'CommandError'
  this.message = message

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, CommandError)
  } else {
    this.stack = new Error().stack
  }
}

CommandError.prototype = Object.create(Error.prototype)

const isInteger = val =>
  val != null && val.constructor === Number && parseInt(val) === val
const isString = val => val != null && val.constructor === String

const verifyCommand = async ({ aggregateId, aggregateName, type }) => {
  if (!isString(aggregateId)) {
    throw new Error('The "aggregateId" argument is required')
  }
  if (!isString(aggregateName)) {
    throw new Error('The "aggregateName" argument is required')
  }
  if (!isString(type)) {
    throw new Error('The "type" argument is required')
  }
}

const verifyEvent = event => {
  if (!isString(event.type)) {
    throw new Error('The `type` field is invalid')
  }
  if (!isString(event.aggregateId)) {
    throw new Error('The `aggregateId` field is invalid')
  }
  if (!isInteger(event.aggregateVersion)) {
    throw new Error('The `aggregateVersion` field is invalid')
  }
  if (!isInteger(event.timestamp)) {
    throw new Error('The `timestamp` field is invalid')
  }

  event.aggregateId = String(event.aggregateId)
}

const getAggregateState = async (
  { projection, serializeState, deserializeState, invariantHash = null },
  aggregateId,
  storageAdapter,
  snapshotAdapter = null
) => {
  const snapshotKey =
    projection != null && projection.constructor === Object
      ? `${invariantHash};${aggregateId}`
      : null

  if (
    (invariantHash == null || invariantHash.constructor !== String) &&
    snapshotAdapter != null &&
    snapshotKey != null
  ) {
    throw new Error(
      `Field 'invariantHash' is mandatory when using aggregate snapshots`
    )
  }

  let aggregateState = null
  let aggregateVersion = 0
  let lastTimestamp = 0

  try {
    if (snapshotKey == null) throw new Error()
    const snapshot = await snapshotAdapter.loadSnapshot(snapshotKey)
    aggregateState = deserializeState(snapshot.state)
    aggregateVersion = snapshot.version
    lastTimestamp = snapshot.timestamp
  } catch (err) {}

  if (!(+lastTimestamp > 0) && projection != null) {
    aggregateState =
      typeof projection.Init === 'function' ? await projection.Init() : null
  }

  const regularHandler = async event => {
    if (aggregateVersion >= event.aggregateVersion) {
      throw new Error(
        `Invalid aggregate version in event storage by aggregateId = ${aggregateId}`
      )
    }
    aggregateVersion = event.aggregateVersion
    if (projection != null && typeof projection[event.type] === 'function') {
      aggregateState = await projection[event.type](aggregateState, event)
    }

    lastTimestamp = event.timestamp
  }

  const snapshotHandler = async event => {
    if (event.aggregateVersion <= aggregateVersion) {
      return
    }

    await regularHandler(event)

    await snapshotAdapter.saveSnapshot(snapshotKey, {
      state: serializeState(aggregateState),
      version: aggregateVersion,
      timestamp: lastTimestamp
    })
  }

  await storageAdapter.loadEvents(
    {
      aggregateIds: [aggregateId],
      startTime: lastTimestamp,
      closedInterval: true
    },
    snapshotAdapter != null && snapshotKey != null
      ? snapshotHandler
      : regularHandler
  )

  return { aggregateState, aggregateVersion, lastTimestamp }
}

const executeCommand = async (
  command,
  aggregate,
  storageAdapter,
  jwtToken,
  snapshotAdapter
) => {
  const { aggregateId, type } = command
  let {
    aggregateState,
    aggregateVersion,
    lastTimestamp
  } = await getAggregateState(
    aggregate,
    aggregateId,
    storageAdapter,
    snapshotAdapter
  )

  if (!aggregate.commands.hasOwnProperty(type)) {
    throw new CommandError(`command type ${type} does not exist`)
  }

  const handler = aggregate.commands[type]
  const event = await handler(
    aggregateState,
    command,
    jwtToken,
    aggregateVersion
  )

  if (!event.type) {
    throw new Error('event type is required')
  }

  event.aggregateId = aggregateId
  event.aggregateVersion = aggregateVersion + 1
  event.timestamp = Math.max(Date.now(), lastTimestamp)

  verifyEvent(event)

  return event
}

function createExecutor({ storageAdapter, aggregate, snapshotAdapter }) {
  return async (command, jwtToken) => {
    const event = await executeCommand(
      command,
      aggregate,
      storageAdapter,
      jwtToken,
      snapshotAdapter
    )

    await storageAdapter.saveEvent(event)

    return event
  }
}

export default ({ storageAdapter, aggregates, snapshotAdapter }) => {
  const executors = aggregates.reduce((result, aggregate) => {
    result[aggregate.name] = createExecutor({
      storageAdapter,
      aggregate,
      snapshotAdapter
    })
    return result
  }, {})

  const api = {
    executeCommand: async ({ jwtToken, ...command }) => {
      await verifyCommand(command)
      const aggregateName = command.aggregateName

      if (!executors.hasOwnProperty(aggregateName)) {
        throw new Error(`Aggregate ${aggregateName} does not exist`)
      }

      return executors[aggregateName](command, jwtToken)
    },
    dispose: async () => {
      // TODO
    }
  }

  const executeCommand = (...args) => api.executeCommand(...args)
  Object.assign(executeCommand, api)

  return executeCommand
}
