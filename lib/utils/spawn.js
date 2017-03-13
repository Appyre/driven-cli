/*jshint node:true*/
'use strict';

var spawn = require('child_process').fork;
var defaults = require('lodash').defaults;

module.exports = function spawnProcess(command, args, options) {
  const subProcess = {
    options: defaults(options, {
      maxBuffer: 5000 * 1024,
      stdio: [0, 1, 2, 'ipc'],
      shell: true
    }),
    ref: null
  };

  subProcess.start = function startSubProcess() {
    if (subProcess.ref) {
      throw new Error('cannot start already started');
    }

    let ref = subProcess.ref = spawn(command, args, subProcess.options);

    ref.on('error', function(err) {
      console.log(err);
      subProcess.ref = null;
    });

    ref.on('exit', function(exitCode) {
      subProcess.ref = null;
    });

    ref.on('close', function(code) {
      subProcess.ref = null;
    });
  };

  subProcess.kill = function killSubProcess() {
    let ref = subProcess.ref;

    if (ref) {
      ref.kill();
      subProcess.ref = null;
    }
  };

  subProcess.start();

  return subProcess;
};