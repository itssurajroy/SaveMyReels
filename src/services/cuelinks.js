const axios = require("axios");
const config = require("../config");

/**
 * Generate a Cuelinks affiliate link for a given product URL.
 * @param {string} url - The product URL
 * @returns {Promise<string>} The affiliate URL or the original URL on failure
 */
async function buildAffiliateLink(url) {
  if (!config.cuelinksApiKey || !config.cuelinksPubId) {
    console.warn("⚠️ Cuelinks API Key or Publisher ID is missing. Returning fallback/original URL.");
    return `https://links2revenue.com/link?url=${encodeURIComponent(url)}&pub_id=${config.cuelinksPubId || "dummy"}`;
  }

  try {
    const response = await axios.post("https://api.cuelinks.com/v2/links.json", {
      link: {
        url: url
      }
    }, {
      headers: {
        "Authorization": `Token token=${config.cuelinksApiKey}`,
        "Content-Type": "application/json"
      },
      timeout: 5000
    });

    if (response.data && response.data.link && response.data.link.affiliate_url) {
      return response.data.link.affiliate_url;
    }
  } catch (err) {
    console.error("❌ Cuelinks API Error:", err.message);
  }

  return `https://links2revenue.com/link?url=${encodeURIComponent(url)}&pub_id=${config.cuelinksPubId}`;
}

module.exports = { buildAffiliateLink };
