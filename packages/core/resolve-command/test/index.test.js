import sinon from 'sinon'

import createEventStoreAdapter from 'resolve-eventstore-lite'
import createCommandExecutor from '../src'
import { CommandError } from '../src'

describe('resolve-command', () => {
  const AGGREGATE_ID = 'aggregateId'
  const AGGREGATE_NAME = 'aggregateName'
  const brokenStateError = new Error('Broken Error')

  let lastState, eventStoreAdapter, aggregateVersion, aggregates

  const initEvents = async events => {
    for (const rawEvent of events) {
      const event = Object.create(rawEvent)
      if (
        !rawEvent.hasOwnProperty('aggregateVersion') ||
        !rawEvent.hasOwnProperty('type')
      ) {
        throw new Error('Fatal test error')
      }

      if (!rawEvent.hasOwnProperty('aggregateId')) {
        event.aggregateId = 'aggregateId'
      }
      if (!rawEvent.hasOwnProperty('timestamp')) {
        event.timestamp = 1000
      }

      await eventStoreAdapter.saveEvent(event)
    }
  }

  beforeEach(() => {
    aggregates = [
      {
        name: AGGREGATE_NAME,
        projection: {
          Init: state => {
            lastState = state
            return state
          },
          SuccessEvent: state => {
            lastState = { ...state, value: 42 }
            return lastState
          },
          BrokenEvent: state => {
            lastState = state
            throw brokenStateError
          }
        },
        commands: {
          emptyCommand: (aggregateState, command, jwtToken, version) => {
            aggregateVersion = version
            return {
              type: 'EmptyEvent',
              payload: {}
            }
          },
          brokenCommand: () => ({
            type: '', //broken type
            payload: {}
          })
        }
      }
    ]

    eventStoreAdapter = createEventStoreAdapter({ databaseFile: ':memory:' })
  })

  afterEach(() => {
    aggregateVersion = null
    aggregates = null
    lastState = null
    eventStoreAdapter = null
  })

  it('should success build aggregate state from empty event list and execute cmd', async () => {
    const executeCommand = createCommandExecutor({
      eventStoreAdapter,
      aggregates
    })

    const event = await executeCommand({
      aggregateName: AGGREGATE_NAME,
      aggregateId: AGGREGATE_ID,
      type: 'emptyCommand'
    })

    expect(event.aggregateVersion).toEqual(1)
    expect(aggregateVersion).toEqual(0)
  })

  it('should success build aggregate state and execute command', async () => {
    await initEvents([{ type: 'SuccessEvent', aggregateVersion: 1 }])

    const executeCommand = createCommandExecutor({
      eventStoreAdapter,
      aggregates
    })

    const event = await executeCommand({
      aggregateName: AGGREGATE_NAME,
      aggregateId: AGGREGATE_ID,
      type: 'emptyCommand'
    })

    expect(event.aggregateVersion).toEqual(2)
    expect(aggregateVersion).toEqual(1)
    expect(lastState).toEqual({
      value: 42
    })
  })

  it('should handle rejection on case of failure on building aggregate state', async () => {
    await initEvents([{ type: 'BrokenEvent', aggregateVersion: 1 }])

    const executeCommand = createCommandExecutor({
      eventStoreAdapter,
      aggregates
    })

    try {
      await executeCommand({
        aggregateName: AGGREGATE_NAME,
        aggregateId: AGGREGATE_ID,
        type: 'emptyCommand'
      })

      return Promise.reject('Test failed')
    } catch (error) {
      expect(error).toEqual(brokenStateError)
    }
  })

  it('should use initialState on case of empty state', async () => {
    const aggregate = { ...aggregates[0] }

    const executeCommand = createCommandExecutor({
      eventStoreAdapter,
      aggregates: [aggregate]
    })

    await executeCommand({
      aggregateName: AGGREGATE_NAME,
      aggregateId: AGGREGATE_ID,
      type: 'emptyCommand'
    })

    expect(lastState).toEqual(aggregate.projection.Init())
  })

  it('should reject event with type absence', async () => {
    await initEvents([{ type: 'SuccessEvent', aggregateVersion: 1 }])

    const executeCommand = createCommandExecutor({
      eventStoreAdapter,
      aggregates
    })

    try {
      await executeCommand({
        aggregateName: AGGREGATE_NAME,
        aggregateId: AGGREGATE_ID,
        type: 'brokenCommand'
      })

      return Promise.reject('Test failed')
    } catch (error) {
      expect(error.message).toEqual('event type is required')
    }
  })

  it('should reject command with aggregateId absence', async () => {
    const executeCommand = createCommandExecutor({
      eventStoreAdapter,
      aggregates
    })

    try {
      await executeCommand({
        aggregateName: AGGREGATE_NAME,
        aggregateId: null,
        type: 'brokenCommand'
      })
      return Promise.reject('Test failed')
    } catch (error) {
      expect(error.message).toEqual('The "aggregateId" argument is required')
    }
  })

  it('should reject command with aggregateName absence', async () => {
    const executeCommand = createCommandExecutor({
      eventStoreAdapter,
      aggregates
    })

    try {
      await executeCommand({
        aggregateName: null,
        aggregateId: AGGREGATE_ID,
        type: 'brokenCommand'
      })
      return Promise.reject('Test failed')
    } catch (error) {
      expect(error.message).toEqual('The "aggregateName" argument is required')
    }
  })

  it('should reject command with type absence', async () => {
    const executeCommand = createCommandExecutor({
      eventStoreAdapter,
      aggregates
    })

    try {
      await executeCommand({
        aggregateName: AGGREGATE_NAME,
        aggregateId: AGGREGATE_ID,
        type: null
      })
      return Promise.reject('Test failed')
    } catch (error) {
      expect(error.message).toEqual('The "type" argument is required')
    }
  })

  it('should pass security context to command handler', async () => {
    await initEvents([{ type: 'SuccessEvent', aggregateVersion: 1 }])

    const aggregate = aggregates.find(
      aggregate => aggregate.name === AGGREGATE_NAME
    )
    aggregate.commands.emptyCommand = sinon
      .stub()
      .callsFake(aggregate.commands.emptyCommand)

    const executeCommand = createCommandExecutor({
      eventStoreAdapter,
      aggregates
    })

    const jwtToken = 'JWT-TOKEN'
    await executeCommand({
      aggregateName: AGGREGATE_NAME,
      aggregateId: AGGREGATE_ID,
      type: 'emptyCommand',
      jwtToken
    })

    expect(aggregate.commands.emptyCommand.lastCall.args[2]).toEqual(jwtToken)

    expect(lastState).toEqual({
      value: 42
    })
  })

  it('Regression test. Invalid aggregate version in event storage by aggregateId', async () => {
    await initEvents([
      {
        aggregateId: AGGREGATE_ID,
        aggregateVersion: 1,
        type: 'EventType',
        timestamp: 1
      },
      {
        aggregateId: AGGREGATE_ID,
        aggregateVersion: 2,
        type: 'EventType',
        timestamp: 3
      },
      {
        aggregateId: AGGREGATE_ID,
        aggregateVersion: 3,
        type: 'EventType',
        timestamp: 2
      }
    ])

    const executeCommand = createCommandExecutor({
      eventStoreAdapter,
      aggregates
    })

    const jwtToken = 'JWT-TOKEN'
    try {
      await executeCommand({
        aggregateName: AGGREGATE_NAME,
        aggregateId: AGGREGATE_ID,
        type: 'emptyCommand',
        jwtToken
      })

      return Promise.reject('Test failed')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toEqual(
        'Invalid aggregate version in event storage by aggregateId = aggregateId'
      )
    }
  })

  it('Regression test. Incorrect command type', async () => {
    const executeCommand = createCommandExecutor({
      eventStoreAdapter,
      aggregates
    })

    const jwtToken = 'JWT-TOKEN'
    try {
      await executeCommand({
        aggregateName: AGGREGATE_NAME,
        aggregateId: AGGREGATE_ID,
        type: 'unknownCommand',
        jwtToken
      })

      return Promise.reject('Test failed')
    } catch (error) {
      expect(error).toBeInstanceOf(CommandError)
    }
  })
})
