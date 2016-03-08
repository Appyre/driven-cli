'use strict';

var Promise  = require('ember-cli/lib/ext/promise');
var exec     = Promise.denodeify(require('child_process').exec);
var path     = require('path');
var pkg      = require('../package.json');
var fs       = require('fs');
var template = require('lodash/template');
var Task     = require('ember-cli/lib/models/task');

var gitEnvironmentVariables = {
  GIT_AUTHOR_NAME: 'driven-cli',
  GIT_AUTHOR_EMAIL: 'driven-cli@drivenapi.com',
  get GIT_COMMITTER_NAME(){ return this.GIT_AUTHOR_NAME; },
  get GIT_COMMITTER_EMAIL(){ return this.GIT_AUTHOR_EMAIL; }
};

module.exports = Task.extend({
  run: function(commandOptions) {
    var chalk  = require('chalk');
    var ui     = this.ui;

    if(commandOptions.skipGit) { return Promise.resolve(); }

    return exec('git --version')
      .then(function() {
        return exec('git init')
          .then(function() {
            return exec('git add .');
          })
          .then(function(){
            var commitTemplate = fs.readFileSync(path.join(__dirname, '../utilities/INITIAL_COMMIT_MESSAGE.txt'));
            var commitMessage = template(commitTemplate)(pkg);
            return exec('git commit -m "' + commitMessage + '"', {env: gitEnvironmentVariables});
          })
          .then(function(){
            ui.writeLine(chalk.green('Successfully initialized git.'));
          });
      }).catch(function(/*error*/){
        // if git is not found or an error was thrown during the `git`
        // init process just swallow any errors here
      });
  }
});

module.exports.overrideCore = true;
