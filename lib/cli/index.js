var cli  = require('ember-cli/lib/cli');
var path = require('path');

module.exports = function (options) {
  options.cli = {
    name: 'driven',
    root: path.join(__dirname, '..', '..'),
    npmPackage: 'driven-cli'
  };
  return cli(options);
};
