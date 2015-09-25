# Driven

A Simple CLI for rapidly building APIs and Mocks based on Waterline.

Based on (and forked from) [ember-cli](https://github.com/ember-cli/ember-cli) with great love and appreciation.
Potentially, lessons learned will be abstracted into a [shared code base for building advanced CLIs](https://github.com/Appyre/divine-cli).

- knex.js http://knexjs.org/
- bookshelf.js http://bookshelfjs.org/
- sails migrations https://www.npmjs.com/package/sails-migrations
- ember-cli http://www.ember-cli.com/
- waterline https://github.com/balderdashy/waterline
- active-record migrations http://edgeguides.rubyonrails.org/active_record_migrations.html
- waterline docs https://github.com/balderdashy/waterline-docs/blob/master/models/configuration.md
- angular-cli https://github.com/angular/angular-cli

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
