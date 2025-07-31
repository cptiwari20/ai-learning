const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', function open() {
  console.log('✅ WebSocket connected successfully!');
  console.log('Connection state:', ws.readyState);
});

ws.on('message', function message(data) {
  console.log('📨 Received message:', data.toString());
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err);
});

ws.on('close', function close(code, reason) {
  console.log('🔌 WebSocket closed:', code, reason.toString());
});

// Keep the process alive for a few seconds to test
setTimeout(() => {
  console.log('Closing test client...');
  ws.close();
  process.exit(0);
}, 5000);