const lib = require('lib')({token: process.env.STDLIB_TOKEN});

/**
* merge.js
*
*   Basic example action handler. Called in response to an input from an
*     interactive message.
*   All Actions in response to interactive messages use this template, simply
*   create additional files with different names to add actions.
*
*   See https://api.slack.com/docs/message-buttons for more details.
*
* @param {string} user The user id of the user that invoked this command (name is usable as well)
* @param {string} channel The channel id the command was executed in (name is usable as well)
* @param {object} action The full Slack action object
* @param {string} botToken The bot token for the Slack bot you have activated
* @returns {object}
*/
module.exports = (user, channel, action = {}, botToken = null, callback) => {
    console.log("In the merge actions function")
  // Slack does not permit array parameters to be passed in normally -- you must
  // convert them into strings.
  callback(null, {
    text: `Hello, <@${user}>!\nThis text will overwrite the original interactive message`,
   
  });

};
