const longStringSqlType =
  'VARCHAR(700) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL'
const longNumberSqlType = 'BIGINT NOT NULL'
const customObjectSqlType = 'JSON NULL'

const init = async ({ tableName, connection, escapeId }) => {
  const eventsTableNameAsId = escapeId(tableName)
  const threadsTableNameAsId = escapeId(`${tableName}-threads`)

  await connection.query(
    `CREATE TABLE ${eventsTableNameAsId}(
      \`threadId\` ${longNumberSqlType},
      \`threadCounter\` ${longNumberSqlType},
      \`timestamp\` ${longNumberSqlType},
      \`aggregateId\` ${longStringSqlType},
      \`aggregateVersion\` ${longNumberSqlType},
      \`type\` ${longStringSqlType},
      \`payload\` ${customObjectSqlType},
      PRIMARY KEY(\`threadId\`, \`threadCounter\`),
      UNIQUE KEY \`aggregate\`(\`aggregateId\`, \`aggregateVersion\`),
      INDEX USING BTREE(\`aggregateId\`),
      INDEX USING BTREE(\`aggregateVersion\`),
      INDEX USING BTREE(\`type\`),
      INDEX USING BTREE(\`timestamp\`)
    );
    
    CREATE TABLE ${threadsTableNameAsId}(
      \`threadId\` ${longNumberSqlType},
      \`threadCounter\` ${longNumberSqlType},
      PRIMARY KEY(\`threadId\`)
    );

    INSERT INTO ${threadsTableNameAsId}(
      \`threadId\`,
      \`threadCounter\`
    ) VALUES ${Array.from(new Array(256))
      .map((_, index) => `(${index}, 0)`)
      .join(',')}
    ;`
  )
}

export default init
