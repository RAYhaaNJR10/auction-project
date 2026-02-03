// server.js - Football Auction backup server
// Run: npm install express && node server.js

const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, 'auction-state.json');

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json({ limit: '1mb' }));

app.post('/save-state', async (req, res) => {
  const state = req.body;
  if (!state || typeof state !== 'object') {
    return res.status(400).json({ message: 'Invalid state payload' });
  }

  try {
    const payload = {
      state,
      savedAt: new Date().toISOString(),
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(payload, null, 2));
    res.json({ ok: true });
  } catch (err) {
    console.error('save-state failed', err);
    res.status(500).json({ message: 'Unable to persist state' });
  }
});

app.get('/load-state', async (_req, res) => {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const payload = JSON.parse(raw);
    res.json(payload);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ message: 'No backup available' });
    }
    console.error('load-state failed', err);
    res.status(500).json({ message: 'Unable to read backup' });
  }
});

app.listen(PORT, () => {
  console.log(`Football Auction backup server running on http://localhost:${PORT}`);
});
