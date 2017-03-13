/*jshint node:true*/
"use strict";
// const printSlowNodes = require('broccoli-slow-trees');
const broccoli = require('broccoli');
const spawn = require('./spawn');
const RSVP = require('rsvp');
const path = require('path');

module.exports = function serve(builder, env, args) {
  const watcher = new broccoli.Watcher(builder);
  let spawnedProcess;
  let hangingResolve;

  // We register these so the 'exit' handler removing temp dirs is called
  function cleanupAndExit() {
    return watcher.quit();
  }

  process.on('SIGINT', cleanupAndExit);
  process.on('SIGTERM', cleanupAndExit);

  watcher.on('buildSuccess', function() {
    // printSlowNodes(builder.outputNodeWrapper);
    console.log('Built - ' + Math.round(builder.outputNodeWrapper.buildState.totalTime) + ' ms @ ' + new Date().toString());
    if (spawnedProcess) {
      spawnedProcess.kill();
    }

    let command = path.join(builder.outputPath, './index.js');

    spawnedProcess = spawn(command, args, {});
  });

  watcher.on('buildFailure', function(err) {
    console.log('Built with error:');
    console.log(err.message);
    if (!err.broccoliPayload || !err.broccoliPayload.location.file) {
      console.log('');
      console.log(err.stack)
    }
    console.log('');
  });

  watcher.start()
    .catch(function(err) {
      console.log(err && err.stack || err);
    })
    .finally(function() {
      builder.cleanup();
      if (spawnedProcess) {
        spawnedProcess.kill();
      }
    })
    .catch(function(err) {
      console.log('Cleanup error:');
      console.log(err && err.stack || err);
    })
    .finally(function() {
      process.exit(1);
    });

  return new RSVP.Promise((resolve) => {
    hangingResolve = resolve;
  });
};