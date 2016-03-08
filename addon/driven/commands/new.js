'use strict';

var chalk = require('chalk');
var Command = require('ember-cli/lib/models/command');
var Promise = require('ember-cli/lib/ext/promise');
var Project = require('ember-cli/lib/models/project');
var SilentError = require('silent-error');
var validProjectName = require('ember-cli/lib/utilities/valid-project-name');
var normalizeBlueprint = require('ember-cli/lib/utilities/normalize-blueprint-option');

var Command = require('ember-cli/lib/models/command');
var InitCommand = require('./init');

module.exports = Command.extend({
  name: 'new',
  description: 'Creates a new directory and runs ' + chalk.green('driven init') + ' in it.',
  works: 'outsideProject',

  availableOptions: [{
    name: 'dry-run',
    type: Boolean,
    default: false,
    aliases: ['d']
  }, {
    name: 'verbose',
    type: Boolean,
    default: false,
    aliases: ['v']
  }, {
    name: 'blueprint',
    type: String,
    default: 'driven',
    aliases: ['b']
  }, {
    name: 'skip-npm',
    type: Boolean,
    default: false,
    aliases: ['sn']
  }, {
    name: 'skip-bower',
    type: Boolean,
    default: true,
    aliases: ['sb']
  }, {
    name: 'skip-git',
    type: Boolean,
    default: false,
    aliases: ['sg']
  }, {
    name: 'directory',
    type: String,
    aliases: ['dir']
  }],
  run: function(commandOptions, rawArgs) {
    console.log('NOPE');

    var packageName = rawArgs[0],
      message;

    commandOptions.name = rawArgs.shift();

    if (!packageName) {
      message = chalk.yellow('The `driven ' + this.name + '` command requires a ' +
        'name argument to be specified. For more details, use `driven help`.');

      return Promise.reject(new SilentError(message));
    }

    if (commandOptions.dryRun) {
      commandOptions.skipGit = true;
    }

    if (packageName === '.') {
      message = 'Trying to generate an application structure in this directory? Use `driven init` instead.';

      return Promise.reject(new SilentError(message));
    }

    if (!validProjectName(packageName)) {
      message = 'We currently do not support a name of `' + packageName + '`.';

      return Promise.reject(new SilentError(message));
    }

    commandOptions.blueprint = normalizeBlueprint(commandOptions.blueprint);

    if (!commandOptions.directory) {
      commandOptions.directory = packageName;
    }

    var createAndStepIntoDirectory = new this.tasks.CreateAndStepIntoDirectory({
      ui: this.ui,
      analytics: this.analytics
    });

    var initCommand = new InitCommand({
      ui: this.ui,
      analytics: this.analytics,
      tasks: this.tasks,
      project: Project.nullProject(this.ui, this.cli)
    });

    return createAndStepIntoDirectory
      .run({
        directoryName: commandOptions.directory,
        dryRun: commandOptions.dryRun
      })
      .then(initCommand.run.bind(initCommand, commandOptions, rawArgs));
  }
});

module.exports.overrideCore = true;
