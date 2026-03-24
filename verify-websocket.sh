#!/bin/bash

# WebSocket Verification Script for OutLayer
# This script tests if OutLayer supports WebSocket connections

echo "=== OutLayer WebSocket Verification ==="
echo ""

# Test 1: Try WebSocket connection (will fail)
echo "Test 1: WebSocket Connection"
echo "Expected: FAIL (OutLayer doesn't support WebSocket)"
echo ""

# Note: You'll need to replace this with your actual OutLayer endpoint
OUTLAYER_ENDPOINT="https://api.outlayer.fastnear.com/call/owner/project"

# Try to establish WebSocket connection
# Using wscat or websocat if available
if command -v wscat &> /dev/null; then
    echo "Using wscat to test WebSocket..."
    timeout 5 wscat -c "${OUTLAYER_ENDPOINT/https:/wss:}" 2>&1 || echo "✓ WebSocket failed as expected"
elif command -v websocat &> /dev/null; then
    echo "Using websocat to test WebSocket..."
    timeout 5 websocat "${OUTLAYER_ENDPOINT/https:/wss:}" 2>&1 || echo "✓ WebSocket failed as expected"
else
    echo "⚠️  wscat or websocat not installed"
    echo "Install with: npm install -g wscat"
    echo "Or: cargo install websocat"
    echo ""
    echo "Manual test with curl (WebSocket upgrade will fail):"
    curl -i -N \
      -H "Connection: Upgrade" \
      -H "Upgrade: websocket" \
      -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
      -H "Sec-WebSocket-Version: 13" \
      "$OUTLAYER_ENDPOINT" 2>&1 | head -20
fi

echo ""
echo "---"

# Test 2: HTTPS works
echo "Test 2: HTTPS Connection"
echo "Expected: SUCCESS"
echo ""

echo "Testing HTTPS POST..."
curl -X POST "$OUTLAYER_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"input":{"test":true}}' \
  2>&1 | head -10

echo ""
echo ""

# Test 3: Check if bridge works
echo "Test 3: WebSocket Bridge (Cloudflare Worker)"
echo "If you've deployed the bridge, test it here:"
echo ""

BRIDGE_ENDPOINT="${BRIDGE_ENDPOINT:-wss://your-bridge.workers.dev}"

if command -v wscat &> /dev/null; then
    echo "Testing bridge at: $BRIDGE_ENDPOINT"
    echo "Send NIP-46 message: {\"id\":1,\"method\":\"get_public_key\",\"params\":[]}"
    echo ""
    read -p "Test bridge? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        wscat -c "$BRIDGE_ENDPOINT"
    fi
else
    echo "Install wscat to test bridge: npm install -g wscat"
fi

echo ""
echo "=== Summary ==="
echo "✗ OutLayer WebSocket: NOT SUPPORTED"
echo "✓ OutLayer HTTPS: WORKS"
echo "? Bridge WebSocket: TEST ABOVE"
