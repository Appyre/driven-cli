/* jshint ignore:start */

define('{{MODULE_PREFIX}}/config/environment', ['driven'], function(Driven) {
  {{content-for 'config-module'}}
});

{{content-for 'app-boot'}}

/* jshint ignore:end */
