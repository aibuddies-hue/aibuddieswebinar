/**
 * Cashfree checkout — shared by the landing page and the confirmation page.
 *
 * Nothing secret lives here. The order is created by the Apps Script web app,
 * which holds the Cashfree keys; this file only asks it for a session id and
 * hands that to Cashfree's own checkout. The page never sees a key, and the
 * session id it does see is single-use.
 *
 * The same reasoning decides who is allowed to say a seat was paid for: not
 * this file. A visitor can type anything into the address bar, so the
 * confirmation page asks Apps Script, which asks Cashfree, and believes only
 * that answer.
 */

/**
 * Turn this off to run a session without charging — the form then goes
 * straight to the confirmation page, as it did before payment existed.
 * Leave it on while the page advertises a price.
 */
const PAYMENT_ENABLED = true;

/** Must match ORDER_AMOUNT in google-apps-script.gs and the price on the page. */
const PAYMENT_AMOUNT = 9;

/** Where the order id is remembered between the two pages. */
const ORDER_KEY = "creator_summit_order";

/**
 * Asks Apps Script to create the order and opens Cashfree checkout.
 *
 * Returns a promise that only resolves if checkout could not be opened —
 * when it does open, the browser leaves this page, so nothing after it runs.
 */
function startPayment(lead) {
  const url = (LEAD_WEBHOOK_URL || "").trim();
  if (!url) return Promise.reject(new Error("Lead webhook URL is not set"));

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "createOrder", lead: lead })
  })
    .then((res) => res.json())
    .then((data) => {
      if (!data || !data.ok) {
        throw new Error((data && data.error) || "Could not start the payment");
      }

      // Remembered so the confirmation page can verify it even if Cashfree
      // returns without the parameter, or the visitor reloads.
      try {
        localStorage.setItem(ORDER_KEY, JSON.stringify({
          order_id: data.order_id,
          lead_id: lead.id,
          created: new Date().toISOString()
        }));
      } catch (err) {
        // Storage unavailable; the return URL still carries the order id.
      }

      if (typeof Cashfree !== "function") {
        throw new Error("Cashfree checkout did not load. Check your connection and try again.");
      }

      const cashfree = Cashfree({ mode: data.mode === "production" ? "production" : "sandbox" });
      return cashfree.checkout({
        paymentSessionId: data.payment_session_id,
        redirectTarget: "_self"
      });
    });
}

/**
 * Asks whether an order was really paid.
 *
 * The lead is sent along so that a payment which lands before the queued
 * registration has been delivered still ends up as one complete row rather
 * than a payment with nobody attached to it.
 */
function verifyPayment(orderId, lead) {
  const url = (LEAD_WEBHOOK_URL || "").trim();
  if (!url || !orderId) return Promise.resolve({ ok: false, paid: false });

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "verifyOrder", order_id: orderId, lead: lead || {} })
  })
    .then((res) => res.json())
    .catch(() => ({ ok: false, paid: false, error: "network" }));
}

/** The order id, from the URL Cashfree returned to or from the last attempt. */
function currentOrderId() {
  const fromUrl = new URLSearchParams(window.location.search).get("order_id");
  if (fromUrl) return fromUrl;

  try {
    const stored = JSON.parse(localStorage.getItem(ORDER_KEY) || "null");
    return stored && stored.order_id ? stored.order_id : "";
  } catch (err) {
    return "";
  }
}

/** Remembers a confirmed payment so a reload does not re-check it. */
function markPaidLocally(orderId) {
  try {
    localStorage.setItem("creator_summit_paid", orderId);
  } catch (err) {
    // Nothing to do; it will simply be verified again.
  }
}

function alreadyPaidLocally(orderId) {
  if (!orderId) return false;
  try {
    return localStorage.getItem("creator_summit_paid") === orderId;
  } catch (err) {
    return false;
  }
}
