/* global require, module, escape */
'use strict';

/**
@module driven-cli
*/
var fs           = require('fs');
var existsSync   = require('exists-sync');
var path         = require('path');
var p            = require('ember-cli-preprocess-registry/preprocessors');
var chalk        = require('chalk');
var escapeRegExp = require('escape-string-regexp');
var EOL          = require('os').EOL;

var Project      = require('../models/project');
var SilentError  = require('silent-error');

var preprocessJs  = p.preprocessJs;
var isType        = p.isType;

var Babel  = require('broccoli-babel-transpiler');
var concatFilesWithSourcemaps = require('broccoli-sourcemap-concat');

var ConfigLoader  = require('./broccoli-config-loader');
var ConfigReplace = require('./broccoli-config-replace');
var mergeTrees    = require('./merge-trees');
var WatchedDir    = require('broccoli-source').WatchedDir;
var UnwatchedDir  = require('broccoli-source').UnwatchedDir;

var defaults      = require('merge-defaults');
var merge         = require('lodash/object/merge');
var omit          = require('lodash/object/omit');
var ES3SafeFilter = require('broccoli-es3-safe-recast');
var Funnel        = require('broccoli-funnel');

module.exports = DrivenApp;

/**
  DrivenApp is the main class Driven CLI uses to manage the Broccoli trees
  for your application. It is very tightly integrated with Broccoli and has
  an `toTree()` method you can use to get the entire tree for your application.

  Available init options:
    - es3Safe, defaults to `false`,
    - autoRun, defaults to `true`,
    - outputPaths, defaults to `{}`,
    - minifyJS, defaults to `{enabled: !!isProduction},
    - sourcemaps, defaults to `{}`,
    - trees, defaults to `{},`
    - jshintrc, defaults to `{},`
    - vendorFiles, defaults to `{}`

  @class DrivenApp
  @constructor
  @param {Object} options Configuration options
*/
function DrivenApp() {
  var args = [];
  var options = {};

  for (var i = 0, l = arguments.length; i < l; i++) {
    args.push(arguments[i]);
  }

  if (args.length === 1) {
    options = args[0];
  } else if (args.length > 1) {
    args.reverse();
    options = defaults.apply(null, args);
  }

  this._initProject(options);

  this.env  = DrivenApp.env();
  this.name = options.name || this.project.name();

  this.registry = options.registry || p.defaultRegistry(this);

  var isProduction = this.env === 'production';

  this._initTestsAndHinting(options, isProduction);
  this._initOptions(options, isProduction);
  this._initVendorFiles();

  this.legacyFilesToAppend     = [];
  this.otherAssetPaths         = [];
  this.legacyTestFilesToAppend = [];
  this.vendorTestStaticStyles  = [];

  this.trees = this.options.trees;

  this.populateLegacyFiles();
  p.setupRegistry(this);
  this._notifyAddonIncluded();
}

/**
  @private
  @method _initTestsAndHinting
  @param {Object} options
  @param {Boolean} isProduction
*/
DrivenApp.prototype._initTestsAndHinting = function(options, isProduction) {
  var testsEnabledDefault = process.env.EMBER_CLI_TEST_COMMAND || !isProduction;

  this.tests   = options.hasOwnProperty('tests')   ? options.tests   : testsEnabledDefault;
  this.hinting = options.hasOwnProperty('hinting') ? options.hinting : testsEnabledDefault;
};

/**
  @private
  @method _initProject
  @param {Object} options
*/
DrivenApp.prototype._initProject = function(options) {
  this.project = options.project || Project.closestSync(process.cwd());

  if (options.configPath) {
    this.project.configPath = function() { return options.configPath; };
  }
};

/**
  @private
  @method _initOptions
  @param {Object} options
  @param {Boolean} isProduction
*/
DrivenApp.prototype._initOptions = function(options, isProduction) {
  var babelOptions = { babel: {} };

  if (this._addonInstalled('ember-cli-babel')) {
    var amdNameResolver = require('amd-name-resolver');
    babelOptions = {
      babel: {
        compileModules: true,
        modules: 'amdStrict',
        moduleIds: true,
        resolveModuleSource: amdNameResolver
      }
    };
  }

  this.options = merge(options, {
    es3Safe: false,
    autoRun: true,
    outputPaths: {},
    minifyJS: {
      enabled: !!isProduction
    },
    sourcemaps: {},
    trees: {},
    jshintrc: {},
    'ember-cli-qunit': {
      disableContainerStyles: false
    }
  }, babelOptions, defaults);

  // needs a deeper merge than is provided above
  this.options.outputPaths = merge(this.options.outputPaths, {
    app: {
      js: 'driven-server.js'
    },
    testSupport: {
      css: '/assets/test-support.css',
      js: {
        testSupport: '/assets/test-support.js',
        testLoader: '/assets/test-loader.js'
      }
    }
  }, defaults);

  this.options.sourcemaps = merge(this.options.sourcemaps, {
    enabled: !isProduction,
    extensions: ['js']
  }, defaults);

  // For now we must disable Babel sourcemaps due to unforseen
  // performance regressions.
  this.options.babel.sourceMaps = false;

  this.options.trees = merge(this.options.trees, {
    app:       new WatchedDir('app'),
    tests:     new WatchedDir('tests'),

    // these are contained within app/ no need to watch again
    // (we should probably have the builder or the watcher dedup though)
    vendor: existsSync('vendor') ? new UnwatchedDir('vendor') : null,
    public: existsSync('public') ? new WatchedDir('public') : null
  }, defaults);

  this.options.jshintrc = merge(this.options.jshintrc, {
    app: this.project.root,
    tests: path.join(this.project.root, 'tests'),
  }, defaults);
};

/**
  @private
  @method _initVendorFiles
*/
DrivenApp.prototype._initVendorFiles = function() {

  this.vendorFiles = omit(merge({}, this.options.vendorFiles), function(value) {
    return value === null;
  });

};

/**
  Returns the environment name

  @public
  @static
  @method env
  @return {String} Environment name
 */
DrivenApp.env = function(){
  return process.env.EMBER_ENV || 'development';
};

/**
  Provides a broccoli files concatenation filter that's configured
  properly for this application.

  @method concatFiles
  @param tree
  @param options
  @return
*/
DrivenApp.prototype.concatFiles = function(tree, options) {
  options.sourceMapConfig = this.options.sourcemaps;

  return concatFilesWithSourcemaps(tree, options);
};


/**
  @private
  @method _notifyAddonIncluded
*/
DrivenApp.prototype._notifyAddonIncluded = function() {
  this.initializeAddons();
  this.project.addons = this.project.addons.filter(function(addon) {
    addon.app = this;

    if (!addon.isEnabled || addon.isEnabled()) {
      if (addon.included) {
        addon.included(this);
      }

      return addon;
    }
  }, this);
};

/**
  Loads and initializes addons for this project.
  Calls initializeAddons on the Project.

  @private
  @method initializeAddons
*/
DrivenApp.prototype.initializeAddons = function() {
  this.project.initializeAddons();
};

/**
  Returns a list of trees for a given type, returned by all addons.

  @private
  @method addonTreesFor
  @param  {String} type Type of tree
  @return {Array}       List of trees
 */
DrivenApp.prototype.addonTreesFor = function(type) {
  return this.project.addons.map(function(addon) {
    if (addon.treeFor) {
      return addon.treeFor(type);
    }
  }).filter(Boolean);
};

/**
  Runs addon postprocessing on a given tree and returns the processed tree.

  This enables addons to do process immediately **after** the preprocessor for a
  given type is run, but before concatenation occurs. If an addon wishes to
  apply a transform before the preprocessors run, they can instead implement the
  preprocessTree hook.

  To utilize this addons implement `postprocessTree` hook.

  An example, would be to apply some broccoli transform on all JS files, but
  only after the existing pre-processors have fun.

  ```js
  module.exports = {
    name: 'my-cool-addon',
    postprocessTree: function(type, tree) {
      if (type === 'js') {
        return someBroccoliTransform(tree);
      }

      return tree;
    }
  }

  ```

  @private
  @method addonPostprocessTree
  @param  {String} type Type of tree
  @param  {Tree}   tree Tree to process
  @return {Tree}        Processed tree
 */
DrivenApp.prototype.addonPostprocessTree = function(type, tree) {
  var workingTree = tree;

  this.project.addons.forEach(function(addon) {
    if (addon.postprocessTree) {
      workingTree = addon.postprocessTree(type, workingTree);
    }
  });

  return workingTree;
};


/**
  Runs addon postprocessing on a given tree and returns the processed tree.

  This enables addons to do process immediately **before** the preprocessor for a
  given type is run, but before concatenation occurs.  If an addon wishes to
  apply a transform  after the preprocessors run, they can instead implement the
  postprocessTree hook.

  To utilize this addons implement `postprocessTree` hook.

  An example, would be to remove some set of files before the preprocessors run.

  ```js
  var stew = require('broccoli-stew');

  module.exports = {
    name: 'my-cool-addon',
    preprocessTree: function(type, tree) {
      if (type === 'js') {
        return stew.rm(tree, someGlobPattern);
      }

      return tree;
    }
  }
  ```

  @private
  @method addonPreprocessTree
  @param  {String} type Type of tree
  @param  {Tree}   tree Tree to process
  @return {Tree}        Processed tree
 */
DrivenApp.prototype.addonPreprocessTree = function(type, tree) {
  var workingTree = tree;

  this.project.addons.forEach(function(addon) {
    if (addon.preprocessTree) {
      workingTree = addon.preprocessTree(type, workingTree);
    }
  });

  return workingTree;
};

/**
  Runs addon lintTree hooks and returns a single tree containing all
  their output.

  @private
  @method addonLintTree
  @param  {String} type Type of tree
  @param  {Tree}   tree Tree to process
  @return {Tree}        Processed tree
 */
DrivenApp.prototype.addonLintTree = function(type, tree) {
  var output = this.project.addons.map(function(addon) {
    if (addon.lintTree) {
      return addon.lintTree(type, tree);
    }
  }).filter(Boolean);
  return mergeTrees(output, {
    overwrite: true,
    annotation: 'TreeMerger (lint)'
  });
};

/**
  Imports legacy imports in this.vendorFiles

  @private
  @method populateLegacyFiles
*/
DrivenApp.prototype.populateLegacyFiles = function () {
  var name;
  for (name in this.vendorFiles) {
    var args = this.vendorFiles[name];

    if (args === null) { continue; }

    this.import.apply(this, [].concat(args));
  }
};


/**
  @private
  @method _filterAppTree
  @return tree
*/
DrivenApp.prototype._filterAppTree = function() {
  if (this._cachedFilterAppTree) {
    return this._cachedFilterAppTree;
  }

  this._cachedFilterAppTree = new Funnel(this.trees.app, {
    annotation: 'Funnel: Filtered App'
  });

  return this._cachedFilterAppTree;
};


/**
  Returns the tree for /public

  @private
  @method publicTree
  @return {Tree} Tree for /public
 */
DrivenApp.prototype.publicTree = function() {
  var trees = this.addonTreesFor('public');

  if (this.trees.public) {
    trees.push(this.trees.public);
  }

  return mergeTrees(trees, {
    overwrite: true,
    annotation: 'TreeMerge (public)'
  });
};


/**
  @private
  @method _processedAppTree
  @return
*/
DrivenApp.prototype._processedAppTree = function() {
  var addonTrees = this.addonTreesFor('app');
  var mergedApp  = mergeTrees(addonTrees.concat(this._filterAppTree()), {
    overwrite: true,
    annotation: 'TreeMerger (app)'
  });

  return new Funnel(mergedApp, {
    srcDir: '/',
    destDir: this.name,
    annotation: 'ProcessedAppTree'
  });
};


/**
  @private
  @method _processedTestsTree
  @return
*/
DrivenApp.prototype._processedTestsTree = function() {
  var addonTrees  = this.addonTreesFor('test-support');
  var mergedTests = mergeTrees(addonTrees.concat(this.trees.tests), {
    overwrite: true,
    annotation: 'TreeMerger (tests)'
  });

  return new Funnel(mergedTests, {
    srcDir: '/',
    destDir: this.name + '/tests',
    annotation: 'ProcessedTestTree'
  });
};

/**

*/
DrivenApp.prototype._addonTree = function _addonTree() {
  if (this._cachedAddonTree) {
    return this._cachedAddonTree;
  }

  var addonTrees = mergeTrees(this.addonTreesFor('addon'), {
    overwrite: true,
    annotation: 'TreeMerger (addons)'
  });

  var addonES6 = new Funnel(addonTrees, {
    srcDir: 'modules',
    allowEmpty: true,
    annotation: 'Funnel: Addon JS'
  });

  var addonReexports = new Funnel(addonTrees, {
    srcDir: 'reexports',
    allowEmpty: true,
    annotation: 'Funnel: Addon Re-exports'
  });

  var transpiledAddonTree = new Babel(addonES6, this._prunedBabelOptions());

  var reexportsAndTranspiledAddonTree = mergeTrees([
    transpiledAddonTree,
    addonReexports
  ], {
    annotation: 'TreeMerger: (re-exports)'
  });

  return this._cachedAddonTree = [
    this.concatFiles(reexportsAndTranspiledAddonTree, {
      inputFiles: ['**/*.js'],
      outputFile: '/addons.js',
      allowNone: true,
      annotation: 'Concat: Addon JS'
    })
  ];
};

/**
  @private
  @method _processedVendorTree
  @return
*/
DrivenApp.prototype._processedVendorTree = function() {
  if(this._cachedVendorTree) {
    return this._cachedVendorTree;
  }

  var trees = this._addonTree();
  trees = trees.concat(this.addonTreesFor('vendor'));

  if (this.trees.vendor) {
    trees.push(this.trees.vendor);
  }

  var mergedVendor = mergeTrees(trees, {
    overwrite: true,
    annotation: 'TreeMerger (vendor)'
  });

  this._cachedVendorTree = new Funnel(mergedVendor, {
    srcDir: '/',
    destDir: 'vendor/',
    annotation: 'Funnel (vendor)'
  });

  return this._cachedVendorTree;
};

/**
  @private
  @method _processedExternalTree
  @return
*/
DrivenApp.prototype._processedExternalTree = function() {
  if (this._cachedExternalTree) {
    return this._cachedExternalTree;
  }

  var vendor = this._processedVendorTree();
  var trees = [vendor];

  return this._cachedExternalTree = mergeTrees(trees, {
    annotation: 'TreeMerger (ExternalTree)'
  });
};

/**
  @private
  @method _configTree
  @return
*/
DrivenApp.prototype._configTree = function() {
  if (this._cachedConfigTree) {
    return this._cachedConfigTree;
  }

  var configPath = this.project.configPath();
  var configTree = new ConfigLoader(path.dirname(configPath), {
    env: this.env,
    tests: this.tests,
    project: this.project
  });

  this._cachedConfigTree = new Funnel(configTree, {
    srcDir: '/',
    destDir: this.name + '/config',
    annotation: 'Funnel (config)'
  });

  return this._cachedConfigTree;
};

/**
  @private
  @method _processedDrivenCLITree
  @return
*/
DrivenApp.prototype._processedDrivenCLITree = function() {
  if (this._cachedDrivenCLITree) {
    return this._cachedDrivenCLITree;
  }

  var files = [
    'vendor-prefix.js',
    'vendor-suffix.js',
    'app-prefix.js',
    'app-suffix.js',
    'app-boot.js',
    'test-support-prefix.js',
    'test-support-suffix.js'
  ];
  var drivenCLITree = new ConfigReplace(new UnwatchedDir(__dirname), this._configTree(), {
    configPath: path.join(this.name, 'config', 'environments', this.env + '.json'),
    files: files,

    patterns: this._configReplacePatterns()
  });

  return this._cachedDrivenCLITree = new Funnel(drivenCLITree, {
    files: files,
    srcDir: '/',
    destDir: '/vendor/driven-cli/',
    annotation: 'Funnel (driven-cli-tree)'
  });
};

/**
  Returns the tree for the app and its dependencies

  @private
  @method appAndDependencies
  @return {Tree} Merged tree
*/
DrivenApp.prototype.appAndDependencies = function() {
  var sourceTrees = [];
  var config = this._configTree();
  var app;

  if (!this._addonInstalled('ember-cli-babel')) {
    app = this.addonPreprocessTree('js', this._processedAppTree());
    if (this.options.es3Safe) {
      app = new ES3SafeFilter(app);
    }
  } else {
    app = this.addonPreprocessTree('js', mergeTrees([this._processedAppTree()].concat(sourceTrees), {
      annotation: 'TreeMerger (preprocessedApp)',
      overwrite: true
    }));
  }

  var external = this._processedExternalTree();
  var preprocessedApp = preprocessJs(app, '/', this.name, {
    registry: this.registry
  });

  this._addAppTests(sourceTrees);

  var postprocessedApp = this.addonPostprocessTree('js', preprocessedApp);
  sourceTrees = sourceTrees.concat([
    external,
    postprocessedApp,
    config
  ]);

  var drivenCLITree = this._processedDrivenCLITree();

  sourceTrees.push(drivenCLITree);

  return mergeTrees(sourceTrees, {
    overwrite: true,
    annotation: 'TreeMerger (appAndDependencies)'
  });
};

/**
  @private
  @method _addAppTests
  @param {Array} sourceTrees
*/
DrivenApp.prototype._addAppTests = function(sourceTrees) {
  if (this.tests) {
    var tests = this.addonPreprocessTree('test', this._processedTestsTree());
    var preprocessedTests = preprocessJs(tests, '/tests', this.name, {
      registry: this.registry
    });

    sourceTrees.push(this.addonPostprocessTree('test', preprocessedTests));

    if (this.hinting) {
      var jshintedApp = this.addonLintTree('app', this._filterAppTree());
      var jshintedTests = this.addonLintTree('tests', this.trees.tests);

      jshintedApp = new Babel(new Funnel(jshintedApp, {
        srcDir: '/',
        destDir: this.name + '/tests/',
        annotation: 'Funnel (jshint app)'
      }), this._prunedBabelOptions());


      jshintedTests = new Babel(new Funnel(jshintedTests, {
        srcDir: '/',
        destDir: this.name + '/tests/',
        annotation: 'Funnel (jshint tests)'
      }), this._prunedBabelOptions());

      sourceTrees.push(jshintedApp);
      sourceTrees.push(jshintedTests);
    }
  }
};

/**
 * @private
 * @param  {String} addonName The name of the addon we are checking to see if it's installed
 * @return {Boolean}
 */
DrivenApp.prototype._addonInstalled = function(addonName) {
  return !!this.registry.availablePlugins[addonName];
};

/**
 * @private
 *
 * Prunes ember-cli-babel options
 * @return {Object} The pruned babel-options
 */
DrivenApp.prototype._prunedBabelOptions = function() {
  var babelOptions = merge({}, this.options.babel);
  delete babelOptions.compileModules;
  return babelOptions;
};

/**
  Returns the tree for javascript files

  @private
  @method javascript
  @return {Tree} Merged tree
*/
DrivenApp.prototype.javascript = function() {
  var applicationJs       = this.appAndDependencies();
  var legacyFilesToAppend = this.legacyFilesToAppend;
  var appOutputPath       = this.options.outputPaths.app.js;
  var appJs = applicationJs;

  // Note: If ember-cli-babel is installed we have already performed the transpilation at this point
  if (!this._addonInstalled('ember-cli-babel')) {
    appJs = new Babel(
      new Funnel(applicationJs, {
        include: [escapeRegExp(this.name + '/') + '**/*.js'],
        annotation: 'Funnel: App JS Files'
      }),
      merge(this._prunedBabelOptions())
    );
  }

  appJs = mergeTrees([
    appJs,
    this._processedDrivenCLITree()
  ], {
    annotation: 'TreeMerger (appJS  & processedDrivenCLITree)',
    overwrite: true
  });

  appJs = this.concatFiles(appJs, {
    inputFiles: [this.name + '/**/*.js'],
    headerFiles: [
      'vendor/driven-cli/app-prefix.js'
    ],
    footerFiles: [
      'vendor/driven-cli/app-suffix.js',
      'vendor/driven-cli/app-boot.js'
    ],
    outputFile: appOutputPath,
    annotation: 'Concat: App'
  });

  var inputFiles = ['vendor/driven-cli/vendor-prefix.js']
    .concat(legacyFilesToAppend)
    .concat('vendor/addons.js')
    .concat('vendor/driven-cli/vendor-suffix.js');

  var vendor = this.concatFiles(applicationJs, {
    inputFiles: inputFiles,
    outputFile: this.options.outputPaths.vendor.js,
    separator: EOL + ';',
    annotation: 'Concat: Vendor'
  });

  return mergeTrees([
      vendor,
      appJs
    ], {
      annotation: 'TreeMerger (vendor & appJS)'
    });
};



/**
  Returns the tree for test files

  @private
  @method testFiles
  @return {Tree} Merged tree for test files
 */
DrivenApp.prototype.testFiles = function() {
  var testSupportPath = this.options.outputPaths.testSupport.js;
  var testLoaderPath = this.options.outputPaths.testSupport.js.testLoader;

  testSupportPath = testSupportPath.testSupport || testSupportPath;

  var external = this._processedExternalTree();

  var drivenCLITree = this._processedDrivenCLITree();

  var testJs = this.concatFiles(external, {
    inputFiles: this.legacyTestFilesToAppend,
    outputFile: testSupportPath,
    annotation: 'Concat: Test Support JS'
  });

  testJs = this.concatFiles(mergeTrees([testJs, drivenCLITree]), {
    inputFiles: [
      'vendor/driven-cli/test-support-prefix.js',
      testSupportPath.slice(1),
      'vendor/driven-cli/test-support-suffix.js'
    ],
    outputFile: testSupportPath,
    annotation: 'Concat: Test Support Suffix'
  });

  var testemPath = path.join(__dirname, 'testem');
  testemPath = path.dirname(testemPath);

  var testemTree = new Funnel(new UnwatchedDir(testemPath), {
      files: ['testem.js'],
      srcDir: '/',
      destDir: '/',
      annotation: 'Funnel (testem)'
    });

  if (this.options.fingerprint && this.options.fingerprint.exclude) {
    this.options.fingerprint.exclude.push('testem');
  }

  var sourceTrees = [
    testJs,
    testemTree
  ];

  if (this.vendorTestStaticStyles.length > 0) {
    sourceTrees.push(
      this.concatFiles(external, {
        inputFiles: this.vendorTestStaticStyles,
        outputFile: this.options.outputPaths.testSupport.css,
        annotation: 'Concat: Test Support CSS'
      })
    );
  }

  return mergeTrees(sourceTrees, {
      overwrite: true,
      annotation: 'TreeMerger (testFiles)'
    });
};

/**
  Returns the tree for the additional assets which are not in
  one of the default trees.

  @private
  @method otherAssets
  @return {Tree} Merged tree for other assets
 */
DrivenApp.prototype.otherAssets = function() {
  var external = this._processedExternalTree();
  var otherAssetTrees = this.otherAssetPaths.map(function (path) {
    return new Funnel(external, {
      srcDir: path.src,
      files: [path.file],
      destDir: path.dest,
      annotation: 'Funnel (otherAssets)'
    });
  });
  return mergeTrees(otherAssetTrees, {
    annotation: 'TreeMerger (otherAssetTrees)'
  });
};

/**
  @public
  @method dependencies
  @return {Object} Alias to the project's dependencies function
*/
DrivenApp.prototype.dependencies = function(pkg) {
  return this.project.dependencies(pkg);
};

/**
  Imports an asset into the application.

  Options:
  - type - Either 'vendor' or 'test', defaults to 'vendor'
  - prepend - Whether or not this asset should be prepended, defaults to false
  - destDir - Destination directory, defaults to the name of the directory the asset is in

  @public
  @method import
  @param  {(Object|String)}  asset   Either a path to the asset or an object with envirnoment names and paths as key-value pairs.
  @param  {Object=} options Options object
 */
DrivenApp.prototype.import = function(asset, options) {
  var assetPath = this._getAssetPath(asset);

  if (!assetPath) {
    return;
  }

  options = defaults(options || {}, {
    type: 'vendor',
    prepend: false
  });

  var directory    = path.dirname(assetPath);
  var extension    = path.extname(assetPath);

  if (!extension) {
    throw new Error('You must pass a file to `app.import`. For directories specify them to the constructor under the `trees` option.');
  }

  this._import(
    assetPath,
    options,
    directory,
    extension
  );
};

/**
  @private
  @method _import
  @param {String} assetPath
  @param {Object} options
  @param {String} directory
  @param {String} subdirectory
  @param {String} extension
 */
DrivenApp.prototype._import = function(assetPath, options, directory, subdirectory, extension) {
  var basename = path.basename(assetPath);

  if (isType(assetPath, 'js', {registry: this.registry})) {
    if(options.type === 'vendor') {
      if (options.prepend) {
        this.legacyFilesToAppend.unshift(assetPath);
      } else {
        this.legacyFilesToAppend.push(assetPath);
      }
    } else if (options.type === 'test' ) {
      this.legacyTestFilesToAppend.push(assetPath);
    } else {
      throw new Error( 'You must pass either `vendor` or `test` for options.type in your call to `app.import` for file: '+basename );
    }
  } else {
    var destDir = options.destDir;
    if (destDir === '') {
      destDir = '/';
    }
    this.otherAssetPaths.push({
      src: directory,
      file: basename,
      dest: destDir || subdirectory
    });
  }
};

/**
  @private
  @method _getAssetPath
  @param {(Object|String)} asset
  @return {(String|undefined)} assetPath
 */
DrivenApp.prototype._getAssetPath = function(asset) {
  /** @type {String} */
  var assetPath;

  if (typeof asset === 'object') {
    if (this.env in asset) {
      assetPath = asset[this.env];
    } else {
      assetPath = asset.development;
    }
  } else {
    assetPath = asset;
  }

  if (!assetPath) {
    return;
  }

  assetPath = assetPath.replace(path.sep, '/');

  if (assetPath.split('/').length < 2) {
    console.log(chalk.red('Using `app.import` with a file in the root of `vendor/` causes a significant performance penalty. Please move `'+ assetPath + '` into a subdirectory.'));
  }

  if (/[\*\,]/.test(assetPath)) {
    throw new Error('You must pass a file path (without glob pattern) to `app.import`.  path was: `' + assetPath + '`');
  }

  return assetPath;
};

/**
  Returns an array of trees for this application

  @private
  @method toArray
  @return {Array} An array of trees
 */
DrivenApp.prototype.toArray = function() {
  var sourceTrees = [
    this.index(),
    this.javascript(),
    this.otherAssets(),
    this.publicTree()
  ];

  if (this.tests) {
    sourceTrees = sourceTrees.concat(this.testIndex(), this.testFiles());
  }

  return sourceTrees;
};

/**
  Returns the merged tree for this application

  @public
  @method toTree
  @param  {Array} additionalTrees Array of additional trees to merge
  @return {Tree}                  Merged tree for this application
 */
DrivenApp.prototype.toTree = function(additionalTrees) {
  var tree = mergeTrees(this.toArray().concat(additionalTrees || []), {
    overwrite: true,
    annotation: 'TreeMerger (allTrees)'
  });

  return this.addonPostprocessTree('all', tree);
};
