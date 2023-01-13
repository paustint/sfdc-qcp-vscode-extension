// https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_plugins.meta/cpq_dev_plugins/cpq_plugins_parent.htm

/**
 * This example was taken from SFDC documentation
 * but the code does not conform to modern JS standards
 *
 * 1) It is recommended to use
 *  `line.record.True_Effective_End_Date__c` OVER `line.record['True_Effective_End_Date__c']`
 *
 * 2) You should never use != or == and should always use === and !== (Etc..)
 *
 * 3) You should not put business logic in life-cycle methods (e.x. `onAfterCalculate()`)
 *
 * 4) Use fat arrow function (`=>`) instead of `function()` for anonymous inner functions
 *
 */

export function onAfterCalculate(quote, lineModels) {
  var maxEffectiveEndDate = null;
  var maxEffectiveTerm = 0;
  if (lineModels != null) {
    lineModels.forEach(function(line) {
      var trueEndDate = calculateEndDate(quote, line);
      var trueTerm = getEffectiveSubscriptionTerm(quote, line);
      if (maxEffectiveEndDate == null || maxEffectiveEndDate < trueEndDate) {
        maxEffectiveEndDate = trueEndDate;
      }
      if (maxEffectiveTerm < trueTerm) {
        maxEffectiveTerm = trueTerm;
      }
      line.record['True_Effective_End_Date__c'] = toApexDate(trueEndDate);
      line.record['True_Effective_Term__c'] = trueTerm;
    });
    quote.record['True_Effective_End_Date__c'] = toApexDate(maxEffectiveEndDate);
    quote.record['True_Effective_Term__c'] = maxEffectiveTerm;
  }
}

function calculateEndDate(quote, line) {
  var sd = line.record['SBQQ__EffectiveStartDate__c'];
  var ed = line.record['SBQQ__EffectiveEndDate__c'];
  if (sd != null && ed == null) {
    ed = sd;
    ed.setUTCMonth(ed.getUTCMonth() + getEffectiveSubscriptionTerm(quote, line));
    ed.setUTCDate(ed.getUTCDate() - 1);
  }
  return ed;
}

function getEffectiveSubscriptionTerm(quote, line) {
  var sd = line.record['SBQQ__EffectiveStartDate__c'];
  var ed = line.record['SBQQ__EffectiveEndDate__c'];
  if (sd != null && ed != null) {
    ed.setUTCDate(ed.getUTCDate() + 1);
    return monthsBetween(sd, ed);
  } else if (line.SubscriptionTerm__c != null) {
    return line.SubscriptionTerm__c;
  } else if (quote.SubscriptionTerm__c != null) {
    return quote.SubscriptionTerm__c;
  } else {
    return line.DefaultSubscriptionTerm__c;
  }
}

/**
 * Takes a JS Date object and turns it into a string of the type 'YYYY-MM-DD', which is what Apex is expecting.
 * @param {Date} date The date to be stringified
 * @returns {string}
 */
function toApexDate(/*Date*/ date) {
  if (date == null) {
    return null;
  }
  // Get the ISO formatted date string.
  // This will be formatted: YYYY-MM-DDTHH:mm:ss.sssZ
  var dateIso = date.toISOString();

  // Replace everything after the T with an empty string
  return dateIso.replace(new RegExp('[Tt].*'), '');
}

function monthsBetween(/*Date*/ startDate, /*Date*/ endDate) {
  // If the start date is actually after the end date, reverse the arguments and multiply the result by -1
  if (startDate > endDate) {
    return -1 * this.monthsBetween(endDate, startDate);
  }
  var result = 0;
  // Add the difference in years * 12
  result += (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12;
  // Add the difference in months. Note: If startDate was later in the year than endDate, this value will be
  // subtracted.
  result += endDate.getUTCMonth() - startDate.getUTCMonth();
  return result;
}
