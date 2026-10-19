import fetch from "node-fetch";
import dns from "dns/promises";

const DISPOSABLE_DOMAINS_URL =
  "https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.txt";

// Core fallback list of common disposable email domains
const fallbackDomains = [
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.net",
  "guerrillamail.org",
  "sharklasers.com",
  "grr.la",
  "guerrillamailblock.com",
  "pokemail.net",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "cool.fr.nf",
  "jetable.fr.nf",
  "nospam.ze.tc",
  "nomail.xl.cx",
  "mega.zik.dj",
  "speed.1s.fr",
  "courriel.fr.nf",
  "moncourrier.fr.nf",
  "monemail.fr.nf",
  "monmail.fr.nf",
  "trashmail.com",
  "trashmail.net",
  "trashmail.me",
  "trashmail.org",
  "trashmail.at",
  "trashmail.io",
  "trashforce.com",
  "fakeinbox.com",
  "getairmail.com",
  "dispostable.com",
  "crazymailing.com",
  "temp-mail.org",
  "temp-mail.io",
  "mytemp.email",
  "tempail.com",
  "mohmal.com",
  "emailondeck.com",
  "burnermail.io",
  "maildrop.cc",
  "inboxkitten.com",
  "minuteinbox.com",
  "generator.email",
  "armyspy.com",
  "cuvox.de",
  "dayrep.com",
  "einrot.com",
  "fleckens.hu",
  "gustr.com",
  "jourrapide.com",
  "rhyta.com",
  "superrito.com",
  "teleworm.us",
];

const disposableDomainsSet = new Set(fallbackDomains.map((d) => d.toLowerCase().trim()));

let isLoaded = false;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // Refresh once every 24 hours

/**
 * Loads and refreshes disposable email domains list from GitHub
 */
export async function loadDisposableDomains() {
  try {
    const res = await fetch(DISPOSABLE_DOMAINS_URL, { timeout: 10000 });
    if (!res.ok) {
      console.warn(`[disposableEmail] Failed to fetch remote domain list: ${res.status}`);
      return;
    }
    const text = await res.text();
    const domains = text
      .split(/\r?\n/)
      .map((d) => d.trim().toLowerCase())
      .filter((d) => d && !d.startsWith("#"));

    for (const domain of domains) {
      disposableDomainsSet.add(domain);
    }
    isLoaded = true;
    lastFetchedAt = Date.now();
    console.log(`[disposableEmail] Loaded ${disposableDomainsSet.size} disposable domains.`);
  } catch (error) {
    console.warn("[disposableEmail] Error fetching disposable domains list:", error?.message);
  }
}

// Trigger initial load on startup asynchronously
loadDisposableDomains();

/**
 * Checks if a given email is from a disposable/temporary email provider
 * @param {string} email
 * @returns {boolean}
 */
export function isDisposableEmail(email) {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return false;
  }

  // If cache is older than 24 hours, trigger background refresh
  if (Date.now() - lastFetchedAt > CACHE_TTL_MS) {
    loadDisposableDomains().catch(() => {});
  }

  const parts = email.split("@");
  const domain = parts[parts.length - 1].toLowerCase().trim();

  return disposableDomainsSet.has(domain);
}

/**
 * Comprehensive email verification:
 * 1. Syntax & Regex validation
 * 2. Purely numeric or invalid domain check (e.g. 98765431.com)
 * 3. Disposable / Temp email check
 * 4. DNS MX lookup to ensure domain exists and accepts email
 */
export async function validateEmailAddress(email) {
  if (!email || typeof email !== "string") {
    return { valid: false, message: "Email is required" };
  }

  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, message: "Please enter a valid email address." };
  }

  const parts = trimmed.split("@");
  const domain = parts[parts.length - 1];

  // Block purely numeric domain names e.g. 98765431.com
  const domainName = domain.split(".")[0];
  if (/^\d+$/.test(domainName)) {
    return {
      valid: false,
      message: "Invalid email domain. Please enter a valid email address.",
    };
  }

  // Check disposable domains
  if (isDisposableEmail(trimmed)) {
    return {
      valid: false,
      message: "Disposable or temporary email addresses are not allowed. Please use a permanent email address.",
    };
  }

  // DNS MX check with 2.5s timeout
  try {
    const mxRecords = await Promise.race([
      dns.resolveMx(domain),
      new Promise((_, reject) => setTimeout(() => reject(new Error("DNS_TIMEOUT")), 2500)),
    ]);

    if (!mxRecords || mxRecords.length === 0) {
      return {
        valid: false,
        message: "This email domain does not accept emails. Please check for typos.",
      };
    }
  } catch (err) {
    if (err.code === "ENOTFOUND" || err.code === "ENODATA" || err.code === "NXDOMAIN") {
      return {
        valid: false,
        message: "This email domain does not exist. Please check your email for typos.",
      };
    }
    // Allow pass-through if DNS times out to prevent blocking users on slow network
  }

  return { valid: true };
}

/**
 * Clean email masking function (e.g. ksravishankar4@gmail.com -> ks***4@gmail.com)
 */
export function maskEmail(email) {
  if (!email || !email.includes("@")) return "";
  const [local, domain] = email.trim().split("@");
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  const prefix = local.slice(0, 2);
  const suffix = local.slice(-1);
  return `${prefix}***${suffix}@${domain}`;
}
