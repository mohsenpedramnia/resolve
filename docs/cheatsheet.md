---
id: cheatsheet
title: Cheatsheet
---

## Create a New Application

### Default

```sh
yarn create resolve-app my-app
```

### From Example

```sh
yarn create resolve-app -e hacker-news my-hacker-news-app
```

## Provide the Write Side

### Handle an Aggregate Command

##### event_types.js

```js
// Define an event type
export const ITEM_CREATED = 'ITEM_CREATED'
export const ITEM_DELETED = 'ITEM_DELETED'
```

##### shopping-list.commands.js:

```js
// Define a set of command handler functions:
import { ITEM_CREATED, ITEM_DELETED } from '../event_types'

export default {
  createItem: (state, { payload: { name } }) => {
    if (!name) throw new Error('name is required')
    return {
      type: ITEM_CREATED,
      payload: { name }
    }
  },

  removeItem: state => {
    if (!state || !state.createdAt) {
      throw new Error(`item does not exist`)
    }
    return {
      type: ITEM_DELETED
    }
  }
```

### Maintain the Aggregate State

##### shopping-list.projection.js:

```js
// Define the aggregate projection:
import { ITEM_CREATED, ITEM_DELETED } from '../event_types'

export default {
  Init: () => ({}),
  [ITEM_CREATED]: (state, { timestamp }) => ({
    ...state,
    createdAt: timestamp
  }),
  [ITEM_DELETED]: () => ({})
}
```

### Register the Aggregate

##### config.app.js:

```js
// Add file paths to the Aggregates section:
aggregates: [
  {
    name: 'ShoppingList',
    commands: 'common/aggregates/shopping_list.commands.js',
    projection: 'common/aggregates/shopping_list.projection.js'
  }
],
```

---

## Provide the Read Side

### Implement a Read Model

Read models build state from events and use this state to answer queries.

```js
// Define the read model projection to build the state:
import {
  SHOPPING_LIST_CREATED,
  SHOPPING_LIST_REMOVED,
  SHOPPING_LIST_RENAMED
} from '../event_types'

export default {
  Init: async store => {
    await store.defineTable('ShoppingLists', {
      indexes: {
        id: 'string'
      },
      fields: ['createdAt', 'name']
    })
  },

  [SHOPPING_LIST_CREATED]: async (
    store,
    { aggregateId, timestamp, payload: { name } }
  ) => {
    const shoppingList = {
      id: aggregateId,
      name,
      createdAt: timestamp
    }

    await store.insert('ShoppingLists', shoppingList)
  },

  [SHOPPING_LIST_REMOVED]: async (store, { aggregateId }) => {
    await store.delete('ShoppingLists', { id: aggregateId })
  },

  [SHOPPING_LIST_RENAMED]: async (
    store,
    { aggregateId, payload: { name } }
  ) => {
    await store.update('ShoppingLists', { id: aggregateId }, { $set: { name } })
  }
}
```

```js
// Define the resolver to answer queries:
export default {
  all: async store => {
    return await store.find('ShoppingLists', {}, null, { createdAt: 1 })
  }
}
```

### Implement a Reactive View Model

View models are special kind of read models. They are aggregate centric and can reactively update the Redux state on the client.

```js
// Define the view model projection to build the resulting data sample
import { SHOPPING_LIST_CREATED, SHOPPING_ITEM_CREATED } from '../eventTypes'

export default {
  Init: () => null,
  [SHOPPING_LIST_CREATED]: (state, { aggregateId, payload: { name } }) => ({
    id: aggregateId,
    name,
    list: []
  }),
  [SHOPPING_ITEM_CREATED]: (state, { payload: { id, text } }) => ({
    ...state,
    list: [
      ...state.list,
      {
        id,
        text,
        checked: false
      }
    ]
  })
}
```

---

## Implement HTTP API Handlers

You can implement HTTP API Handlers to handle HTTP requests.

```js
export default async (req, res) => {
  const { id } = req.query
  const user = await getUserById(id)
  res.file(JSON.stringify(user), 'user.json')
}
```

---

## Implement Sagas

### Respond to Events

### Run Code on Schedule

---

## Use Modules

---

## Add Authentication

---

## Serve Static Resources

You can specify the static resource folder using the **staticDir** configuration option:

##### config.app.js

```js
const appConfig = {
  staticDir: 'static'
  ...
}
export default appConfig
```

---

## Provide the Frontend

### Bind to a Read Model

### Bind to a View Model

### Support Optimistic UI Updates

### Configure Routes

### Fix URL Paths

### Fix Static Resource Paths

---

## Use Standard HTTP API

### Send Aggregate Commands

### Query a Read Model

### Query a View Model

---

## Prepare to Production

### Provide Separate Config for Production

### Use Environment Variables

### Use Storage Adapters
