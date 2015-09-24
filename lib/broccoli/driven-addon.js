/* global require, module */
'use strict';

/**
@module driven-cli
*/
var defaults = require('merge-defaults');
var merge    = require('lodash/object/merge');
var Funnel   = require('broccoli-funnel');
var DrivenApp = require('./driven-app');

module.exports = DrivenAddon;

/**
  DrivenAddon is used during addon development.

  @class DrivenAddon
  @extends DrivenApp
  @constructor
  @param options
*/
function DrivenAddon() {
  var args = [];
  var options = {};

  for (var i = 0, l = arguments.length; i < l; i++) {
    args.push(arguments[i]);
  }

  if (args.length === 1) {
    options = args[0];
  } else if (args.length > 1) {
    args.reverse();
    options = defaults.apply(null, args);
  }

  process.env.DRIVEN_ADDON_ENV = process.env.DRIVEN_ADDON_ENV || 'development';

  this.appConstructor(merge(options, {
    name: 'dummy',
    configPath: './tests/dummy/config/environment',
    trees: {
      app: 'tests/dummy/app',
      public: 'tests/dummy/public',
      tests: new Funnel('tests', {
        exclude: [ /^dummy/ ]
      })
    },
    jshintrc: {
      tests: './tests',
      app: './tests/dummy'
    },
  }, defaults));
}

DrivenAddon.prototype = Object.create(DrivenApp.prototype);
DrivenAddon.prototype.constructor = DrivenAddon;
DrivenAddon.prototype.appConstructor = DrivenApp.prototype.constructor;
