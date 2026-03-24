# Deployment Guide

## Prerequisites

1. **Cloudflare Account** (FREE)
   - Sign up at https://dash.cloudflare.com/sign-up
   
2. **NEAR Account** (for relayer)
   - Create at https://wallet.mainnet.near.org
   - Fund with ~1 NEAR for gas

3. **Node.js** (v18+)
   - Install from https://nodejs.org

---

## Step 1: Clone and Install

```bash
cd nostr-on-near
npm install
```

---

## Step 2: Configure Relayer

### Option A: Use Existing Account

```bash
# Login to NEAR CLI
near login

# Export your key
near account export-account <your-account>.near
```

### Option B: Create New Relayer Account

```bash
# Create account
near create-account relayer.near --masterAccount your-account.near

# Fund with NEAR
near send your-account.near relayer.near 1
```

---

## Step 3: Set Environment Variables

### For Local Development

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:
```
RELAYER_ACCOUNT_ID=relayer.near
RELAYER_PRIVATE_KEY=ed25519:...
```

### For Production (Cloudflare)

```bash
# Set secrets
wrangler secret put RELAYER_ACCOUNT_ID
# Enter: relayer.near

wrangler secret put RELAYER_PRIVATE_KEY
# Enter: ed25519:...
```

---

## Step 4: Deploy

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

Output:
```
✨ Success! Uploaded <name>
✨ Deployed to: https://nostr-on-near.your-subdomain.workers.dev
```

---

## Step 5: Test

### Local Test

```bash
# Terminal 1: Start worker
npm run dev

# Terminal 2: Run test client
node test-client.js alice.near ws://localhost:8787/alice.near
```

### Production Test

```bash
# Update test-client.js with your worker URL
node test-client.js alice.near wss://nostr-on-near.your-subdomain.workers.dev/alice.near
```

---

## Step 6: Use with Nostr Clients

### Damus (iOS)

1. Open Damus
2. Settings → Sign In → Remote Signer
3. Enter: `bunker://alice.near@nostr-on-near.your-subdomain.workers.dev`
4. First time: Visit auth URL → Login with NEAR
5. ✓ Connected

### Snort (Web)

1. Open https://snort.social
2. Settings → Add Remote Signer
3. Enter: `bunker://alice.near@nostr-on-near.your-subdomain.workers.dev`
4. First time: Visit auth URL → Login with NEAR
5. ✓ Connected

### Amethyst (Android)

1. Open Amethyst
2. Settings → Sign In → Remote Signer
3. Enter: `bunker://alice.near@nostr-on-near.your-subdomain.workers.dev`
4. First time: Visit auth URL → Login with NEAR
5. ✓ Connected

---

## Step 7: Custom Domain (Optional)

```bash
# Add custom domain
wrangler domains add bunker.yourdomain.com

# Update DNS
# Add CNAME record: bunker → your-subdomain.workers.dev

# Update bunker URLs:
bunker://alice.near@bunker.yourdomain.com
```

---

## Monitoring

### View Logs

```bash
npm run tail
```

### Check Status

```bash
curl https://nostr-on-near.your-subdomain.workers.dev
```

---

## Troubleshooting

### Error: "Relayer not configured"

**Cause:** Missing environment variables

**Fix:**
```bash
wrangler secret put RELAYER_ACCOUNT_ID
wrangler secret put RELAYER_PRIVATE_KEY
```

### Error: "Not authenticated"

**Cause:** Session expired or never created

**Fix:** Visit auth URL and login with NEAR wallet

### WebSocket Connection Failed

**Cause:** Wrong URL format

**Fix:** Use `wss://` for production, `ws://` for local

---

## Cost Breakdown

| Item | Cost |
|------|------|
| Cloudflare Workers | FREE (100k requests/day) |
| NEAR gas | ~0.001 NEAR/signature |
| Custom domain | $10/year (optional) |
| **Monthly total** | **$0-1** |

---

## Next Steps

- [ ] Add NIP-04 encryption support
- [ ] Implement rate limiting
- [ ] Add session revocation UI
- [ ] Set up multiple relayer accounts
- [ ] Add usage analytics

---

## Support

- **Issues:** https://github.com/your-username/nostr-on-near/issues
- **Discord:** https://discord.gg/clawd
