/**
 * Request/Response Logger Middleware
 * Logs all incoming requests and outgoing responses
 */

export const logger = () => {
  return async (c, next) => {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;
    const url = c.req.url;

    // Log request
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📥 INCOMING REQUEST`);
    console.log(`   Method: ${method}`);
    console.log(`   Path: ${path}`);
    console.log(`   URL: ${url}`);
    console.log(`   Time: ${new Date().toISOString()}`);

    // Log query params if present
    const queryParams = c.req.query();
    if (Object.keys(queryParams).length > 0) {
      console.log(`   Query: ${JSON.stringify(queryParams)}`);
    }

    // Log route params if present
    const routeParams = c.req.param();
    if (Object.keys(routeParams).length > 0) {
      console.log(`   Params: ${JSON.stringify(routeParams)}`);
    }

    // Log headers (excluding sensitive ones)
    const headers = {};
    c.req.raw.headers.forEach((value, key) => {
      if (!['authorization', 'cookie', 'api-key'].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    });
    console.log(`   Headers: ${JSON.stringify(headers, null, 2)}`);

    try {
      // Execute request
      await next();

      // Log response
      const duration = Date.now() - start;
      const status = c.res.status;

      console.log(`📤 RESPONSE`);
      console.log(`   Status: ${status}`);
      console.log(`   Duration: ${duration}ms`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (error) {
      // Log error
      const duration = Date.now() - start;

      console.log(`❌ ERROR`);
      console.log(`   Message: ${error.message}`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Stack: ${error.stack}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      throw error;
    }
  };
};

/**
 * Endpoint-specific logger
 * Logs endpoint details with custom message
 */
export const endpointLogger = (endpointName) => {
  return async (c, next) => {
    console.log(`\n🎯 Endpoint: ${endpointName}`);
    await next();
  };
};
