// https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_plugins.meta/cpq_dev_plugins/cpq_plugins_parent.htm
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

/**
 * This method is called by the calculator when the plugin is initialized.
 * @param {QuoteLineModel[]} quoteLineModels An array containing JS representations of all lines in a quote
 * @returns {Promise}
 */
export function onAfterCalculate(quoteModel, quoteLineModels, conn) {
  return new Promise((resolve, reject) => {
    // Perform logic here and resolve promise

    // Print out conn object so you can look and see what is available to access.
    // NOTE: you should limit the number of calls made, because they must go over the network
    console.log('conn', conn);

    conn
      .query('SELECT Id FROM Account LIMIT 1')
      .then(result => {
        console.log('Query Result', result);
      })
      .catch(err => {
        console.warn('Could not query records', err);
      });

    resolve();
  });
}
