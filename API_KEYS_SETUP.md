# API Key Management System

This application uses an encrypted API key management system that allows you to securely store and manage all API keys through the admin dashboard.

## Overview

All API keys are:
- Encrypted using AES-256-GCM encryption before storage
- Stored in a secure encrypted file (`.api-keys.encrypted`)
- Never logged or transmitted unencrypted
- Only accessible by authenticated administrators

## Quick Start

### 1. Access Admin Dashboard

1. Navigate to `https://options-calculators.com/login`
2. Login with your credentials:
   - Email: `joelfrenette@gmail.com`
   - Password: `Japan2025!`

### 2. Configure API Keys

Once logged in, go to the **API Keys Management** section in the admin dashboard.

### Required API Keys

| API Key Name | Purpose | How to Get |
|--------------|---------|------------|
| **POLYGON_API_KEY** | Real-time options and stock data | [polygon.io](https://polygon.io/) - Free tier available |
| **TWELVE_DATA_API_KEY** | Technical indicators and fundamentals | [twelvedata.com](https://twelvedata.com/) - Free tier available |
| **FRED_API_KEY** | Economic data (CPI, Fed Funds Rate) | [research.stlouisfed.org/useraccount/apikeys](https://research.stlouisfed.org/useraccount/apikeys) - Free |
| **APIFY_API_TOKEN** | Web scraping for financial data | [apify.com](https://apify.com/) - Free tier available |
| **RESEND_API_KEY** | Email notifications (password reset) | [resend.com](https://resend.com/) - Free tier available |
| **FMP_API_KEY** | Financial Modeling Prep data (optional) | [financialmodelingprep.com](https://financialmodelingprep.com/) |

### 3. Enter API Keys

1. In the **API Keys Management** section, you'll see input fields for each API key
2. Click the eye icon to toggle visibility while entering keys
3. Enter your API keys (keys are masked after saving for security)
4. Click **Save All API Keys** button

### 4. Verify Keys Are Working

After saving, the system will show "Configured: ****1234" next to each key (showing last 4 characters).

## How It Works

### Encryption

- Uses AES-256-GCM (Galois/Counter Mode) encryption
- Each key has a unique initialization vector (IV)
- Authentication tags prevent tampering
- Encryption key is stored securely in environment variable `ENCRYPTION_KEY`

### Storage

Keys are stored in `.api-keys.encrypted` file with this structure:

\`\`\`json
{
  "POLYGON_API_KEY": "iv:authtag:encrypteddata",
  "TWELVE_DATA_API_KEY": "iv:authtag:encrypteddata"
}
\`\`\`

### Usage in Code

The application uses a secure `getApiKey()` function that:
1. First checks environment variables (for backward compatibility)
2. Then checks encrypted storage
3. Automatically decrypts keys when needed
4. Never exposes keys in logs or responses

\`\`\`typescript
import { getApiKey } from '@/lib/api-keys'

// In your API route
const apiKey = getApiKey('POLYGON_API_KEY')
\`\`\`

## Security Best Practices

### For Development

1. **Never commit** `.api-keys.encrypted` to git (already in `.gitignore`)
2. **Use environment variables** during local development via `.env.local`
3. **Keep your encryption key secure** - without it, encrypted keys cannot be decrypted

### For Production

1. **Set encryption key** as environment variable `ENCRYPTION_KEY` (32 characters)
2. **Backup encrypted keys** regularly using the admin backup feature
3. **Rotate keys periodically** by updating them in the admin dashboard
4. **Monitor access logs** for unauthorized admin access attempts

## Backup & Restore

The admin dashboard includes backup/restore functionality:

### Creating a Backup

1. Go to Admin Dashboard → **Backup & Restore** section
2. Click **Download Backup**
3. Save the ZIP file securely (includes encrypted keys)

### Restoring from Backup

1. Go to Admin Dashboard → **Backup & Restore** section
2. Click **Restore from Backup**
3. Select your backup ZIP file
4. System will restore all files including encrypted keys

## Troubleshooting

### Keys Not Working

1. **Check if keys are configured**: Look for "Configured: ****" status in admin
2. **Verify key format**: Some APIs require specific formats (e.g., `Bearer xxx`)
3. **Check API limits**: Free tier APIs have rate limits
4. **Test individually**: Check debug logs for specific API errors

### "API key not configured" Error

This means the key is not found in either:
- Environment variables
- Encrypted storage file

**Solution**: Add the key via the admin dashboard.

### Encryption Errors

If you see "Cannot decrypt" errors:
- Verify `ENCRYPTION_KEY` environment variable is set correctly
- Check that `.api-keys.encrypted` file exists and is not corrupted
- Restore from backup if necessary

## Migration from Environment Variables

If you're currently using `.env.local` with hardcoded keys:

1. **Save existing keys**: Copy your current API keys
2. **Add to admin dashboard**: Enter them via the API Keys Management UI
3. **Remove from .env**: Delete old API key entries from `.env.local`
4. **Test**: Verify application still works with encrypted keys

## API Providers

### Getting Your Keys

#### Polygon.io (Stock & Options Data)
- Website: https://polygon.io/
- Free tier: 5 API calls/minute
- Paid plans start at $29/month
- Required for: Real-time options chains, stock quotes, greeks

#### TwelveData (Technical Indicators)
- Website: https://twelvedata.com/
- Free tier: 800 requests/day
- Paid plans start at $79/month
- Required for: RSI, MACD, Stochastic indicators

#### FRED (Economic Data)
- Website: https://research.stlouisfed.org/useraccount/apikeys
- Completely free, no limits
- Required for: Fed Funds Rate, CPI inflation data, unemployment

#### Apify (Web Scraping)
- Website: https://apify.com/
- Free tier: $5 monthly credit
- Required for: Supplemental financial data scraping

#### Resend (Email Service)
- Website: https://resend.com/
- Free tier: 100 emails/day
- Required for: Password reset emails

## Support

For issues or questions:
1. Check the browser console for detailed error messages
2. Review API provider documentation
3. Verify API key quotas haven't been exceeded
4. Contact support at vercel.com/help

## Environment Variables Reference

\`\`\`bash
# Required for encryption (32 characters recommended)
ENCRYPTION_KEY="your-32-character-encryption-key"

# Optional: Set these if you want to bypass admin dashboard
POLYGON_API_KEY="your-polygon-key"
TWELVE_DATA_API_KEY="your-twelvedata-key"
FRED_API_KEY="your-fred-key"
APIFY_API_TOKEN="your-apify-token"
RESEND_API_KEY="your-resend-key"
\`\`\`

**Note**: Environment variables take precedence over encrypted storage. This allows you to override specific keys without changing the encrypted file.
