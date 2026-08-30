/**
 * Node entry point.
 *
 * Hostinger (and several other hosts) default their "entry file" to app.js,
 * so this is deliberately the server rather than browser code. The browser
 * script for the landing page lives in landing.js.
 *
 * The implementation is in server.js; app.js, index.js and `npm start` all
 * lead to the same place, so whichever entry the platform picks, it boots.
 */
require("./server.js");
