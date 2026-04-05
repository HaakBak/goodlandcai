/**
 * Console Guard - Disables all console methods in production
 * This ensures sensitive debugging information never reaches end users
 */

// Only apply in production (when import.meta.env.PROD is true)
if (import.meta.env.PROD) {
  const noop = () => {};
  
  // Override all console methods
  console.log = noop;
  console.debug = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;
  console.trace = noop;
  console.assert = noop;
  console.clear = noop;
  console.count = noop;
  console.countReset = noop;
  console.dir = noop;
  console.dirxml = noop;
  console.group = noop;
  console.groupCollapsed = noop;
  console.groupEnd = noop;
  console.profile = noop;
  console.profileEnd = noop;
  console.table = noop;
  console.time = noop;
  console.timeEnd = noop;
  console.timeLog = noop;
  console.timeStamp = noop;
}

export default {};
