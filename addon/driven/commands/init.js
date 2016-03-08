'use strict';

var Command            = require('ember-cli/lib/models/command');
var Promise            = require('ember-cli/lib/ext/promise');
var SilentError        = require('silent-error');
var validProjectName   = require('ember-cli/lib/utilities/valid-project-name');
var normalizeBlueprint = require('ember-cli/lib/utilities/normalize-blueprint-option');
var GitInit            = require('../tasks/git-init');

module.exports = Command.extend({
  name: 'init',
  description: 'Creates a new driven-cli project in the current folder.',
  aliases: ['i'],
  works: 'everywhere',

  availableOptions: [
    { name: 'dry-run',    type: Boolean, default: false, aliases: ['d'] },
    { name: 'verbose',    type: Boolean, default: false, aliases: ['v'] },
    { name: 'blueprint',  type: String,                  aliases: ['b'] },
    { name: 'skip-npm',   type: Boolean, default: false, aliases: ['sn'] },
    { name: 'skip-bower', type: Boolean, default: false, aliases: ['sb'] },
    { name: 'name',       type: String,  default: '',    aliases: ['n'] }
  ],

  anonymousOptions: [
    '<glob-pattern>'
  ],

  _defaultBlueprint: function() {
    if (this.project.isEmberCLIAddon()) {
      return 'addon';
    } else {
      return 'driven';
    }
  },

  run: function(commandOptions, rawArgs) {
    if (commandOptions.dryRun) {
      commandOptions.skipNpm = true;
      commandOptions.skipBower = true;
    }

    var installBlueprint = new this.tasks.InstallBlueprint({
      ui: this.ui,
      analytics: this.analytics,
      project: this.project
    });

    // needs an explicit check in case it's just 'undefined'
    // due to passing of options from 'new' and 'addon'
    if (commandOptions.skipGit === false) {
      var gitInit = new GitInit({
        ui: this.ui,
        project: this.project
      });
    }

    if (!commandOptions.skipNpm) {
      var npmInstall = new this.tasks.NpmInstall({
        ui: this.ui,
        analytics: this.analytics,
        project: this.project
      });
    }

    if (!commandOptions.skipBower) {
      var bowerInstall = new this.tasks.BowerInstall({
        ui: this.ui,
        analytics: this.analytics,
        project: this.project
      });
    }

    var project     = this.project;
    var packageName = commandOptions.name !== '.' && commandOptions.name || project.name();

    if (!packageName) {
      var message = 'The `driven ' + this.name + '` command requires a ' +
                    'package.json in current folder with name attribute or a specified name via arguments. ' +
                    'For more details, use `driven help`.';

      return Promise.reject(new SilentError(message));
    }

    var blueprintOpts = {
      dryRun: commandOptions.dryRun,
      blueprint: commandOptions.blueprint || this._defaultBlueprint(),
      rawName: packageName,
      targetFiles: rawArgs || '',
      rawArgs: rawArgs.toString()
    };

    if (!validProjectName(packageName)) {
      return Promise.reject(new SilentError('We currently do not support a name of `' + packageName + '`.'));
    }

    blueprintOpts.blueprint = normalizeBlueprint(blueprintOpts.blueprint);

    return installBlueprint.run(blueprintOpts)
      .then(function() {
        if (commandOptions.skipGit === false) {
          return gitInit.run(commandOptions, rawArgs);
        }
      }.bind(this))
      .then(function() {
        if (!commandOptions.skipNpm) {
          return npmInstall.run({
              verbose: commandOptions.verbose,
              optional: false
            });
        }
      })
      .then(function() {
        if (!commandOptions.skipBower) {
          return bowerInstall.run({
              verbose: commandOptions.verbose
            });
        }
      });
  }
});

module.exports.overrideCore = true;
