---
id: cheatsheet
title: Cheatsheet
---

## Create a New Application

### Default

A new app is created based on the [Hello World](https://github.com/reimagined/resolve/tree/master/examples/hello-world) example project.

```sh
yarn create resolve-app my-app
```

### From Example

Use the `-e` option to create a new app based on one of the provided [example projects](introduction#examples).

```sh
yarn create resolve-app -e hacker-news my-hacker-news-app
```

## Provide the Write Side

### Handle an Aggregate Command

Aggregate command handlers receive commands and emit events in response.

##### event_types.js:

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

Use aggregate projection to build the aggregate's state from previously emitted events. You can use this state in command handlers, for example to perform validation.

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

To let the application know about the aggregate, register its files in the `aggregates` configuration section.

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

##### shopping_lists.projection.js:

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

##### shopping_lists.resolvers.js:

```js
// Define the resolver to answer queries:
export default {
  all: async store => {
    return await store.find('ShoppingLists', {}, null, { createdAt: 1 })
  }
}
```

### Implement a Reactive View Model

View models are a special kind of read models. They are aggregate centric and can reactively update the Redux state on the client.

##### shopping_list.projection.js

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

Use HTTP API handlers to to handler arbitrary HTTP requests.

##### get_user.js

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

```js
const eventHandlers = {
  UserCreationRequested: async (event, { resolve }) => {
    const { aggregateId } = event
    const createdUser = await resolve.executeQuery({
      modelName: 'default',
      resolverName: 'createdUser',
      resolverArgs: { id: aggregateId }
    })

    if (!createdUser) {
      return
    }

    const users = await resolve.executeQuery({
      modelName: 'default',
      resolverName: 'users',
      resolverArgs: { id: aggregateId }
    })

    const userWithSameEmail = users.find(
      user => user.email === createdUser.email
    )

    await resolve.executeCommand({
      type: userWithSameEmail ? 'rejectUserCreation' : 'confirmUserCreation',
      aggregateName: 'user',
      payload: { createdUser },
      aggregateId
    })
  }
}

export default eventHandlers
```

### Run Code on Schedule

```js
const outdatedPeriod = 1000 * 60 * 10

const cronHandlers = {
  '0 */10 * * * *': async ({ resolve }) => {
    const users = await resolve.executeQuery({
      modelName: 'default',
      resolverName: 'users'
    })

    const now = Date.now()

    users.forEach(user => {
      if (user.timestamp + outdatedPeriod < now) {
        resolve.executeCommand({
          type: 'deleteOutdatedUser',
          aggregateName: 'user',
          aggregateId: user.id
        })
      }
    })
  }
}
```

---

## Use Modules

##### run.js

```js
// Request a module and merge it with the application's config
import { merge } from 'resolve-scripts'
import createModuleComments from 'resolve-module-comments'

merge(resolveConfig, createModuleComments())
```

---

## Add Authentication

Use reSolve's built-in **[module](./advanced-techniques.md#modules)** (**resolve-module-auth**) to enable authentication in your application.

##### run.js

```js
// Initialize and merge the authentication module
const moduleAuth = resolveModuleAuth([
  {
    name: 'local-strategy',
    createStrategy: 'auth/create_strategy.js',
    logoutRoute: {
      path: 'logout',
      method: 'POST'
    },
    routes: [
      {
        path: 'register',
        method: 'POST',
        callback: 'auth/route_register_callback.js'
      },
      {
        path: 'login',
        method: 'POST',
        callback: 'auth/route_login_callback.js'
      }
    ]
  }
])

const baseConfig = merge(
  defaultResolveConfig,
  appConfig,
  moduleComments,
  moduleAuth
)
```

##### auth/create_strategy.js

```js
// Implement the authentication strategy constructor
import { Strategy as StrategyFactory } from 'passport-local'

const createStrategy = options => ({
  factory: StrategyFactory,
  options: {
    failureRedirect: error =>
      `/error?text=${encodeURIComponent(error.message)}`,
    errorRedirect: error => `/error?text=${encodeURIComponent(error.message)}`,
    usernameField: 'username',
    passwordField: 'username',
    successRedirect: null,
    ...options
  }
})

export default createStrategy
```

## Serve Static Resources

You can specify the static resource folder using the **staticDir** configuration option.

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

```js
export const mapStateToOptions = () => ({
  readModelName: 'ShoppingLists',
  resolverName: 'all',
  resolverArgs: {}
})

export const mapStateToProps = (state, ownProps) => ({
  lists: ownProps.data
})

export const mapDispatchToProps = (dispatch, { aggregateActions }) =>
  bindActionCreators(aggregateActions, dispatch)

export default connectReadModel(mapStateToOptions)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(MyLists)
)
```

### Bind to a View Model

```js
export const mapStateToOptions = (state, ownProps) => {
  const aggregateId = ownProps.match.params.id

  return {
    viewModelName: 'ShoppingList',
    aggregateIds: [aggregateId]
  }
}

export const mapStateToProps = (state, ownProps) => {
  const aggregateId = ownProps.match.params.id

  return {
    aggregateId
  }
}

export const mapDispatchToProps = (dispatch, { aggregateActions }) =>
  bindActionCreators(
    {
      ...aggregateActions,
      replaceUrl: routerActions.replace
    },
    dispatch
  )

export default connectViewModel(mapStateToOptions)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(ShoppingList)
)
```

### Support Optimistic UI Updates

##### client/actions/optimistic_actions.js

```js
export const OPTIMISTIC_CREATE_SHOPPING_LIST = 'OPTIMISTIC_CREATE_SHOPPING_LIST'
export const OPTIMISTIC_SYNC = 'OPTIMISTIC_SYNC'
```

##### client/reducers/optimistic_shopping_lists.js

```js
import { LOCATION_CHANGE } from 'react-router-redux'
import {
  OPTIMISTIC_CREATE_SHOPPING_LIST,
  OPTIMISTIC_SYNC
} from '../actions/optimistic_actions'

const optimistic_shopping_lists = (state = [], action) => {
  switch (action.type) {
    case LOCATION_CHANGE: {
      return []
    }
    case OPTIMISTIC_CREATE_SHOPPING_LIST: {
      return [
        ...state,
        {
          id: action.payload.id,
          name: action.payload.name
        }
      ]
    }
    case OPTIMISTIC_SYNC: {
      return action.payload.originalLists
    }
    default: {
      return state
    }
  }
}

export default optimistic_shopping_lists
```

##### client/middlewares/optimistic_shopping_lists_middleware.js

```js
import { actionTypes } from 'resolve-redux'

import {
  OPTIMISTIC_CREATE_SHOPPING_LIST,
  OPTIMISTIC_SYNC
} from '../actions/optimistic_actions'

const { SEND_COMMAND_SUCCESS, LOAD_READMODEL_STATE_SUCCESS } = actionTypes

const optimistic_shopping_lists_middleware = store => next => action => {
  if (
    action.type === SEND_COMMAND_SUCCESS &&
    action.commandType === 'createShoppingList'
  ) {
    store.dispatch({
      type: OPTIMISTIC_CREATE_SHOPPING_LIST,
      payload: {
        id: action.aggregateId,
        name: action.payload.name
      }
    })
  }
  if (action.type === LOAD_READMODEL_STATE_SUCCESS) {
    store.dispatch({
      type: OPTIMISTIC_SYNC,
      payload: {
        originalLists: action.result
      }
    })
  }

  next(action)
}

export default optimistic_shopping_lists_middleware
```

### Configure Routes

```js
import App from './containers/App'
import ShoppingList from './containers/ShoppingList'
import MyLists from './containers/MyLists'

export default [
  {
    component: App,
    routes: [
      {
        path: '/',
        component: MyLists,
        exact: true
      },
      {
        path: '/:id',
        component: ShoppingList
      }
    ]
  }
]
```

### Fix URL Paths

```js
export default connectRootBasedUrls(['href'])(Link)
```

### Fix Static Resource Paths

```js
export default connectStaticBasedUrls(['css', 'favicon'])(Header)
```

---

## Use Standard HTTP API

### Send an Aggregate Command

```js
$ curl -i http://localhost:3000/api/commands/ \
--header "Content-Type: application/json" \
--data '
{
    "aggregateName": "ShoppingList",
    "aggregateId": "12345-new-shopping-list",
    "type": "createShoppingList",
    "payload": {
        "name": "List 1"
    }
}
'
```

### Query a Read Model

```js
curl -X POST \
-H "Content-Type: application/json" \
-d "{\"page\":0, \"limit\":3}" \
"http://localhost:3000/api/query/default/users"
```

### Query a View Model

```js
curl -g -X GET "http://localhost:3000/api/query/Default/shoppingLists"
```

---

## Prepare to Production

### Provide Separate Config for Production

##### config.prod.js

```js
const prodConfig = {
  target: 'local',
  port: 3000,
  polyfills: ['@babel/polyfill'],
  mode: 'production',
  readModelAdapters: [
    {
      name: 'default',
      module: 'resolve-readmodel-memory',
      options: {}
    }
  ],
  jwtCookie: {
    name: 'jwt',
    maxAge: 31536000000
  }
}

export default prodConfig
```

##### run.js

```js
import {
  build,
  start,
  merge,
  ...
} from 'resolve-scripts'

import appConfig from './config.app'
import prodConfig from './config.prod'

const baseConfig = merge(
   defaultResolveConfig,
   appConfig,
   ...
)

  switch (launchMode) {
    ...
    case 'build': {
      await build(merge(baseConfig, prodConfig))
      break
    }
    case 'start': {
      await start(merge(baseConfig, prodConfig))
      break
    }
  }
  ...
```

### Use Storage Adapters

##### config.prod.js

```js
// Use a MongoDB database to store Read Model state in production
readModelAdapters: [
  {
    name: 'default',
    module: 'resolve-readmodel-mongo',
    options: {
      url: 'mongodb://127.0.0.1:27017/MyDatabaseName'
    }
  }
]
```

### Use Environment Variables

```js
import { declareRuntimeEnv } from 'resolve-scripts'
export default {
  readModels: [
    {
      name: 'myReadModel',
      projection: 'common/read-models/myReadModel/projection.js',
      resolvers: 'common/read-models/myReadModel/resolvers.js',
      adapter: {
        module: 'resolve-readmodel-mysql',
        options: {
          host: declareRuntimeEnv('SQL_HOST'),
          database: declareRuntimeEnv('SQL_DATABASE'),
          user: declareRuntimeEnv('SQL_USER'),
          password: declareRuntimeEnv('SQL_PASSWORD')
        }
      }
    }
  ]
}
```
