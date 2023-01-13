//developer.salesforce.com/docs/atlas.en-us.cpq_dev_plugins.meta/cpq_dev_plugins/cpq_plugins_parent.htm

/*
 * This is a sample plugin for use in the new JavaScript Quote Calculator. It exports all of the methods that
 * the calculator will look for, and documents their parameters and return types.
 *
 * These methods are all optional. One may export any, all, or none of them in order to achieve the desired behavior.
 *
 * Note that the plugin is an ES6 module. It is transpiled via Babel, and thus it is module-scoped by default. One may
 * use any elements of the ES6 language or syntax. However, the plugin must be able to run in both Browser and Node
 * environments. This means that one cannot expect browser global variables such as window to be available.
 */

// SET TO FALSE IN PRODUCTION
const DEBUG = true;

function debug(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

/**
 * This method is called by the calculator when the plugin is initialized.
 * @param {QuoteLineModel[]} quoteLineModels An array containing JS representations of all lines in a quote
 * @returns {Promise}
 */
export function onInit(quoteLineModels) {
  return new Promise((resolve, reject) => {
    // Perform logic here and resolve promise
    resolve();
  });
}

/**
 * This method is called by the calculator before calculation begins, but after formula fields have been evaluated.
 * @param {QuoteModel} quoteModel JS representation of the quote being evaluated
 * @param {QuoteLineModel[]} quoteLineModels An array containing JS representations of all lines in the quote
 * @returns {Promise}
 */
export function onBeforeCalculate(quoteModel, quoteLineModels) {
  return new Promise((resolve, reject) => {
    // Perform logic here and resolve promise
    resolve();
  });
}

function mapRecords(quoteLineModels) {
  return quoteLineModels.map(model => model.record);
}

function logRecords(quoteOrLineModel) {
  // serializing records removes proxy to make debugging easier,
  // BUT is a performance hit, so make sure to disable logging in production to avoid this without code changes
  if (DEBUG) {
    const models = Array.isArray(quoteOrLineModel) ? quoteOrLineModel : [quoteOrLineModel];
    debug(JSON.parse(JSON.stringify(mapRecords(models))));
  }
}

/**
 * Group all quote lines by very top level bundle
 * This is useful when you need to rollup values on a bundle by bundle basis
 */
function groupByTopLevelBundle(quoteLineModels) {
  const bundles = quoteLineModels.reduce((bundles, line) => {
    const parentKey = getParentKey(line);
    if (!bundles[parentKey]) {
      bundles[parentKey] = [];
    }
    bundles[parentKey].push(line);
    return bundles;
  }, {});

  debug('bundles', bundles);
  return bundles;
}

/** recursively get parent key */
function getParentKey(quoteLine) {
  if (quoteLine.parentItem) {
    return getParentKey(quoteLine.parentItem);
  } else {
    return quoteLine.key;
  }
}
