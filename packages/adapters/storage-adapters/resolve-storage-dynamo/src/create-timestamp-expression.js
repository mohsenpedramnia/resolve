const createTimestampExpression = ({
  startTime,
  finishTime,
  closedInterval = false
}) => {
  const ltOp = closedInterval ? '<=' : '<'
  const gtOp = closedInterval ? '>=' : '>'

  const conditionExpression =
    startTime && finishTime
      ? `((#timestamp ${gtOp} :startTime) AND (#timestamp ${ltOp} :finishTime))`
      : startTime
      ? `(#timestamp ${gtOp} :startTime)`
      : finishTime
      ? `(#timestamp ${ltOp} :finishTime)`
      : ''

  const attributeNames =
    startTime || finishTime
      ? {
          '#timestamp': 'timestamp'
        }
      : {}

  const attributeValues =
    startTime && finishTime
      ? {
          ':startTime': startTime,
          ':finishTime': finishTime
        }
      : startTime
      ? {
          ':startTime': startTime
        }
      : finishTime
      ? {
          ':finishTime': finishTime
        }
      : {}

  return {
    conditionExpression,
    attributeNames,
    attributeValues
  }
}

export default createTimestampExpression
