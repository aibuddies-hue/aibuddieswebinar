/**
 * AI Creator Summit — lead capture endpoint for Google Sheets
 *
 * ─────────────────────────────────────────────────────────────
 * SETUP — do this once, in this order
 *
 * 1. Open your Google Sheet. Copy the long id from its URL, the part
 *    between /d/ and /edit:
 *      https://docs.google.com/spreadsheets/d/THIS_PART_HERE/edit
 *    Paste it into SHEET_ID below.
 *
 * 2. Extensions -> Apps Script. Delete whatever is in the editor, paste
 *    this whole file, and SAVE (Ctrl+S). Apps Script deploys the SAVED
 *    version, so deploying with unsaved changes ships the old code.
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
 * The long id from your Sheet's URL, between /d/ and /edit.
 * You can leave this empty ONLY if this script was created from inside the
 * Sheet itself (Extensions -> Apps Script). Setting it always works.
 */
var SHEET_ID = "";

var SHEET_NAME = "Leads";

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
  "Google Click ID"  // gclid
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
  "Google Click ID": 200
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
    summitDate: "Sunday, 6 September 2026",
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
    gclid: ""
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

    var lead = JSON.parse(e.postData.contents);
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
    lead.gclid || ""
  ]);
}

function getSheet_() {
  // openById works from a standalone script too; getActiveSpreadsheet only
  // works when the script is bound to the Sheet.
  var ss = SHEET_ID
    ? SpreadsheetApp.openById(SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      "No spreadsheet. This is a standalone script, so set SHEET_ID at the top."
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
