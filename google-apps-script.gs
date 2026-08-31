/**
 * AI Creator Summit — lead capture endpoint for Google Sheets
 *
 * ─────────────────────────────────────────────────────────────
 * SETUP (once, about two minutes)
 *
 * 1. Open the Google Sheet you want the leads in.
 * 2. Extensions → Apps Script. Delete whatever is in the editor and
 *    paste this whole file in. Save.
 * 3. Deploy → New deployment → gear icon → Web app.
 *      Description:  lead capture
 *      Execute as:   Me
 *      Who has access:  Anyone            ← must be "Anyone", not
 *                                           "Anyone with Google account",
 *                                           or the landing page cannot post.
 * 4. Deploy. Authorise when Google asks (it will warn the app is
 *    unverified — that is normal for your own script; choose Advanced →
 *    Go to <project>).
 * 5. Copy the Web app URL. It ends in /exec.
 * 6. Paste it into LEAD_WEBHOOK_URL at the top of lead-capture.js.
 *
 * After ANY later edit to this file you must Deploy → Manage deployments
 * → edit → Version: New version, or the live URL keeps running the old code.
 * ─────────────────────────────────────────────────────────────
 */

var SHEET_NAME = "Leads";

var COLUMNS = [
  "Received At",
  "Name",
  "Phone",
  "Email",
  "Segment",
  "Summit Date",
  "Submitted At",
  "Source",
  "Medium",
  "Campaign",
  "Content",
  "Term",
  "Referrer",
  "Landing Page",
  "Lead ID"
];

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
      lead.id || ""
    ]);

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

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
    sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return sheet;
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
