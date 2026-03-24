# OutLayer Investigation - VERIFIED FACTS ONLY

**Date:** March 23, 2026
**Status:** Investigation complete - facts verified from official sources

---

## What I VERIFIED from Official Sources

### ✅ Confirmed TRUE

1. **OutLayer is a TEE-based execution platform**
   - Uses Intel TDX (Trusted Execution Environment)
   - Verifiable off-chain computation for NEAR
   - Source: https://outlayer.fastnear.com

2. **Rust SDK EXISTS**
   - Crate: `outlayer = "0.1"` on crates.io
   - Target: `wasm32-wasip2` (WASI Preview 2)
   - Source: https://github.com/fastnear/near-outlayer/tree/main/sdk/outlayer

3. **HTTPS API Format** (VERIFIED)
   ```bash
   POST https://api.outlayer.fastnear.com/call/{owner}/{project}
   Headers:
     X-Payment-Key: {account}:{nonce}:{key}
     Content-Type: application/json
   Body: {"input": {...}}
   ```
   Source: https://outlayer.fastnear.com/docs/https-api

4. **Rust SDK Features** (VERIFIED from README)
   ```rust
   use outlayer::{env, storage};
   
   // Environment
   let signer = env::signer_account_id();        // Get NEAR account
   let input = env::input_json()?;               // Read input
   env::output_json(&response)?;                 // Return output
   let api_key = env::var("OPENAI_API_KEY");     // Access secrets
   
   // Storage
   storage::set("key", b"value")?;               // Store data
   let data = storage::get("key")?;              // Retrieve data
   storage::increment("counter", 1)?;            // Atomic increment
   ```
   Source: https://github.com/fastnear/near-outlayer/blob/main/sdk/outlayer/README.md

5. **Storage Isolation**
   - User storage: Per-caller isolation (`alice.near` can't read `bob.near`)
   - Worker storage: Shared across users
   - Public storage: Cross-project readable
   Source: SDK README

6. **Environment Variables**
   - `NEAR_SENDER_ID` - Transaction signer
   - `NEAR_PREDECESSOR_ID` - Calling contract
   - `NEAR_TRANSACTION_HASH` - Tx hash
   - `USD_PAYMENT` - Attached payment
   - Custom secrets via dashboard
   Source: SDK README

7. **Build Requirements**
   ```bash
   rustup target add wasm32-wasip2
   cargo build --target wasm32-wasip2 --release
   ```
   Source: SDK README

8. **Examples Exist**
   - ai-ark
   - echo-ark
   - oracle-ark
   - near-email
   - weather-ark
   Source: https://github.com/fastnear/near-outlayer/tree/main/wasi-examples

---

## What I Got WRONG (My Hypotheses)

### ❌ INCORRECT Claims I Made

1. **JavaScript/TypeScript SDK** - DOES NOT EXIST
   - OutLayer uses Rust compiled to WASM
   - No `@outlayer/sdk` npm package
   - No TypeScript support

2. **Specific vault.sign() Methods** - NOT VERIFIED
   - I made up method signatures
   - Actual API is different

3. **@outlayer/cli Package** - NOT VERIFIED
   - May not exist
   - Deployment process unclear

4. **TEE Vault Terminology** - PARTIALLY WRONG
   - They call it "Storage" not "Vault"
   - Keys are managed differently than I described

---

## What I Still DON'T Know

1. **Exact NEAR MPC Integration**
   - How to call v1.signer from OutLayer WASM
   - Whether it's possible
   - Payment flow

2. **Deployment Process**
   - How to upload WASM to OutLayer
   - Dashboard workflow
   - Payment key setup

3. **Key Management**
   - How to store signing keys
   - Whether keys can sign NEAR transactions
   - Gas payment flow

4. **WebSocket Support**
   - Can OutLayer handle NIP-46 WebSocket connections?
   - Or is it HTTPS only?

---

## Technical Architecture (VERIFIED)

```
User Request
     ↓
HTTPS POST to api.outlayer.fastnear.com
     ↓
OutLayer Coordinator
     ↓
WASM Execution in Intel TDX TEE
     ↓
- Read input (env::input_json)
- Access secrets (env::var)
- Use storage (storage::*)
- Call NEAR RPC (if needed)
     ↓
Return output (env::output_json)
     ↓
Response to User
```

---

## Code Examples (VERIFIED from SDK README)

### Basic Structure

```rust
use outlayer::{env, storage};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct Request {
    action: String,
}

#[derive(Serialize)]
struct Response {
    success: bool,
    message: String,
}

fn main() {
    let result = run();
    let response = match result {
        Ok(msg) => Response { success: true, message: msg },
        Err(e) => Response { success: false, message: e.to_string() },
    };
    env::output_json(&response).unwrap();
}

fn run() -> Result<String, Box<dyn std::error::Error>> {
    let signer = env::signer_account_id().ok_or("No signer")?;
    let request: Request = env::input_json()?.ok_or("No input")?;
    
    match request.action.as_str() {
        "increment" => {
            let count = storage::increment(&format!("count:{}", signer), 1)?;
            Ok(format!("Count: {}", count))
        }
        _ => Err("Unknown action".into())
    }
}
```

Build:
```bash
cargo build --target wasm32-wasip2 --release
```

Test locally:
```bash
echo '{"action":"increment"}' | wasmtime target/wasm32-wasip2/release/my-app.wasm
```

---

## What This Means for NEAR + Nostr

### VERIFIED Approach

**Option 1: OutLayer + v1.signer (IF POSSIBLE)**

```rust
// Hypothetical - NOT VERIFIED
use outlayer::{env, near_rpc};

fn sign_nostr_event(event: NostrEvent) -> Result<Signature, Error> {
    let event_hash = hash_event(event);
    
    // Call v1.signer via NEAR RPC
    let signature = near_rpc::call(
        "v1.signer",
        "sign",
        json!({
            "domain": 0,
            "path": format!("nostr/{}", env::signer_account_id()?),
            "payload": event_hash,
        })
    )?;
    
    Ok(signature)
}
```

**Issues:**
- ❌ NEAR RPC integration not documented in SDK
- ❌ Gas payment unclear
- ❌ May need different approach

**Option 2: OutLayer Direct Signing (IF POSSIBLE)**

```rust
// Hypothetical - NOT VERIFIED
use outlayer::{env, storage, crypto};

fn main() {
    // Generate key in storage
    let account = env::signer_account_id().unwrap();
    let key = storage::get_or_create(&format!("key:{}", account), || {
        crypto::generate_keypair()
    })?;
    
    // Sign events
    let event: NostrEvent = env::input_json()?.unwrap();
    let signature = crypto::sign(&event_hash, &key)?;
    
    env::output_json(&signature).unwrap();
}
```

**Issues:**
- ❌ Crypto/signing APIs not documented in SDK
- ❌ May not exist

---

## Next Steps for ACTUAL Implementation

### What We Need to Learn

1. **NEAR RPC Access from OutLayer**
   - Can WASM call NEAR RPC?
   - How to pay gas?
   - Example code?

2. **Key Management**
   - How to store private keys?
   - How to sign data?
   - Security model?

3. **HTTPS API Limitations**
   - Can it handle NIP-46 WebSocket?
   - Or need separate WebSocket server?

4. **Payment Flow**
   - How to set up payment keys?
   - How to monetize?
   - User payment experience?

### How to Find Out

1. **Check wasi-examples more carefully**
   - Look at near-email example
   - Check rpc-test-ark
   - Study oracle examples

2. **Contact OutLayer Team**
   - Discord/Telegram community
   - GitHub issues
   - Documentation requests

3. **Experiment**
   - Build test WASM
   - Try calling NEAR RPC
   - Test deployment

---

## Honest Conclusion

### What I KNOW

✅ OutLayer is real and uses Rust + WASM
✅ SDK exists and is documented
✅ HTTPS API works as documented
✅ Storage and environment APIs exist
✅ TEE security is legitimate

### What I DON'T KNOW

❌ How to integrate with v1.signer
❌ Whether it can replace Cloudflare Workers for NIP-46
❌ Exact deployment workflow
❌ Key management for signing

### Recommendation

**Keep Cloudflare Workers implementation as primary.**

**Add OutLayer as experimental alternative** once we:
1. Understand NEAR RPC integration
2. Verify key signing capabilities
3. Test WebSocket limitations
4. Document actual deployment process

---

## Files to Investigate Next

1. `wasi-examples/near-email/` - May show NEAR integration
2. `wasi-examples/rpc-test-ark/` - May show RPC calls
3. `docs/` folder - More documentation
4. `QUICK_START.md` - Deployment guide
5. `DEPLOYMENT_GUIDE.md` - Detailed deployment

---

**Status:** Investigation paused - need more information before implementation
**Recommendation:** Stick with Cloudflare Workers until OutLayer integration is clearer
