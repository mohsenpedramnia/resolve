const sortExpression = { timestamp: -1, aggregateVersion: -1 }
const projectionExpression = { _id: 0 }

const getLatestEvent = async (
  { collection },
  { eventTypes, aggregateIds, startTime, finishTime, closedInterval = false }
) => {
  const ltOp = closedInterval ? '$lte' : '$lt'
  const gtOp = closedInterval ? '$gte' : '$gt'

  const findExpression = {
    ...(eventTypes != null ? { type: { $in: eventTypes } } : {}),
    ...(aggregateIds != null ? { aggregateId: { $in: aggregateIds } } : {}),
    timestamp: {
      [gtOp]: startTime != null ? startTime : 0,
      [ltOp]: finishTime != null ? finishTime : Infinity
    }
  }

  const events = await collection
    .find(findExpression)
    .sort(sortExpression)
    .project(projectionExpression)
    .skip(0)
    .limit(1)
    .toArray()

  return events.length > 0 ? events[0] : null
}

export default getLatestEvent
