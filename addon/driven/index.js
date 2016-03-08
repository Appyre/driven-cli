/* jshint node: true */
'use strict';

module.exports = {
  name: 'driven',
  includedCommands: function() {
    return {
      'new'       : require('./commands/new'),
      'init'      : require('./commands/init'),
    };
  }
};
