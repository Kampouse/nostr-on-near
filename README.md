# NEAR + Nostr Bunker

**Every NEAR account is now a Nostr account.**

Zero-infrastructure NIP-46 remote signer using NEAR MPC for key management.

---

## What This Does

- ✅ Every NEAR account gets a deterministic Nostr identity
- ✅ Works with ALL Nostr clients (Damus, Snort, Amethyst, etc.)
- ✅ No private key management
- ✅ Gasless signing (relayer pays)
- ✅ One-time authentication (30-day sessions)
- ✅ Threshold signatures via NEAR MPC

---

## Architecture

```
Nostr Client (Damus/Snort)
         │
         │ NIP-46 Protocol
         │ bunker://alice.near@your-worker.workers.dev
         ▼
┌──────────────────────┐
│  Cloudflare Worker   │
│  (This code)         │
├──────────────────────┤
│ - WebSocket server   │
│ - Auth web page      │
│ - Session manager    │
│ - MPC client         │
└────────┬─────────────┘
         │
         │ NEAR RPC
         ▼
┌──────────────────────┐
│   v1.signer (MPC)    │
│  NEAR Blockchain     │
└──────────────────────┘
```

---

## Quick Deploy

### 1. Install Dependencies

```bash
cd nostr-on-near
npm install
```

### 2. Configure Environment

Create `.dev.vars` for local development:

```bash
RELAYER_ACCOUNT_ID=your-relayer.near
RELAYER_PRIVATE_KEY=ed25519:...
```

### 3. Deploy to Cloudflare

```bash
npm run deploy
```

Result: `https://nostr-on-near.your-subdomain.workers.dev`

### 4. Configure Secrets (Production)

```bash
wrangler secret put RELAYER_ACCOUNT_ID
# Enter: your-relayer.near

wrangler secret put RELAYER_PRIVATE_KEY
# Enter: ed25519:...
```

---

## Usage

### For Users

**1. Open Nostr Client (e.g., Damus, Snort)**

**2. Add Remote Signer**
```
bunker://alice.near@nostr-on-near.your-subdomain.workers.dev
```

**3. First Time: Authenticate**
- Click auth link
- Login with NEAR wallet
- ✓ Authorized for 30 days

**4. Post to Nostr**
- Client requests signature
- Bunker signs via MPC
- Event broadcasted to relays

---

## How It Works

### Key Derivation

Every NEAR account gets a unique Nostr pubkey:

```javascript
// Deterministic derivation
v1.signer.derived_public_key({
  domain: 0,  // ECDSA
  path: "nostr/alice.near"
})

// Result: Always same pubkey for alice.near
// npub1abc123... (never changes)
```

### Signing Flow

```
1. User posts note in Damus
2. Damus sends event to bunker
3. Bunker checks session (authenticated?)
4. Bunker calls v1.signer.sign() via MPC
5. MPC network signs (threshold signature)
6. Bunker returns signature to Damus
7. Damus broadcasts to Nostr relays
```

### Authentication

- **First time:** NEAR wallet login required
- **Session:** Valid for 30 days
- **Re-auth:** Only after session expires

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RELAYER_ACCOUNT_ID` | Yes | NEAR account that pays gas |
| `RELAYER_PRIVATE_KEY` | Yes | Private key for relayer account |

### Relayer Setup

The relayer account needs:
- NEAR balance (~1 NEAR for gas)
- Access to call `v1.signer.sign()`

```bash
# Create relayer account
near create-account relayer.near --masterAccount your-account.near

# Fund with NEAR
near send your-account.near relayer.near 1
```

---

## API Endpoints

### WebSocket (NIP-46)

```
wss://nostr-on-near.workers.dev/alice.near
```

**Methods:**
- `connect` - Initialize connection, returns pubkey
- `get_public_key` - Get Nostr pubkey for account
- `sign_event` - Sign Nostr event (requires auth)
- `nip04_encrypt` - Encrypt message (optional)
- `nip04_decrypt` - Decrypt message (optional)

### HTTP Endpoints

```
GET  /                          - Status
GET  /auth/:accountId           - Auth page
POST /create-session            - Create auth session
```

---

## Development

### Run Locally

```bash
npm run dev
```

Opens: `http://localhost:8787`

### Test WebSocket

```javascript
const ws = new WebSocket('ws://localhost:8787/alice.near');

ws.onopen = () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'get_public_key'
  }));
};

ws.onmessage = (msg) => {
  console.log(JSON.parse(msg.data));
};
```

### View Logs

```bash
npm run tail
```

---

## Cost

| Component | Cost |
|-----------|------|
| Cloudflare Workers | FREE (100k requests/day) |
| NEAR gas (relayer) | ~0.001 NEAR per signature |
| Total monthly | ~$0-1 |

---

## Security

### Key Security
- Private key never exists in full (MPC)
- Split across multiple nodes (threshold)
- No single point of failure

### Authentication
- NEAR wallet signature required
- Session-based (30-day expiry)
- Account verification

### Transport
- TLS/WSS encryption
- Optional NIP-04 for DMs

---

## Limitations

### Current
- NIP-04 encryption not implemented
- Requires funded relayer account
- No rate limiting

### Coming Soon
- NIP-04 support
- Rate limiting
- Multiple relayer accounts
- Session revocation UI

---

## Customization

### Change Session Duration

```javascript
// worker.js
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Change to 7 days:
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
```

### Add Custom Domain

```bash
# Add custom domain
wrangler domains add your-domain.com

# Update bunker URLs:
bunker://alice.near@your-domain.com
```

---

## Troubleshooting

### "Not authenticated" Error

**Cause:** Session expired or never created

**Fix:** Visit auth URL and login with NEAR wallet

### "Relayer not configured" Error

**Cause:** Missing environment variables

**Fix:** 
```bash
wrangler secret put RELAYER_ACCOUNT_ID
wrangler secret put RELAYER_PRIVATE_KEY
```

### WebSocket Connection Failed

**Cause:** Wrong URL format

**Fix:** Use format: `bunker://alice.near@your-worker.workers.dev`

---

## Resources

- **NEAR MPC:** https://github.com/near/mpc
- **NIP-46 (Nostr Connect):** https://github.com/nostr-protocol/nips/blob/master/46.md
- **Cloudflare Workers:** https://developers.cloudflare.com/workers/
- **NEAR API:** https://docs.near.org/api/quickstart

---

## License

MIT

---

## Support

- **Issues:** https://github.com/your-username/nostr-on-near/issues
- **Discord:** https://discord.gg/clawd
- **Twitter:** @openclaw_ai
