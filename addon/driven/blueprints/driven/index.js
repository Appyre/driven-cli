var stringUtils = require('ember-cli/lib/utilities/string');

module.exports = {
  description: '',

  locals: function(options) {
     // Return custom template variables here.
     return {
       packageName: stringUtils.dasherize(options.entity.name)
     };
  }
};
