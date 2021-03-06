import { EOL } from 'os'
import debugLevels from 'resolve-debug-levels'

const log = debugLevels('resolve:resolve-query:wrap-read-model')

const RESERVED_TIME = 30 * 1000
const TIMEOUT_SYMBOL = Symbol('TIMEOUT_SYMBOL')

const wrapConnection = async (pool, callback) => {
  const readModelName = pool.readModel.name

  const connection = await (async () => {
    const segment = pool.performanceTracer
      ? pool.performanceTracer.getSegment()
      : null
    const subSegment = segment ? segment.addNewSubsegment('connect') : null

    if (subSegment != null) {
      subSegment.addAnnotation('readModelName', readModelName)
      subSegment.addAnnotation('origin', 'resolve:query:connect')
    }

    try {
      return await pool.connector.connect(pool.readModel.name)
    } catch (error) {
      if (subSegment != null) {
        subSegment.addError(error)
      }
      throw error
    } finally {
      if (subSegment != null) {
        subSegment.close()
      }
    }
  })()

  pool.connections.add(connection)

  try {
    return await callback(connection)
  } finally {
    await (async () => {
      const segment = pool.performanceTracer
        ? pool.performanceTracer.getSegment()
        : null
      const subSegment = segment ? segment.addNewSubsegment('disconnect') : null

      if (subSegment != null) {
        subSegment.addAnnotation('readModelName', readModelName)
        subSegment.addAnnotation('origin', 'resolve:query:disconnect')
      }

      try {
        await pool.connector.disconnect(connection, pool.readModel.name)

        pool.connections.delete(connection)
      } catch (error) {
        if (subSegment != null) {
          subSegment.addError(error)
        }
        throw error
      } finally {
        if (subSegment != null) {
          subSegment.close()
        }
      }
    })()
  }
}

const read = async (pool, resolverName, resolverArgs, jwtToken) => {
  const segment = pool.performanceTracer
    ? pool.performanceTracer.getSegment()
    : null
  const subSegment = segment ? segment.addNewSubsegment('read') : null

  const readModelName = pool.readModel.name

  if (subSegment != null) {
    subSegment.addAnnotation('readModelName', readModelName)
    subSegment.addAnnotation('resolverName', resolverName)
    subSegment.addAnnotation('origin', 'resolve:query:read')
  }

  try {
    if (pool.isDisposed) {
      throw new Error(`Read model "${pool.readModel.name}" is disposed`)
    }
    if (typeof pool.readModel.resolvers[resolverName] !== 'function') {
      const error = new Error(`Resolver "${resolverName}" does not exist`)
      error.code = 422
      throw error
    }

    return await wrapConnection(pool, async connection => {
      const segment = pool.performanceTracer
        ? pool.performanceTracer.getSegment()
        : null
      const subSegment = segment ? segment.addNewSubsegment('resolver') : null

      if (subSegment != null) {
        subSegment.addAnnotation('readModelName', readModelName)
        subSegment.addAnnotation('resolverName', resolverName)
        subSegment.addAnnotation('origin', 'resolve:query:resolver')
      }

      try {
        return await pool.readModel.resolvers[resolverName](
          connection,
          resolverArgs,
          jwtToken
        )
      } catch (error) {
        if (subSegment != null) {
          subSegment.addError(error)
        }
        throw error
      } finally {
        if (subSegment != null) {
          subSegment.close()
        }
      }
    })
  } catch (error) {
    if (subSegment != null) {
      subSegment.addError(error)
    }
    throw error
  } finally {
    if (subSegment != null) {
      subSegment.close()
    }
  }
}

const updateByEvents = async (pool, events, getRemainingTimeInMillis) => {
  const segment = pool.performanceTracer
    ? pool.performanceTracer.getSegment()
    : null
  const subSegment = segment ? segment.addNewSubsegment('updateByEvents') : null

  try {
    const readModelName = pool.readModel.name

    if (subSegment != null) {
      subSegment.addAnnotation('readModelName', readModelName)
      subSegment.addAnnotation('eventCount', events.length)
      subSegment.addAnnotation('origin', 'resolve:query:updateByEvents')
    }

    if (pool.isDisposed) {
      throw new Error(`Read model "${pool.readModel.name}" is disposed`)
    }

    const projection = pool.readModel.projection

    if (projection == null) {
      throw new Error(
        `Updating by events is prohibited when "${pool.readModel.name}" projection is not specified`
      )
    }

    let lastError = null
    let lastEvent = null

    const handler = async (connection, event) => {
      const segment = pool.performanceTracer
        ? pool.performanceTracer.getSegment()
        : null
      const subSegment = segment ? segment.addNewSubsegment('applyEvent') : null

      try {
        if (pool.isDisposed) {
          throw new Error(
            `Read model "${readModelName}" updating had been interrupted`
          )
        }

        if (subSegment != null) {
          subSegment.addAnnotation('readModelName', readModelName)
          subSegment.addAnnotation('eventType', event.type)
          subSegment.addAnnotation('origin', 'resolve:query:applyEvent')
        }

        if (event != null && typeof projection[event.type] === 'function') {
          const executor = projection[event.type]
          await executor(connection, event)
          lastEvent = event
        }
      } catch (error) {
        if (subSegment != null) {
          subSegment.addError(error)
        }
        throw error
      } finally {
        if (subSegment != null) {
          subSegment.close()
        }
      }
    }

    await wrapConnection(pool, async connection => {
      try {
        log.verbose(
          `Applying ${events.length} events to read-model "${readModelName}" started`
        )

        for (const event of events) {
          const remainingTime = getRemainingTimeInMillis() - RESERVED_TIME
          log.verbose(
            `Remaining time for feeding read-model "${readModelName}" is ${remainingTime} ms`
          )

          if (remainingTime < 0) {
            log.verbose(
              `Stop applying events to read-model "${readModelName}" via timeout`
            )
            break
          }

          if (event.type === 'Init') {
            try {
              log.verbose(
                `Applying "Init" event to read-model "${readModelName}" started`
              )
              await handler(connection, event)
              log.verbose(
                `Applying "Init" event to read-model "${readModelName}" succeed`
              )
              continue
            } catch (error) {
              log.verbose(
                `Applying "Init" event to read-model "${readModelName}" failed`,
                error
              )
              throw error
            }
          }

          let timer = null
          try {
            log.verbose(
              `Applying "${event.type}" event to read-model "${readModelName}" started`
            )
            if (typeof pool.connector.beginTransaction === 'function') {
              await pool.connector.beginTransaction(
                connection,
                pool.readModel.name
              )
            }

            await Promise.race([
              new Promise((_, reject) => {
                timer = setTimeout(
                  reject.bind(null, TIMEOUT_SYMBOL),
                  remainingTime
                )
              }),
              handler(connection, event)
            ])

            if (typeof pool.connector.commitTransaction === 'function') {
              await pool.connector.commitTransaction(
                connection,
                pool.readModel.name
              )
            }

            log.verbose(
              `Applying "${event.type}" event to read-model "${readModelName}" succeed`
            )
          } catch (readModelError) {
            log.verbose(
              `Applying "${event.type}" event to read-model "${readModelName}" failed`,
              readModelError
            )
            let rollbackError = null
            if (typeof pool.connector.rollbackTransaction === 'function') {
              try {
                await pool.connector.rollbackTransaction(
                  connection,
                  pool.readModel.name
                )
              } catch (error) {
                rollbackError = error
              }
            }

            const summaryError = new Error()
            summaryError.message = readModelError.message
            summaryError.stack = readModelError.stack

            if (rollbackError != null) {
              summaryError.message = `${summaryError.message}${EOL}${rollbackError.message}`
              summaryError.stack = `${summaryError.stack}${EOL}${rollbackError.stack}`
            }

            if (readModelError === TIMEOUT_SYMBOL && rollbackError == null) {
              log.verbose(
                `Ignoring error for feeding read-model "${readModelName}" via timeout`
              )
              break
            } else {
              log.verbose(
                `Throwing error for feeding read-model "${readModelName}"`,
                summaryError
              )
              throw summaryError
            }
          } finally {
            clearTimeout(timer)
          }
        }
      } catch (error) {
        lastError = Object.create(Error.prototype, {
          message: { value: error.message, enumerable: true },
          stack: { value: error.stack, enumerable: true }
        })
      }
    })

    const result = {
      listenerId: pool.readModel.name,
      lastError,
      lastEvent
    }

    if (lastError != null) {
      throw result
    } else {
      return result
    }
  } catch (error) {
    if (subSegment != null) {
      subSegment.addError(error)
    }
    throw error
  } finally {
    if (subSegment != null) {
      subSegment.close()
    }
  }
}

const readAndSerialize = async (pool, resolverName, resolverArgs, jwtToken) => {
  const readModelName = pool.readModel.name

  if (pool.isDisposed) {
    throw new Error(`Read model "${readModelName}" is disposed`)
  }

  const result = await read(pool, resolverName, resolverArgs, jwtToken)

  return JSON.stringify(result, null, 2)
}

const drop = async pool => {
  const segment = pool.performanceTracer
    ? pool.performanceTracer.getSegment()
    : null
  const subSegment = segment ? segment.addNewSubsegment('drop') : null

  const readModelName = pool.readModel.name

  if (subSegment != null) {
    subSegment.addAnnotation('readModelName', readModelName)
    subSegment.addAnnotation('origin', 'resolve:query:drop')
  }

  try {
    if (pool.isDisposed) {
      throw new Error(`Read model "${readModelName}" is disposed`)
    }

    await wrapConnection(pool, async connection => {
      await pool.connector.drop(connection, pool.readModel.name)
    })
  } catch (error) {
    if (subSegment != null) {
      subSegment.addError(error)
    }
    throw error
  } finally {
    if (subSegment != null) {
      subSegment.close()
    }
  }
}

const dispose = async pool => {
  const segment = pool.performanceTracer
    ? pool.performanceTracer.getSegment()
    : null
  const subSegment = segment ? segment.addNewSubsegment('dispose') : null

  const readModelName = pool.readModel.name

  if (subSegment != null) {
    subSegment.addAnnotation('readModelName', readModelName)
    subSegment.addAnnotation('origin', 'resolve:query:dispose')
  }

  try {
    if (pool.isDisposed) {
      throw new Error(`Read model "${pool.readModel.name}" is disposed`)
    }
    pool.isDisposed = true

    const promises = []
    for (const connection of pool.connections) {
      promises.push(pool.connector.disconnect(connection, pool.readModel.name))
    }
    await Promise.all(promises)
  } catch (error) {
    if (subSegment != null) {
      subSegment.addError(error)
    }
    throw error
  } finally {
    if (subSegment != null) {
      subSegment.close()
    }
  }
}

const wrapReadModel = (readModel, readModelConnectors, performanceTracer) => {
  const connector = readModelConnectors[readModel.connectorName]
  if (connector == null) {
    throw new Error(
      `Connector "${readModel.connectorName}" for read-model "${readModel.name}" does not exist`
    )
  }

  const pool = {
    connections: new Set(),
    readModel,
    connector,
    isDisposed: false,
    performanceTracer
  }

  return Object.freeze({
    read: read.bind(null, pool),
    readAndSerialize: readAndSerialize.bind(null, pool),
    updateByEvents: updateByEvents.bind(null, pool),
    drop: drop.bind(null, pool),
    dispose: dispose.bind(null, pool)
  })
}

export default wrapReadModel
