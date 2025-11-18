# ScrapingBee Setup Guide

## Overview
ScrapingBee is used to scrape live data for 4 critical CCPI indicators:
1. **Buffett Indicator** - Market Cap / GDP ratio from GuruFocus
2. **Put/Call Ratio** - Options sentiment from BarChart/CBOE
3. **AAII Sentiment** - Retail investor sentiment percentages
4. **Short Interest** - SPY short interest ratio from Finviz

Without ScrapingBee, these indicators fall back to baseline historical averages, which can cause CCPI scores to differ significantly between dev and production environments.

---

## Step 1: Get Your ScrapingBee API Key

1. Go to [scrapingbee.com](https://www.scrapingbee.com/)
2. Log in to your account
3. Navigate to **Account** → **API Key**
4. Copy your API key (starts with `SCRAPINGBEE_API_KEY_...`)

---

## Step 2: Add API Key to Environment Variables

### **For Development (Local)**
Add to your `.env.local` file:
\`\`\`
SCRAPINGBEE_API_KEY=your_api_key_here
\`\`\`

### **For Production (Vercel)**
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project: **options-calculators.com**
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Set:
   - **Key**: `SCRAPINGBEE_API_KEY`
   - **Value**: Your API key
   - **Environment**: Check **Production**, **Preview**, and **Development**
6. Click **Save**
7. **Redeploy** your site for changes to take effect

---

## Step 3: Verify Integration

### **Check Diagnostic Endpoint**
Visit: `https://options-calculators.com/api/scraping-bee/diagnostics`

You should see:
\`\`\`json
{
  "status": "READY",
  "testResult": "SUCCESS",
  "apiKeyConfigured": true,
  "creditsRemaining": "1000"
}
\`\`\`

### **Check CCPI Data Source Status**
Visit: `https://options-calculators.com/`

Scroll to **API Data Source Status** and verify:
- ✅ **Buffett Indicator**: Live (ScrapingBee)
- ✅ **Put/Call Ratio**: Live (ScrapingBee)
- ✅ **AAII Sentiment**: Live (ScrapingBee)
- ✅ **Short Interest**: Live (ScrapingBee)

---

## Troubleshooting

### **Issue: "SCRAPINGBEE_API_KEY environment variable not configured"**
**Solution**: Add the API key to environment variables following Step 2

### **Issue: "ScrapingBee request failed with status 401"**
**Solution**: Your API key is invalid or expired. Get a new key from scrapingbee.com

### **Issue: "ScrapingBee request failed with status 429"**
**Solution**: You've hit your API rate limit. Upgrade your ScrapingBee plan or wait for credits to reset

### **Issue: Dev works but Production shows baseline data**
**Solution**: 
1. Verify API key is added to **Production** environment in Vercel
2. Redeploy the site after adding the key
3. Clear browser cache and hard refresh

### **Issue: CCPI scores differ between dev (83) and production (70)**
**Cause**: Production is using baseline data instead of live data
**Solution**: Add ScrapingBee API key to production environment variables

---

## Credit Usage

Each scraping request costs approximately **1-5 credits** depending on:
- JavaScript rendering (costs more)
- Premium proxy usage (costs more)
- Page complexity

The CCPI calculator makes **4 ScrapingBee requests** per load:
- Buffett Indicator: ~3 credits (JS + premium proxy)
- Put/Call Ratio: ~3 credits (JS + premium proxy)
- AAII Sentiment: ~3 credits (JS + premium proxy)
- Short Interest: ~3 credits (JS + premium proxy)

**Total per CCPI calculation**: ~12-15 credits

**Free tier**: 1,000 credits/month = ~66-83 CCPI calculations
**Paid tier**: 100,000+ credits/month = 6,600+ CCPI calculations

---

## Alternative Data Sources

If you don't want to use ScrapingBee, you can:

1. **Use only API-based data sources** (FRED, Alpha Vantage, Apify) - these 4 indicators will fall back to baseline
2. **Manually input data** - create an admin panel to input these values manually
3. **Self-host scraping** - run your own scraping service (more complex, higher maintenance)

However, for real-time accuracy, ScrapingBee is the recommended solution.

---

## Support

If you continue to experience issues:
1. Check [scrapingbee.com/documentation](https://www.scrapingbee.com/documentation/)
2. Contact ScrapingBee support
3. Check the diagnostic endpoint for detailed error messages
