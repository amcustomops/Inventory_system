const { AsyncLocalStorage } = require('async_hooks');

const tenantContext = new AsyncLocalStorage();

module.exports = tenantContext;
