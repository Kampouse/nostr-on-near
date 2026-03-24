#!/usr/bin/env node

/**
 * Test client for NEAR + Nostr Bunker
 * Usage: node test-client.js alice.near wss://your-worker.workers.dev/alice.near
 */

const WebSocket = require('ws');

const accountId = process.argv[2] || 'alice.near';
const wsUrl = process.argv[3] || 'ws://localhost:8787/alice.near';

console.log(`\n🔗 Connecting to: ${wsUrl}`);
console.log(`👤 Account: ${accountId}\n`);

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✓ Connected\n');
  
  // Test 1: Get public key
  console.log('📋 Test 1: Getting public key...');
  ws.send(JSON.stringify({
    id: 1,
    method: 'get_public_key',
    params: [],
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  console.log('\n📥 Response:');
  console.log(JSON.stringify(msg, null, 2));
  
  if (msg.id === 1 && msg.result) {
    console.log(`\n✓ Public key: ${msg.result}`);
    console.log('\n📋 Test 2: Attempting to sign event (will fail if not authenticated)...');
    
    const testEvent = {
      pubkey: msg.result,
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'Hello Nostr from NEAR!',
    };
    
    ws.send(JSON.stringify({
      id: 2,
      method: 'sign_event',
      params: [testEvent],
    }));
  }
  
  if (msg.id === 2) {
    if (msg.error) {
      console.log(`\n✗ Sign failed (expected): ${msg.error}`);
      console.log('\n💡 To fix: Visit the auth URL and login with NEAR wallet');
    } else {
      console.log('\n✓ Event signed!');
      console.log(`   Signature: ${msg.result}`);
    }
    
    console.log('\n✅ Tests complete!\n');
    ws.close();
  }
});

ws.on('error', (error) => {
  console.error('\n✗ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('\n👋 Connection closed\n');
});
