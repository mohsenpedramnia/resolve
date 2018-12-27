---
id: cheatsheet
title: Cheatsheet
---

## Provide the Write Side

### Handle Aggregate Commands

##### shopping-list.commands.js:

```js
// Define a set of command handler functions:
```

### Maintain the Aggregate State

##### shopping-list.projection.js:

```js
// Define the aggregate projection:
```

### Register the Aggregate

##### config.app.js:

```js
// Add file paths to the Aggregates section:
```

---

## Provide the Read Side

### Implement a Read Model

Read models build state from events and use this state to answer queries.

```js
// Define the read model projection to build the state:
```

```js
// Define the resolver to answer queries:
```

### Implement a Reactive View Model

View models are special kind of read models. They are aggregate centric and can reactively update the Redux state on the client.

```js
// Define the view model projection to build the resulting data sample
```

---

## Implement HTTP API Handlers

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
