const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ message: 'Connected to WebSocket' }));
  ws.on('message', (data) => console.log('Received:', data.toString()));
});

// Simulated price stream (every 2 seconds)
setInterval(() => {
  const symbols = ['AAPL','TSLA','GOOGL','MSFT','AMZN','BTCUSD','ETHUSD','EURUSD','GBPUSD','XAUUSD'];
  const prices = {};
  symbols.forEach(sym => { prices[sym] = +(100 + Math.random() * 300).toFixed(2); });
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(JSON.stringify({ type: 'price_update', prices }));
  });
}, 2000);

// CORS allow all (সব জায়গা থেকে রিকোয়েস্ট আসতে পারে)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API endpoint example (যদি দরকার হয়)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html (সামনের ফ্রন্টএন্ড)
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Simple server running at http://localhost:${PORT}`);
});