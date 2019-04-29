const getLatestEvent = async (
  { connection, escapeId, escape, tableName },
  { eventTypes, aggregateIds, startTime, finishTime, closedInterval = false }
) => {
  const injectString = value => `${escape(value)}`
  const injectNumber = value => `${+value}`
  const ltOp = closedInterval ? '<=' : '<'
  const gtOp = closedInterval ? '>=' : '>'

  const queryConditions = []
  if (eventTypes != null) {
    queryConditions.push(`\`type\` IN (${eventTypes.map(injectString)})`)
  }
  if (aggregateIds != null) {
    queryConditions.push(
      `\`aggregateId\` IN (${aggregateIds.map(injectString)})`
    )
  }
  if (startTime != null) {
    queryConditions.push(`\`timestamp\` ${gtOp} ${injectNumber(startTime)}`)
  }
  if (finishTime != null) {
    queryConditions.push(`\`timestamp\` ${ltOp} ${injectNumber(finishTime)}`)
  }

  const resultQueryCondition =
    queryConditions.length > 0 ? `WHERE ${queryConditions.join(' AND ')}` : ''

  const [rows] = await connection.query(
    `SELECT * FROM ${escapeId(tableName)} ${resultQueryCondition}
    ORDER BY \`timestamp\` DESC, \`aggregateVersion\` DESC`
  )

  const event =
    rows.length > 0 ? Object.setPrototypeOf(rows[0], Object.prototype) : null

  return event
}

export default getLatestEvent
