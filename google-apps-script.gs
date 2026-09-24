/**
 * AI Creator Summit — lead capture endpoint for Google Sheets
 *
 * ─────────────────────────────────────────────────────────────
 * SETUP — do this once, in this order
 *
 * 1. Extensions -> Apps Script. Delete whatever is in the editor, paste
 *    this whole file, and SAVE (Ctrl+S). Apps Script deploys the SAVED
 *    version, so deploying with unsaved changes ships the old code.
 *
 * 2. Project Settings (gear, left side) -> Script Properties. Add:
 *      SHEET_ID             the long id from your Sheet's URL
 *      CASHFREE_APP_ID      from Cashfree -> Developers -> API Keys
 *      CASHFREE_SECRET_KEY  the same page
 *      CASHFREE_ENV         sandbox, then production when you go live
 *    Nothing account-specific belongs in the code itself.
 *
 * 3. In the function dropdown at the top pick "setupSheet" and press Run.
 *    Authorise when Google asks (it warns the app is unverified — that is
 *    normal for your own script; Advanced -> Go to <project>).
 *    This creates the "Leads" tab with every column heading, formatted.
 *
 * 4. Pick "sendTestLead" and press Run. A row named TEST LEAD appears in
 *    the sheet. That proves the sheet side works. Delete the row after.
 *
 * 5. Deploy -> New deployment -> gear icon -> Web app.
 *      Execute as:      Me
 *      Who has access:  Anyone      <-- must be "Anyone", NOT "Anyone with
 *                                       a Google account", or the landing
 *                                       page cannot post.
 *    Deploy, then copy the Web app URL. It ends in /exec.
 *
 * 6. Paste that URL into LEAD_WEBHOOK_URL at the top of lead-capture.js.
 *
 * AFTER ANY LATER EDIT to this file:
 *   Deploy -> Manage deployments -> pencil (edit) -> Version: New version
 *   -> Deploy.
 * Do NOT use "New deployment" again — that makes a brand new URL, and the
 * website keeps posting to the old one.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * The long id from your Sheet's URL, between /d/ and /edit:
 *   https://docs.google.com/spreadsheets/d/THIS_PART_HERE/edit
 *
 * Leave it empty here and set it as the Script Property SHEET_ID instead —
 * that way this file can be copied straight out of the repository with
 * nothing to edit, and your sheet id is not published with it.
 *
 * Only a script created from inside the Sheet itself (Extensions -> Apps
 * Script) can do without it entirely.
 */
var SHEET_ID = "";

function sheetId_() {
  if (SHEET_ID) return SHEET_ID;
  return PropertiesService.getScriptProperties().getProperty("SHEET_ID") || "";
}

var SHEET_NAME = "Leads";

/* ==========================================
   CASHFREE

   The keys are NOT written here. This file lives in a public repository,
   and a secret key in it would let anyone charge or refund on your account.

   Put them in Apps Script instead:
     Project Settings (gear, left side) -> Script Properties -> Add
       CASHFREE_APP_ID      your App ID
       CASHFREE_SECRET_KEY  your Secret Key
       CASHFREE_ENV         sandbox   (change to production when live)

   Script Properties are stored with the project and are never served to a
   browser, so the secret stays on Google's side of the call.
   ========================================== */

/** What a seat costs, in rupees. Keep this in step with the landing page. */
var ORDER_AMOUNT = 9;

/** Where Cashfree sends the visitor back after payment. */
var RETURN_URL = "https://summit.aibuddiess.com/thank-you.html?order_id={order_id}";

/** Cashfree's API version. Changing this changes the request shape. */
var CASHFREE_API_VERSION = "2023-08-01";

function cashfreeConfig_() {
  var props = PropertiesService.getScriptProperties();
  var env = (props.getProperty("CASHFREE_ENV") || "sandbox").toLowerCase();
  return {
    appId: props.getProperty("CASHFREE_APP_ID") || "",
    secret: props.getProperty("CASHFREE_SECRET_KEY") || "",
    env: env,
    base: env === "production" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com"
  };
}

/**
 * The sheet's columns, in order.
 *
 * New columns are always added at the END of this list, never inserted in
 * the middle — rows already written stay lined up with their headings that
 * way. Anything you add yourself to the right of the last column is left
 * alone by this script, so a "Joined group?" or "Attended?" column of your
 * own is safe here.
 */
var COLUMNS = [
  "Received At",     // when the sheet recorded it
  "Name",
  "Phone",
  "Email",
  "Segment",         // what they picked in the form
  "Summit Date",
  "Submitted At",    // when they pressed register, from their browser
  "Source",          // utm_source   — facebook / google / instagram ...
  "Medium",          // utm_medium   — cpc / paid_social / email ...
  "Campaign",        // utm_campaign — your campaign name
  "Content",         // utm_content  — which creative / ad
  "Term",            // utm_term     — keyword, if any
  "Referrer",        // the page they came from
  "Landing Page",    // the exact URL they landed on, with its parameters
  "Lead ID",         // unique per registration; used to block duplicates
  "Device",          // Mobile / Tablet / Desktop
  "FB Click ID",     // fbclid — matches the lead back to the Meta click
  "Google Click ID", // gclid
  "Channel",         // always filled: utm_source, else the referring site,
                     // else "direct" — use this one for counting
  "Payment Status",  // PAID / PENDING / FAILED — only PAID is a real seat
  "Order ID",        // the Cashfree order this registration created
  "Amount Paid",
  "Paid At"
];

/** Column widths, so the sheet is readable without dragging anything. */
var COLUMN_WIDTHS = {
  "Received At": 160,
  "Name": 170,
  "Phone": 130,
  "Email": 220,
  "Segment": 160,
  "Summit Date": 200,
  "Submitted At": 190,
  "Referrer": 220,
  "Landing Page": 260,
  "Lead ID": 240,
  "FB Click ID": 200,
  "Google Click ID": 200,
  "Channel": 140,
  "Payment Status": 130,
  "Order ID": 240,
  "Amount Paid": 110,
  "Paid At": 160
};

/* ==========================================
   RUN THESE BY HAND, ONCE
   ========================================== */

/**
 * Creates the "Leads" tab with all headings, or repairs the headings of a
 * tab that already exists. Safe to run again at any time — it never
 * touches rows that are already there.
 */
function setupSheet() {
  var sheet = getSheet_();
  SpreadsheetApp.flush();
  var msg = 'Ready. Tab "' + SHEET_NAME + '" has ' + COLUMNS.length +
            ' columns and ' + Math.max(sheet.getLastRow() - 1, 0) + ' lead rows.';
  Logger.log(msg);
  return msg;
}

/**
 * Writes one fake row so you can see the whole path working before any real
 * traffic arrives. Delete the row afterwards.
 */
function sendTestLead() {
  var sheet = getSheet_();
  writeLead_(sheet, {
    id: "test-" + Date.now(),
    name: "TEST LEAD — delete me",
    phone: "+919999999999",
    email: "test@example.com",
    segment: "Test",
    summitDate: "Sunday, 4 October 2026",
    timestamp: new Date().toISOString(),
    utm_source: "facebook",
    utm_medium: "cpc",
    utm_campaign: "test-campaign",
    utm_content: "test-creative",
    utm_term: "",
    referrer: "https://www.facebook.com/",
    page: "https://example.com/webinar?utm_source=facebook",
    device: "Mobile",
    fbclid: "TEST_FBCLID",
    gclid: "",
    channel: "facebook"
  });
  SpreadsheetApp.flush();
  Logger.log("Test row written. Check the Leads tab, then delete that row.");
}

/* ==========================================
   THE ENDPOINT
   ========================================== */

function doPost(e) {
  // Serialise writes. Two people registering in the same second would
  // otherwise both read the same last row and one would overwrite the other.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: "busy" });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: "empty body" });
    }

    var body = JSON.parse(e.postData.contents);

    // Payment actions are named; a plain body is a lead, as it always was.
    if (body.action === "createOrder") return createOrder_(body.lead || {});
    if (body.action === "verifyOrder") return verifyOrder_(body.order_id, body.lead || {});

    var lead = body;
    var sheet = getSheet_();

    // The page retries anything it could not confirm was delivered, so the
    // same lead can legitimately arrive twice. Skip it if we already have it.
    if (lead.id && hasLeadId_(sheet, lead.id)) {
      return json_({ ok: true, duplicate: true });
    }

    writeLead_(sheet, lead);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Lets you open the /exec URL in a browser to check the deployment is live. */
function doGet() {
  return json_({ ok: true, service: "AI Creator Summit lead capture" });
}

/* ==========================================
   CASHFREE — CREATING AND CHECKING AN ORDER
   ========================================== */

/**
 * Creates the Cashfree order and hands back the session id the browser needs
 * to open checkout.
 *
 * This has to happen here rather than in the page because it is signed with
 * the secret key. Everything the browser gets back — the session id — is
 * single-use and useless for anything else.
 */
function createOrder_(lead) {
  var cf = cashfreeConfig_();
  if (!cf.appId || !cf.secret) {
    return json_({ ok: false, error: "Cashfree keys are not set in Script Properties" });
  }

  var leadId = String(lead.id || "").replace(/[^A-Za-z0-9_-]/g, "");
  if (!leadId) return json_({ ok: false, error: "missing lead id" });

  // A failed payment cannot reuse its order id, so a retry gets a fresh one
  // while the lead id stays the thread back to the row in the sheet.
  var orderId = "acs-" + leadId + "-" + String(Date.now()).slice(-6);

  // Cashfree wants a bare 10-digit Indian number, not a +91 prefix.
  var phone = String(lead.phone || "").replace(/\D/g, "").slice(-10);

  var payload = {
    order_id: orderId,
    order_amount: ORDER_AMOUNT,
    order_currency: "INR",
    customer_details: {
      customer_id: leadId,
      customer_name: String(lead.name || "").slice(0, 100),
      customer_email: String(lead.email || ""),
      customer_phone: phone
    },
    order_meta: { return_url: RETURN_URL },
    order_note: "AI Creator Summit seat",
    order_tags: { lead_id: leadId }
  };

  var res = cashfreeFetch_(cf, "/pg/orders", "post", payload);
  if (!res.ok) return json_({ ok: false, error: res.error });

  if (!res.body.payment_session_id) {
    return json_({ ok: false, error: res.body.message || "no payment session returned" });
  }

  return json_({
    ok: true,
    order_id: orderId,
    payment_session_id: res.body.payment_session_id,
    mode: cf.env
  });
}

/**
 * Asks Cashfree what actually happened to an order, and records it.
 *
 * The browser is never trusted for this. A visitor can put anything in the
 * address bar, so the only thing that decides whether a seat is real is what
 * Cashfree says when we ask it directly.
 */
function verifyOrder_(orderId, lead) {
  var cf = cashfreeConfig_();
  if (!cf.appId || !cf.secret) {
    return json_({ ok: false, error: "Cashfree keys are not set in Script Properties" });
  }
  if (!orderId) return json_({ ok: false, error: "missing order id" });

  var safeId = String(orderId).replace(/[^A-Za-z0-9_-]/g, "");
  var res = cashfreeFetch_(cf, "/pg/orders/" + encodeURIComponent(safeId), "get", null);
  if (!res.ok) return json_({ ok: false, error: res.error });

  var status = res.body.order_status || "UNKNOWN";
  var paid = status === "PAID";

  if (paid) {
    recordPayment_(lead, {
      status: status,
      orderId: safeId,
      amount: res.body.order_amount
    });
  }

  return json_({ ok: true, paid: paid, status: status, order_id: safeId });
}

/** One place for the signed call, so the headers cannot drift apart. */
function cashfreeFetch_(cf, path, method, payload) {
  var options = {
    method: method,
    contentType: "application/json",
    headers: {
      "x-client-id": cf.appId,
      "x-client-secret": cf.secret,
      "x-api-version": CASHFREE_API_VERSION
    },
    muteHttpExceptions: true
  };
  if (payload) options.payload = JSON.stringify(payload);

  try {
    var response = UrlFetchApp.fetch(cf.base + path, options);
    var code = response.getResponseCode();
    var text = response.getContentText();
    var body;
    try {
      body = JSON.parse(text);
    } catch (err) {
      return { ok: false, error: "Cashfree returned a non-JSON reply (" + code + ")" };
    }
    if (code < 200 || code >= 300) {
      return { ok: false, error: body.message || ("Cashfree error " + code) };
    }
    return { ok: true, body: body };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Marks the registration paid.
 *
 * The lead row may not be in the sheet yet — the browser can reach the
 * confirmation page before the queued registration has been delivered — so
 * a missing row is written rather than dropped. Either way the seat ends up
 * recorded exactly once.
 */
function recordPayment_(lead, payment) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return;
  }

  try {
    var sheet = getSheet_();
    var row = findRowByLeadId_(sheet, lead.id);

    if (!row) {
      writeLead_(sheet, lead);
      row = findRowByLeadId_(sheet, lead.id);
      if (!row) return;
    }

    var first = COLUMNS.indexOf("Payment Status") + 1;
    sheet.getRange(row, first, 1, 4).setValues([[
      payment.status,
      payment.orderId,
      payment.amount,
      new Date()
    ]]);
  } catch (err) {
    // Nothing useful to do; the payment itself already succeeded.
  } finally {
    lock.releaseLock();
  }
}

function findRowByLeadId_(sheet, id) {
  if (!id) return 0;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  var idColumn = COLUMNS.indexOf("Lead ID") + 1;
  var values = sheet.getRange(2, idColumn, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === id) return i + 2;
  }
  return 0;
}

/* ==========================================
   INTERNALS
   ========================================== */

function writeLead_(sheet, lead) {
  sheet.appendRow([
    new Date(),
    lead.name || "",
    // Keep the leading + readable instead of letting Sheets treat it as a formula
    lead.phone ? "'" + lead.phone : "",
    lead.email || "",
    lead.segment || "",
    lead.summitDate || "",
    lead.timestamp || "",
    lead.utm_source || "",
    lead.utm_medium || "",
    lead.utm_campaign || "",
    lead.utm_content || "",
    lead.utm_term || "",
    lead.referrer || "",
    lead.page || "",
    lead.id || "",
    lead.device || "",
    lead.fbclid || "",
    lead.gclid || "",
    lead.channel || "",
    lead.paymentStatus || "PENDING",
    lead.orderId || "",
    lead.amountPaid || "",
    lead.paidAt || ""
  ]);
}

function getSheet_() {
  // openById works from a standalone script too; getActiveSpreadsheet only
  // works when the script is bound to the Sheet.
  var id = sheetId_();
  var ss = id
    ? SpreadsheetApp.openById(id)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      "No spreadsheet. This is a standalone script, so add a Script Property " +
      "named SHEET_ID with your Sheet's id."
    );
  }

  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  ensureHeader_(sheet);
  return sheet;
}

/**
 * Makes row 1 match COLUMNS.
 *
 * A tab written by an older version of this file has fewer columns; because
 * new columns are only ever appended, the missing headings can simply be
 * added on the right and every existing row stays correct.
 */
function ensureHeader_(sheet) {
  var lastCol = sheet.getLastColumn();
  var existing = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    : [];

  var needsWrite = false;
  for (var i = 0; i < COLUMNS.length; i++) {
    if (existing[i] !== COLUMNS[i]) {
      needsWrite = true;
      break;
    }
  }
  if (!needsWrite) return;

  sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
  sheet.getRange(1, 1, 1, COLUMNS.length)
    .setFontWeight("bold")
    .setBackground("#1f2937")
    .setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  for (var j = 0; j < COLUMNS.length; j++) {
    var width = COLUMN_WIDTHS[COLUMNS[j]];
    if (width) sheet.setColumnWidth(j + 1, width);
  }
}

function hasLeadId_(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var idColumn = COLUMNS.indexOf("Lead ID") + 1;
  var values = sheet.getRange(2, idColumn, lastRow - 1, 1).getValues();

  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === id) return true;
  }
  return false;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
