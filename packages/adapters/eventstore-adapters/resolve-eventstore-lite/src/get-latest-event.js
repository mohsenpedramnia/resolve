const getLatestEvent = async (
  { database, tableName, escapeId, escape },
  { eventTypes, aggregateIds, startTime, finishTime, closedInterval = false }
) => {
  const injectString = value => `${escape(value)}`
  const injectNumber = value => `${+value}`
  const ltOp = closedInterval ? '<=' : '<'
  const gtOp = closedInterval ? '>=' : '>'

  const queryConditions = []
  if (eventTypes != null) {
    queryConditions.push(
      `${escapeId('type')} IN (${eventTypes.map(injectString)})`
    )
  }
  if (aggregateIds != null) {
    queryConditions.push(
      `${escapeId('aggregateId')} IN (${aggregateIds.map(injectString)})`
    )
  }
  if (startTime != null) {
    queryConditions.push(
      `${escapeId('timestamp')} ${gtOp} ${injectNumber(startTime)}`
    )
  }
  if (finishTime != null) {
    queryConditions.push(
      `${escapeId('timestamp')} ${ltOp} ${injectNumber(finishTime)}`
    )
  }

  const resultQueryCondition =
    queryConditions.length > 0 ? `WHERE ${queryConditions.join(' AND ')}` : ''

  const rows = await database.all(
    `SELECT * FROM ${escapeId(tableName)} ${resultQueryCondition}
    ORDER BY ${escapeId('timestamp')} ASC,
    ${escapeId('aggregateVersion')} ASC
    LIMIT 0, 1`
  )

  return rows.length > 0 ? rows[0] : null
}

export default getLatestEvent
