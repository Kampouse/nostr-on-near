/**
 * NEAR + Nostr Bunker Server (NIP-46)
 * Deployable on Cloudflare Workers
 * 
 * Every NEAR account gets a deterministic Nostr identity
 */

// ============================================
// CONFIGURATION
// ============================================

const MPC_CONTRACT = 'v1.signer';
const NEAR_RPC = 'https://rpc.mainnet.near.org';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ============================================
// WEBSOCKET PAIR FOR NIP-46
// ============================================

class NostrBunker {
  constructor(state) {
    this.state = state;
    this.sessions = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);
    
    // WebSocket upgrade for NIP-46
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      this.handleWebSocket(server, url);
      
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }
    
    // HTTP endpoints
    if (url.pathname === '/') {
      return new Response('NEAR Nostr Bunker - NIP-46 Compatible', {
        headers: { 'Content-Type': 'text/plain' },
      });
    }
    
    if (url.pathname.startsWith('/auth/')) {
      return this.handleAuth(url);
    }
    
    if (url.pathname === '/create-session' && request.method === 'POST') {
      return this.handleCreateSession(request);
    }
    
    return new Response('Not Found', { status: 404 });
  }

  // ============================================
  // WEBSOCKET HANDLER (NIP-46)
  // ============================================

  handleWebSocket(ws, url) {
    const accountId = this.extractAccountId(url.pathname);
    
    ws.accept();
    
    ws.addEventListener('message', async (event) => {
      try {
        const msg = JSON.parse(event.data);
        const response = await this.handleNIP46Message(msg, accountId, ws);
        
        if (response) {
          ws.send(JSON.stringify(response));
        }
      } catch (error) {
        console.error('WebSocket error:', error);
        ws.send(JSON.stringify({
          id: msg?.id,
          error: 'Internal error: ' + error.message,
        }));
      }
    });
    
    ws.addEventListener('close', () => {
      console.log('WebSocket closed for', accountId);
    });
  }

  async handleNIP46Message(msg, accountId, ws) {
    const { id, method, params } = msg;
    
    switch (method) {
      case 'connect':
      case 'get_public_key': {
        const pubkey = await this.getNostrPubkey(accountId);
        return { id, result: pubkey };
      }
      
      case 'sign_event': {
        const event = params[0];
        
        // Check authentication
        const session = await this.state.storage.get(`session:${accountId}`);
        if (!session || session.expires < Date.now()) {
          return {
            id,
            error: `Not authenticated. Visit: https://${accountId}.bunker.yourdomain.com/auth`,
          };
        }
        
        // Sign via MPC
        const signature = await this.signWithMPC(accountId, event);
        return { id, result: signature };
      }
      
      case 'nip04_encrypt': {
        const [pubkey, plaintext] = params;
        // Optional: Implement NIP-04 encryption
        return { id, error: 'NIP-04 encryption not implemented' };
      }
      
      case 'nip04_decrypt': {
        const [pubkey, ciphertext] = params;
        // Optional: Implement NIP-04 decryption
        return { id, error: 'NIP-04 decryption not implemented' };
      }
      
      default:
        return { id, error: `Unknown method: ${method}` };
    }
  }

  // ============================================
  // NEAR MPC INTEGRATION
  // ============================================

  async getNostrPubkey(accountId) {
    const response = await fetch(NEAR_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'query',
        params: {
          request_type: 'call_function',
          account_id: MPC_CONTRACT,
          method_name: 'derived_public_key',
          args_base64: btoa(JSON.stringify({
            domain: 0, // ECDSA
            path: `nostr/${accountId}`,
          })),
          finality: 'optimistic',
        },
      }),
    });
    
    const { result } = await response.json();
    
    // Convert byte array to hex
    const pubkeyHex = result.result
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return pubkeyHex;
  }

  async signWithMPC(accountId, event) {
    // 1. Serialize event (NIP-01)
    const serialized = JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content,
    ]);
    
    // 2. Hash with SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(serialized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const eventHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // 3. Get relayer credentials from environment
    const relayerAccountId = this.state.env.RELAYER_ACCOUNT_ID;
    const relayerPrivateKey = this.state.env.RELAYER_PRIVATE_KEY;
    
    if (!relayerAccountId || !relayerPrivateKey) {
      throw new Error('Relayer not configured');
    }
    
    // 4. Sign via MPC (this requires NEAR API integration)
    // For now, return placeholder - you'd need near-api-js here
    const signature = await this.callMPC(relayerAccountId, relayerPrivateKey, accountId, eventHash);
    
    return signature;
  }

  async callMPC(relayerAccount, relayerKey, accountId, eventHash) {
    // This would use near-api-js to call v1.signer
    // For production, you'd implement proper NEAR transaction signing
    
    const response = await fetch(NEAR_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'broadcast_tx_commit',
        params: [
          // This would be a signed transaction calling v1.signer.sign()
          // Requires proper transaction signing with near-api-js
          // Placeholder for now
        ],
      }),
    });
    
    // Extract signature from response
    // This is simplified - actual implementation needs proper parsing
    return 'signature_placeholder';
  }

  // ============================================
  // AUTHENTICATION
  // ============================================

  async handleAuth(url) {
    const accountId = url.pathname.split('/')[2];
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Authorize Nostr - ${accountId}</title>
  <script src="https://cdn.jsdelivr.net/npm/near-api-js@3.0.0/dist/near-api-js.min.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 { margin-bottom: 10px; }
    p { color: #666; margin-bottom: 30px; }
    button {
      width: 100%;
      padding: 16px;
      background: #007AFF;
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    button:hover { transform: scale(1.05); }
    .account { font-weight: bold; color: #007AFF; }
    .status { margin-top: 20px; padding: 16px; border-radius: 8px; }
    .success { background: #d4edda; color: #155724; }
    .error { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Authorize Nostr</h1>
    <p>Login with your NEAR account to enable Nostr signing</p>
    <p>Account: <span class="account">${accountId}</span></p>
    <button onclick="login()">Login with NEAR</button>
    <div id="status"></div>
  </div>
  
  <script>
    async function login() {
      try {
        const near = await nearApi.connect({
          networkId: 'mainnet',
          nodeUrl: 'https://rpc.mainnet.near.org',
          walletUrl: 'https://wallet.mainnet.near.org',
        });
        
        const wallet = new nearApi.WalletConnection(near, 'nostr-bunker');
        
        if (!wallet.isSignedIn()) {
          await wallet.requestSignIn({
            contractId: '${MPC_CONTRACT}',
            methodNames: ['sign'],
          });
        }
        
        const loggedInAccount = wallet.getAccountId();
        
        if (loggedInAccount !== '${accountId}') {
          showError('Wrong account! Please login as ${accountId}');
          return;
        }
        
        // Create session
        const response = await fetch('/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: '${accountId}' }),
        });
        
        const result = await response.json();
        
        if (result.success) {
          showSuccess('✓ Authorized! You can now close this page and return to your Nostr client.');
        } else {
          showError('Failed to create session');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
    
    function showSuccess(message) {
      document.getElementById('status').innerHTML = 
        '<div class="status success">' + message + '</div>';
    }
    
    function showError(message) {
      document.getElementById('status').innerHTML = 
        '<div class="status error">' + message + '</div>';
    }
  </script>
</body>
</html>
    `;
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  async handleCreateSession(request) {
    const { account_id } = await request.json();
    
    // Create session
    const session = {
      account_id,
      created: Date.now(),
      expires: Date.now() + SESSION_DURATION_MS,
    };
    
    await this.state.storage.put(`session:${account_id}`, session);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ============================================
  // HELPERS
  // ============================================

  extractAccountId(pathname) {
    // Extract from: /alice.near or /bunker/alice.near
    const parts = pathname.split('/').filter(p => p);
    return parts[parts.length - 1] || 'unknown';
  }
}

// ============================================
// EXPORT FOR CLOUDFLARE WORKERS
// ============================================

export { NostrBunker };
