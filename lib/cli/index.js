const broccoli = require('broccoli');
const RSVP = require('rsvp');
const Funnel = require('broccoli-funnel');
const copyDereferenceSync = require('copy-dereference').sync;
const chalk = require('chalk');
const exit = require('exit');
const serve = require('./../utils/serve');

module.exports = function cli(env) {
  // console.log(env);
  const command = env.cliArgs.shift();
  const appTree = new Funnel('.', {
    include: ['app/**/*','config/**/*', 'index.js'],
  });
  const builder = new broccoli.Builder(appTree);

  switch (command) {
    case 'build':
    case 'b':
      const outputDir = './dist';
      return builder.build()
        .then(() => {
          copyDereferenceSync(builder.outputPath, outputDir);
        });
      break;

    case 'serve':
    case 's':
      return serve(builder, env, env.cliArgs);
      break;

    case 'new':
      console.log(chalk.red('Not implemented (yet).'));
      exit(1);
      break;

    default:
      console.log(chalk.red(`Unkown Drive command: ${command}`));
      exit(1);
      break;
  }
};