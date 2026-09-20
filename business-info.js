/**
 * Business details shown on the policy pages.
 *
 * Razorpay's activation review opens the site and looks for a real, reachable
 * business behind it: a name, a postal address, an email and a phone number,
 * on pages linked from the footer. Keeping them here means one edit updates
 * every page instead of five.
 *
 * Anything left empty renders as a loud "TO FILL" marker rather than quietly
 * disappearing — a policy page that is silently missing its address is the
 * thing that fails the review.
 */
const BUSINESS = {
  /** Registered or trading name, exactly as it appears on the bank account. */
  name: "",

  /** Full postal address, including city, state and PIN code. */
  address: "",

  /** Support email. Must be a mailbox someone actually reads. */
  email: "",

  /** Support phone, in international form. */
  phone: "+91 95161 94751",

  /** City whose courts have jurisdiction — normally where you are based. */
  jurisdiction: "",

  /** GSTIN, if you have one. Leave empty if not registered. */
  gstin: ""
};

/** The public face of the product, reused across the policy pages. */
const PRODUCT = {
  name: "AI Creator Summit",
  price: "₹9",
  durationHours: 3,
  platform: "Zoom"
};

document.addEventListener("DOMContentLoaded", renderBusinessInfo);

function renderBusinessInfo() {
  const fill = (selector, value, label) => {
    const nodes = document.querySelectorAll(selector);
    if (!nodes.length) return;

    const text = (value || "").trim();
    nodes.forEach((el) => {
      if (text) {
        el.textContent = text;
        el.classList.remove("biz-missing");
      } else {
        el.textContent = "[ " + label + " — fill this in business-info.js ]";
        el.classList.add("biz-missing");
      }
    });
  };

  fill(".js-biz-name", BUSINESS.name, "business name");
  fill(".js-biz-address", BUSINESS.address, "postal address");
  fill(".js-biz-email", BUSINESS.email, "support email");
  fill(".js-biz-phone", BUSINESS.phone, "support phone");
  fill(".js-biz-jurisdiction", BUSINESS.jurisdiction, "city");

  // The policy pages quote the fee, so it comes from one place too.
  document.querySelectorAll(".js-price").forEach((el) => {
    el.textContent = PRODUCT.price;
  });

  // Email and phone are worth making tappable wherever they appear.
  document.querySelectorAll("a.js-biz-email-link").forEach((a) => {
    if (BUSINESS.email) a.href = "mailto:" + BUSINESS.email;
  });
  document.querySelectorAll("a.js-biz-phone-link").forEach((a) => {
    if (BUSINESS.phone) a.href = "tel:" + BUSINESS.phone.replace(/[^+\d]/g, "");
  });

  // GSTIN is optional, so its whole row disappears when there is none.
  const gstRow = document.querySelector(".js-biz-gstin-row");
  if (gstRow) {
    if (BUSINESS.gstin) {
      const slot = gstRow.querySelector(".js-biz-gstin");
      if (slot) slot.textContent = BUSINESS.gstin;
    } else {
      gstRow.hidden = true;
    }
  }

  // "Last updated" should not be a date someone has to remember to change.
  document.querySelectorAll(".js-legal-updated").forEach((el) => {
    el.textContent = new Date(document.lastModified).toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric"
    });
  });
}
