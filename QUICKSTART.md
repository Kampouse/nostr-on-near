# Quick Start

## Deploy in 5 Minutes

```bash
# 1. Clone
git clone https://github.com/Kampouse/nostr-on-near.git
cd nostr-on-near

# 2. Install
npm install

# 3. Configure
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your NEAR relayer credentials

# 4. Deploy
npm run deploy

# 5. Use
# In any Nostr client, add remote signer:
# bunker://alice.near@nostr-on-near.your-subdomain.workers.dev
```

## What You Get

✅ Every NEAR account = Nostr identity
✅ Zero key management
✅ Gasless signing
✅ Works with Damus, Snort, Amethyst, etc.

## Architecture

```
User → Nostr Client → Bunker (Cloudflare) → NEAR MPC → Signed Event
```

## Files

- `worker.js` - Main Cloudflare Worker (NIP-46 server)
- `wrangler.toml` - Deployment config
- `test-client.js` - Test script
- `README.md` - Full documentation
- `DEPLOY.md` - Step-by-step deployment guide

## Cost

$0-1/month (FREE Cloudflare tier + minimal NEAR gas)

## Support

- GitHub: https://github.com/Kampouse/nostr-on-near
- Issues: https://github.com/Kampouse/nostr-on-near/issues
