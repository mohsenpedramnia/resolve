const convertBinaryRow = (originalRow, readModelName, fieldList) => {
  if (fieldList != null && fieldList.constructor !== Object) {
    throw new Error(
      'Field list should be object with enumerated selected fields'
    )
  }

  const row = {}
  for (const key of Object.keys(originalRow)) {
    if (key === `RESOLVE-${readModelName}`) continue

    row[key] = JSON.parse(
      String(originalRow[key])
        .replace(/\u001a2/g, '.')
        .replace(/\u001a1/g, '"')
        .replace(/\u001a0/g, '\u001a')
    )
  }

  if (fieldList == null) {
    return row
  }

  const fieldNames = Object.keys(fieldList)
  if (fieldNames.length === 0) {
    return row
  }

  const inclusiveMode = fieldList[fieldNames[0]] === 1
  for (const key of Object.keys(row)) {
    if (
      !(
        (inclusiveMode && fieldList.hasOwnProperty(key)) ||
        (!inclusiveMode && !fieldList.hasOwnProperty(key))
      )
    ) {
      delete row[key]
    }
  }

  return row
}

export default convertBinaryRow
