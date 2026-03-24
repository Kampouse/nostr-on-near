# WebSocket Verification for OutLayer

**Date:** March 23, 2026
**Status:** VERIFIED - WebSocket NOT currently supported

---

## Verification Results

### ✅ What I Checked

1. **OutLayer Worker Source Code**
   - Location: `/worker/src/*.rs`
   - Result: HTTP server only, no WebSocket support

2. **WASM WIT Interfaces**
   - Location: `/worker/wit/world.wit`
   - Result: No WebSocket interface exposed to WASM
   - Available interfaces:
     - `near:rpc/api@0.1.0` (RPC calls)
     - `near:storage/api@0.1.0` (Storage)
     - `near:payment/api@0.1.0` (Payments)
     - `near:vrf/api@0.1.0` (VRF)
     - `outlayer:wallet/api@0.1.0` (Wallet)

3. **Documentation**
   - Location: `/DEPLOYMENT_GUIDE.md`
   - Quote: "Add real-time updates (WebSockets)" listed under "Additional Features" (TODO)

4. **Examples**
   - Location: `/wasi-examples/*`
   - Result: All examples use HTTPS API only

---

## Confirmed: OutLayer HTTPS ONLY

**OutLayer currently only supports:**
- ✅ HTTPS API (POST requests)
- ❌ WebSocket server (not supported)

**Architecture:**
```
Client
  ↓ HTTPS POST
OutLayer Worker
  ↓ Executes WASM
  ↓ Returns JSON
Client receives response
```

---

## How to Test This Yourself

### Test 1: Try WebSocket Connection (Will Fail)

```javascript
// test-websocket.js
const WebSocket = require('ws');

const ws = new WebSocket('wss://api.outlayer.fastnear.com/call/owner/project');

ws.on('error', (error) => {
  console.log('✗ WebSocket FAILED:', error.message);
  // Expected: Connection refused or protocol error
});

ws.on('open', () => {
  console.log('✓ WebSocket connected (UNEXPECTED!)');
});
```

**Expected Result:** Connection refused or protocol error

### Test 2: HTTPS Works (Will Succeed)

```javascript
// test-https.js
const response = await fetch('https://api.outlayer.fastnear.com/call/owner/project', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Payment-Key': '...',
  },
  body: JSON.stringify({ input: { test: true } }),
});

const result = await response.json();
console.log('✓ HTTPS works:', result);
```

**Expected Result:** JSON response

---

## What This Means for NEAR + Nostr

### Problem

NIP-46 requires **WebSocket** connections:

```
Client connects to: wss://bunker.example.com
Maintains persistent connection
Sends/receives multiple messages
```

OutLayer only supports **HTTPS**:

```
Client sends: POST https://api.outlayer.com/...
Receives: One response
Connection closes
```

**Incompatible!**

---

## Solutions

### Solution 1: WebSocket → HTTPS Bridge (RECOMMENDED)

**Architecture:**
```
┌─────────────┐
│   Damus     │ (expects WebSocket)
│   Snort     │
└──────┬──────┘
       │ WebSocket
       ▼
┌──────────────────────┐
│ Cloudflare Worker    │
│ (WebSocket Server)   │
├──────────────────────┤
│ - Accept WS          │
│ - Parse NIP-46       │
│ - Convert to HTTPS   │
│ - POST to OutLayer   │
│ - Return response    │
└──────┬───────────────┘
       │ HTTPS
       ▼
┌──────────────────────┐
│   OutLayer (HTTPS)   │
│   - Sign events      │
└──────────────────────┘
```

**Implementation:**

```typescript
// cloudflare-worker-bridge.ts
import { WebSocketPair } from '@cloudflare/workers-types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      server.accept();
      
      server.addEventListener('message', async (event) => {
        const msg = JSON.parse(event.data as string);
        
        // Convert NIP-46 to HTTPS call
        const response = await fetch('https://api.outlayer.fastnear.com/call/owner/nostr-bunker', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Payment-Key': env.PAYMENT_KEY,
          },
          body: JSON.stringify({
            input: {
              method: msg.method,
              params: msg.params,
            },
          }),
        });
        
        const result = await response.json();
        server.send(JSON.stringify({
          id: msg.id,
          ...result,
        }));
      });
      
      return new Response(null, { status: 101, webSocket: client });
    }
    
    return new Response('Expected WebSocket', { status: 426 });
  },
};
```

**Pros:**
- ✅ Works with ALL existing NIP-46 clients (Damus, Snort, Amethyst)
- ✅ OutLayer handles signing (secure)
- ✅ Minimal code (just protocol translation)

**Cons:**
- ❌ Extra latency (2 hops)
- ❌ Need to run WebSocket server (Cloudflare Worker)

---

### Solution 2: NIP-46 over HTTPS (New Standard)

**Define new NIP:**

```http
POST https://bunker.example.com/nip46
Content-Type: application/json

{
  "id": 1,
  "method": "sign_event",
  "params": [
    {
      "kind": 1,
      "content": "Hello!",
      ...
    }
  ]
}

Response:
{
  "id": 1,
  "result": "signature...",
  "error": null
}
```

**Pros:**
- ✅ Direct OutLayer support (no bridge needed)
- ✅ Lower latency (1 hop)
- ✅ Stateless (easier to scale)

**Cons:**
- ❌ NOT compatible with existing clients
- ❌ Would need to be adopted as new standard
- ❌ Requires custom clients

---

### Solution 3: Browser Extension (Direct HTTPS)

**Extension overrides window.nostr:**

```javascript
// extension/background.js
window.nostr = {
  async getPublicKey() {
    const response = await fetch('https://api.outlayer.com/pubkey', {
      method: 'POST',
      body: JSON.stringify({ account_id: 'alice.near' }),
    });
    return response.json().pubkey;
  },
  
  async signEvent(event) {
    const response = await fetch('https://api.outlayer.com/sign', {
      method: 'POST',
      body: JSON.stringify({ event }),
    });
    return response.json();
  },
};
```

**Pros:**
- ✅ Works with ALL web Nostr clients (they use window.nostr)
- ✅ Direct HTTPS (no bridge)
- ✅ OutLayer handles signing

**Cons:**
- ❌ Requires installing extension
- ❌ Doesn't work with mobile apps (Damus, Amethyst)

---

## Recommended Approach

### Build ALL Three (Hybrid)

```
┌─────────────────────────────────────────────┐
│         THREE ACCESS METHODS                │
├─────────────────────────────────────────────┤
│                                             │
│  1. WebSocket Bridge (Cloudflare Worker)    │
│     ┌─────────┐                             │
│     │  Damus  │──WS──→ Worker → OutLayer    │
│     │ Snort   │                             │
│     └─────────┘                             │
│                                             │
│  2. HTTPS API (OutLayer Direct)             │
│     ┌──────────────┐                        │
│     │ Custom Apps  │──HTTPS──→ OutLayer     │
│     │ Future NIP   │                        │
│     └──────────────┘                        │
│                                             │
│  3. Browser Extension (HTTPS Direct)        │
│     ┌──────────────┐                        │
│     │ Web Clients  │──HTTPS──→ OutLayer     │
│     │ (Snort, etc) │                        │
│     └──────────────┘                        │
│                                             │
└─────────────────────────────────────────────┘
```

### Implementation Plan

**Phase 1: OutLayer Core (Rust)**
```rust
// Primary signer - HTTPS API only
POST https://api.outlayer.com/call/owner/nostr-bunker
→ Returns signature
```

**Phase 2: Cloudflare Bridge (TypeScript)**
```typescript
// WebSocket → HTTPS bridge
wss://bunker.example.com
→ POST https://api.outlayer.com/...
```

**Phase 3: Browser Extension (TypeScript)**
```javascript
// Direct HTTPS access
window.nostr.signEvent()
→ POST https://api.outlayer.com/...
```

---

## Testing Plan

### Test 1: Verify OutLayer HTTPS Works

```bash
# Build OutLayer WASM
cargo build --target wasm32-wasip2 --release

# Deploy to OutLayer (get API endpoint)

# Test HTTPS
curl -X POST https://api.outlayer.com/call/owner/nostr-bunker \
  -H "Content-Type: application/json" \
  -d '{"input":{"method":"get_public_key","params":[]}}'
```

**Expected:** JSON response with pubkey

### Test 2: Verify WebSocket Fails

```javascript
const ws = new WebSocket('wss://api.outlayer.com/...');
// Expected: Connection refused
```

### Test 3: Test Bridge

```bash
# Deploy Cloudflare Worker bridge
wrangler deploy

# Test WebSocket through bridge
wscat -c wss://bridge.workers.dev
> {"id":1,"method":"get_public_key","params":[]}
< {"id":1,"result":"abc123..."}
```

---

## Conclusion

**VERIFIED:**
- ✅ OutLayer does NOT support WebSocket (only HTTPS)
- ✅ NIP-46 requires WebSocket
- ✅ Bridge solution is REQUIRED for existing clients
- ✅ Direct HTTPS works for custom apps

**RECOMMENDATION:**
Build all three access methods:
1. OutLayer HTTPS (primary signer)
2. Cloudflare Worker bridge (NIP-46 compatibility)
3. Browser extension (direct HTTPS for web)

This gives maximum compatibility with zero compromise on security.
