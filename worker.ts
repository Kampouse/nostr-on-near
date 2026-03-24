/**
 * NEAR + Nostr Bunker Server (NIP-46)
 * Deployable on Cloudflare Workers
 * TypeScript Implementation
 * 
 * Every NEAR account gets a deterministic Nostr identity
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

interface Env {
  RELAYER_ACCOUNT_ID: string;
  RELAYER_PRIVATE_KEY: string;
  NostrBunker: DurableObjectNamespace;
}

interface Session {
  account_id: string;
  created: number;
  expires: number;
}

interface NIP46Request {
  id: number | string;
  method: string;
  params: any[];
}

interface NIP46Response {
  id: number | string;
  result?: string;
  error?: string;
}

interface NostrEvent {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  id?: string;
  sig?: string;
}

interface NearRPCResult {
  result?: number[];
  error?: { message: string };
}

interface NearRPCResponse {
  jsonrpc: string;
  id: number;
  result?: {
    result: number[];
  };
  error?: {
    message: string;
  };
}

// ============================================
// CONFIGURATION
// ============================================

const MPC_CONTRACT = 'v1.signer';
const NEAR_RPC = 'https://rpc.mainnet.near.org';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ============================================
// DURABLE OBJECT: BUNKER STATE
// ============================================

export class NostrBunker {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<string, Session>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  async fetch(request: Request): Promise<Response> {
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

  private handleWebSocket(ws: WebSocket, url: URL): void {
    const accountId = this.extractAccountId(url.pathname);
    
    ws.accept();
    
    ws.addEventListener('message', async (event: MessageEvent) => {
      try {
        const msg: NIP46Request = JSON.parse(event.data as string);
        const response = await this.handleNIP46Message(msg, accountId);
        
        if (response) {
          ws.send(JSON.stringify(response));
        }
      } catch (error) {
        console.error('WebSocket error:', error);
        ws.send(JSON.stringify({
          id: 'unknown',
          error: 'Internal error: ' + (error as Error).message,
        }));
      }
    });
    
    ws.addEventListener('close', () => {
      console.log('WebSocket closed for', accountId);
    });
  }

  private async handleNIP46Message(
    msg: NIP46Request,
    accountId: string
  ): Promise<NIP46Response> {
    const { id, method, params } = msg;
    
    switch (method) {
      case 'connect':
      case 'get_public_key': {
        const pubkey = await this.getNostrPubkey(accountId);
        return { id, result: pubkey };
      }
      
      case 'sign_event': {
        const event: NostrEvent = params[0];
        
        // Check authentication
        const session = await this.state.storage.get<Session>(`session:${accountId}`);
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
        // Optional: Implement NIP-04 encryption
        return { id, error: 'NIP-04 encryption not implemented' };
      }
      
      case 'nip04_decrypt': {
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

  private async getNostrPubkey(accountId: string): Promise<string> {
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
    
    const data: NearRPCResponse = await response.json();
    
    if (data.error) {
      throw new Error(`NEAR RPC error: ${data.error.message}`);
    }
    
    if (!data.result) {
      throw new Error('No result from NEAR RPC');
    }
    
    // Convert byte array to hex
    const pubkeyHex = data.result.result
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join('');
    
    return pubkeyHex;
  }

  private async signWithMPC(accountId: string, event: NostrEvent): Promise<string> {
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
    
    // 3. Get relayer credentials
    const relayerAccountId = this.env.RELAYER_ACCOUNT_ID;
    const relayerPrivateKey = this.env.RELAYER_PRIVATE_KEY;
    
    if (!relayerAccountId || !relayerPrivateKey) {
      throw new Error('Relayer not configured');
    }
    
    // 4. Sign via MPC
    const signature = await this.callMPC(relayerAccountId, relayerPrivateKey, accountId, eventHash);
    
    return signature;
  }

  private async callMPC(
    relayerAccount: string,
    relayerKey: string,
    accountId: string,
    eventHash: string
  ): Promise<string> {
    // This would use near-api-js to call v1.signer
    // For production, you'd implement proper NEAR transaction signing
    
    // TODO: Implement actual NEAR transaction signing
    // This is a placeholder - you'd need to:
    // 1. Create transaction calling v1.signer.sign()
    // 2. Sign with relayer key
    // 3. Broadcast to NEAR
    // 4. Extract signature from response
    
    throw new Error('MPC signing not yet implemented - requires near-api-js integration');
  }

  // ============================================
  // AUTHENTICATION
  // ============================================

  private async handleAuth(url: URL): Promise<Response> {
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

  private async handleCreateSession(request: Request): Promise<Response> {
    const body = await request.json() as { account_id: string };
    const { account_id } = body;
    
    // Create session
    const session: Session = {
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

  private extractAccountId(pathname: string): string {
    // Extract from: /alice.near or /bunker/alice.near
    const parts = pathname.split('/').filter(p => p);
    return parts[parts.length - 1] || 'unknown';
  }
}

// ============================================
// WORKER ENTRY POINT
// ============================================

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Route to Durable Object
    const id = env.NostrBunker.idFromName('bunker');
    const stub = env.NostrBunker.get(id);
    
    return stub.fetch(request);
  },
};
