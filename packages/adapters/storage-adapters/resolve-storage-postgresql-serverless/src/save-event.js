import { ConcurrentError } from 'resolve-storage-base'

import { RESERVED_EVENT_SIZE, LONG_NUMBER_SQL_TYPE } from './constants'

const isThreadIdNullRegExp = /null value in column "threadId"/i

const saveEvent = async (
  { databaseName, tableName, executeStatement, escapeId, escape },
  event
) => {
  while (true) {
    try {
      const serializedEvent = [
        `${escape(event.aggregateId)},`,
        `${+event.aggregateVersion},`,
        `${escape(event.type)},`,
        escape(JSON.stringify(event.payload != null ? event.payload : null))
      ].join('')

      // TODO: Improve calculation byteLength depend on codepage and wide-characters
      const byteLength =
        Buffer.byteLength(serializedEvent) + RESERVED_EVENT_SIZE

      await executeStatement(
        `WITH ${escapeId('freeze_check')} AS (
        SELECT 0 AS ${escapeId('lastEventId')},
        0 AS ${escapeId('lastTimestamp')} WHERE (
          (SELECT ${escape('Event store is frozen')} AS ${escapeId(
          'EventStoreIsFrozen'
        )})
        UNION ALL
          (SELECT ${escape('Event store is frozen')} AS ${escapeId(
          'EventStoreIsFrozen'
        )}
          FROM ${escapeId('information_schema')}.${escapeId('tables')}
          WHERE ${escapeId('table_schema')} = ${escape(databaseName)}
          AND ${escapeId('table_name')} = ${escape(`${tableName}-freeze`)})
        ) = ${escape('OK')}
      ), ${escapeId('vector_id')} AS (
        SELECT SL.${escapeId('threadId')}, SL.${escapeId('threadCounter')}
        FROM ${escapeId(databaseName)}.${escapeId(`${tableName}-threads`)} SL
        WHERE SL.${escapeId('threadId')} = COALESCE(
          (SELECT ${escapeId('threadId')} FROM ${escapeId(
          databaseName
        )}.${escapeId(`${tableName}-threads`)}
          FOR UPDATE SKIP LOCKED LIMIT 1),
          (SELECT FLOOR(Random() * 256) AS ${escapeId('threadId')})
        ) FOR UPDATE LIMIT 1),
        ${escapeId('update_vector_id')} AS (
          UPDATE ${escapeId(databaseName)}.${escapeId(
          `${tableName}-threads`
        )} ST
          SET ${escapeId('threadCounter')} = ST.${escapeId('threadCounter')} + 1
          WHERE ST.${escapeId('threadId')} = (
            SELECT ${escapeId('threadId')} FROM ${escapeId('vector_id')} LIMIT 1
          )
          RETURNING ST.*
        )
       INSERT INTO ${escapeId(databaseName)}.${escapeId(tableName)}(
        ${escapeId('threadId')},
        ${escapeId('threadCounter')},
        ${escapeId('timestamp')},
        ${escapeId('aggregateId')},
        ${escapeId('aggregateVersion')},
        ${escapeId('type')},
        ${escapeId('payload')},
        ${escapeId('eventSize')}
      ) VALUES (
        (SELECT VI.${escapeId('threadId')} FROM ${escapeId(
          'vector_id'
        )} VI LIMIT 1),
        (SELECT VI.${escapeId('threadCounter')} FROM ${escapeId(
          'vector_id'
        )} VI LIMIT 1),
        CAST(extract(epoch from now()) * 1000 AS ${LONG_NUMBER_SQL_TYPE}), 
        ${serializedEvent},
        ${byteLength}
      )`
      )

      break
    } catch (error) {
      const errorMessage =
        error != null && error.message != null ? error.message : ''

      if (errorMessage.indexOf('subquery used as an expression') > -1) {
        throw new Error('Event store is frozen')
      } else if (
        errorMessage.indexOf('duplicate key') > -1 &&
        errorMessage.indexOf('aggregateIdAndVersion') > -1
      ) {
        throw new ConcurrentError(event.aggregateId)
      } else if (isThreadIdNullRegExp.test(error)) {
        continue
      } else {
        throw error
      }
    }
  }
}

export default saveEvent
