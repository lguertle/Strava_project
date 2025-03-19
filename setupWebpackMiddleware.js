/**
 * This file allows us to customize the webpack dev server middleware configuration
 * to address deprecation warnings for onBeforeSetupMiddleware and onAfterSetupMiddleware
 */

module.exports = {
  // Function to modify the webpack dev server config
  modifyWebpackConfig: function(webpackConfig) {
    // Move any middleware from onBeforeSetupMiddleware and onAfterSetupMiddleware 
    // to the setupMiddlewares property
    
    const setupMiddlewares = (middlewares, devServer) => {
      // Middleware that would have been in onBeforeSetupMiddleware
      if (webpackConfig.onBeforeSetupMiddleware) {
        const beforeFn = webpackConfig.onBeforeSetupMiddleware;
        delete webpackConfig.onBeforeSetupMiddleware;
        beforeFn(devServer);
      }
      
      // Add middlewares here
      
      // Middleware that would have been in onAfterSetupMiddleware
      if (webpackConfig.onAfterSetupMiddleware) {
        const afterFn = webpackConfig.onAfterSetupMiddleware;
        delete webpackConfig.onAfterSetupMiddleware;
        afterFn(devServer);
      }
      
      return middlewares;
    };
    
    // Add the setupMiddlewares function to the webpack config
    if (!webpackConfig.devServer) {
      webpackConfig.devServer = {};
    }
    
    webpackConfig.devServer.setupMiddlewares = setupMiddlewares;
    
    return webpackConfig;
  }
}; 