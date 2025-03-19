const middlewareSetup = require('./setupWebpackMiddleware');

module.exports = function override(config, env) {
  // Use our custom middleware setup to handle deprecated options
  return middlewareSetup.modifyWebpackConfig(config);
}; 