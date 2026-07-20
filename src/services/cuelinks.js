const config = require("../config");

/**
 * Convert any product URL into a Cuelinks Affiliate Link.
 * Supports both Cuelinks V3 API (short clnk.in links) and high-speed fallback redirection builder.
 * 
 * @param {string} merchantUrl - Raw product link (e.g. Amazon / Flipkart product URL)
 * @returns {Promise<string>} Affiliate redirected link
 */
async function buildAffiliateLink(merchantUrl) {
  const apiKey = config.cuelinksApiKey;
  const pubId = config.cuelinksPubId;

  // 1. If API Key is configured, use the Cuelinks V3 shortened Link API
  if (apiKey) {
    try {
      const response = await fetch("https://api.cuelinks.com/v3/links.json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          link: {
            url: merchantUrl
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Cuelinks V3 typically returns { link: { affiliate_url: "https://clnk.in/xxxx" } }
        if (data && data.link && data.link.affiliate_url) {
          return data.link.affiliate_url;
        }
      } else {
        const errText = await response.text();
        console.warn("⚠️ Cuelinks API returned status:", response.status, errText);
      }
    } catch (err) {
      console.error("❌ Cuelinks API Connection failed:", err.message);
    }
  }

  // 2. High-speed fallback direct redirection builder (No API call, 0ms latency, works with Publisher ID)
  if (pubId) {
    const encodedUrl = encodeURIComponent(merchantUrl);
    return `https://cuelinks.com/link?pub_id=${pubId}&url=${encodedUrl}`;
  }

  // 3. If no config is set, return the original URL as a safety fallback
  console.warn("⚠️ Cuelinks credentials missing! Returning original URL.");
  return merchantUrl;
}

module.exports = { buildAffiliateLink };
