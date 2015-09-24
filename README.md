# Driven

A Simple CLI for rapidly building APIs and Mocks based on Waterline.

## Installation

```
npm install -g driven-cli
```

## Creating a new API

```
driven new my-app
```

This will create a new project with the following structure:

```
|–– app
|    |–– data
|    |   |–– application
|    |   |   |–– adapter.js
|    |   |   |–– normalizer.js
|    |   |   |–– serializer.js
|    |   |
|    |   |–– foo
|    |       |–– schema.js
|    |       |–– decorator.js
|    |
|    |–– endpoints
|    |   |–– bar
|    |      |–– index.js
|    |      |–– create.js
|    |      |–– update.js
|    |      |–– delete.js
|    |      |–– actions
|    |          |–– baz.js
|    |
|    |–– services
|    |   |–– spam.js
|    |
|    |–– initializers
|    |   |–– eggs.js
|    |
|    |–– router.js
|    |–– app.js
|
|–– config
|     |–– driven.js
|
|–– node_modules
|–– 
```
