import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:18789');

ws.on('open', () => {
  console.log('Connected');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('Received:', JSON.stringify(msg).slice(0, 400));
  
  if (msg.event === 'connect.challenge') {
    ws.send(JSON.stringify({
      type: 'req',
      id: 'connect-1',
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: { id: 'webchat', version: '0.1.0', platform: 'node', mode: 'webchat' },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        caps: [],
        commands: [],
        permissions: {},
        auth: { token: '0c5f4e49c62e66895d091914cbf5fd17190660a1fb823196' },
        locale: 'nl-NL',
        userAgent: 'test/0.1.0',
      },
    }));
  }
  
  if (msg.type === 'res' && msg.id === 'connect-1' && msg.ok) {
    console.log('✓ Connected! Sending test message...');
    ws.send(JSON.stringify({
      type: 'req',
      id: 'chat-1',
      method: 'chat.send',
      params: {
        sessionKey: 'agent:main',
        message: 'Test van VoiceKit - zeg gewoon "ontvangen"',
        idempotencyKey: 'test-' + Date.now(),
      },
    }));
  }
  
  if (msg.type === 'res' && msg.id === 'chat-1') {
    console.log('✓ chat.send response:', JSON.stringify(msg).slice(0, 300));
  }
  
  if (msg.type === 'event' && msg.event === 'chat') {
    console.log('💬 chat event:', JSON.stringify(msg).slice(0, 500));
  }
});

ws.on('error', (err) => console.error('Error:', err.message));
ws.on('close', () => console.log('Connection closed'));

setTimeout(() => { console.log('Timeout'); ws.close(); process.exit(0); }, 20000);
