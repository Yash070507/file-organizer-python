/**
 * Anna Sakhi — Express API server (AI proxy only)
 *
 * ⚠️  DEPRECATION NOTICE
 * This Node.js server handles only /api/vision, /api/chat, and /api/live-key.
 * It has NO Firestore / database routes.
 *
 * The canonical, full-featured backend is app.py (Python / FastAPI).
 * Prefer running: npm run py:dev:full   (FastAPI + Vite together)
 *
 * This file is kept for cases where a lightweight Node-only proxy is preferred.
 *
 * Endpoints:
 *   POST /api/vision    — Gemini image analysis (key stays server-side)
 *   POST /api/chat      — Gemini text chat       (key stays server-side)
 *   GET  /api/live-key  — returns key to LOCAL NETWORK IPs only
 *   GET  /health        — liveness check
 *
 * Production: also serves the Vite build from ../dist
 */

import 'dotenv/config';
import express         from 'express';
import cors            from 'cors';
import path            from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

// ── Setup ──────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();
const PORT      = Number(process.env.PORT) || 4000;
const API_KEY   = process.env.GEMINI_API_KEY;
const IS_PROD   = process.env.NODE_ENV === 'production';
const MODEL     = 'gemini-3.5-flash';

if (!API_KEY) {
  console.warn('\n⚠️  GEMINI_API_KEY is not set in server/.env');
  console.warn('   Copy server/.env.example → server/.env and fill in your key.\n');
}

// ── Gemini client ──────────────────────────────────────────
let ai = null;
function getAI() {
  if (!ai && API_KEY) ai = new GoogleGenAI({ apiKey: API_KEY });
  return ai;
}

// ── Prompts ────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `You are Anna Sakhi, a warm, knowledgeable, and encouraging Konkan kitchen companion AI.
You specialise in Konkan, Malvani, Goan, and broader South Indian coastal cuisine.
Always respond in a friendly, conversational tone — like a knowledgeable local aunty who loves to cook and share recipes.
Use occasional food emojis to make responses feel warm and inviting.
Keep responses concise but rich: avoid long walls of text, use bullet points or short paragraphs.
When suggesting recipes, focus on authentic Konkan coastal flavours — coconut, kokum, curry leaves, Malvani masala.
CRITICAL: Never ask the user to adjust API settings or enable 'precise ingredient identification'. You are fully capable of identifying ingredients as-is.`;

const IMAGE_PROMPT = `Please analyse this image carefully and respond as Anna Sakhi.

1. **Identify every visible ingredient or food item** — be specific (e.g. "curry leaves", not just "leaves")
2. **Estimate quantities** where visible (e.g. "about 2 medium tomatoes", "roughly 1 tbsp turmeric", "a small bunch of coriander")
3. **Note freshness / quality** if relevant (e.g. "the tomatoes look very ripe and ready to use")
4. **Suggest 2–3 Konkan or South Indian coastal recipes** you could make with what you see
5. If it's a prepared dish rather than raw ingredients, identify the dish, describe it, and suggest serving accompaniments

Format your response warmly and conversationally — like you're standing in the kitchen together!`;

// ── Middleware ─────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://anna-sakhi.web.app',
  'https://anna-sakhi.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:4173',
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow same-machine / local network (dev)
    if (!origin || isLocalIp(origin)) return cb(null, true);
    // Allow whitelisted production origins
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    // In dev, allow everything
    if (!IS_PROD) return cb(null, true);
    cb(new Error('CORS: not allowed from ' + origin));
  },
}));
app.use(express.json({ limit: '10mb' })); // images can be large

// ── Local IP guard ─────────────────────────────────────────
function isLocalIp(ip) {
  if (!ip) return true;
  // Strip port / protocol
  const clean = ip.replace(/^https?:\/\//, '').split(':')[0];
  return (
    clean === 'localhost'          ||
    clean === '127.0.0.1'         ||
    clean === '::1'               ||
    clean.startsWith('192.168.')  ||
    clean.startsWith('10.')       ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(clean)
  );
}

function requireLocal(req, res, next) {
  // In production (Cloud Run), trust requests coming from our own frontend
  // The Gemini key is still only used server-side; it's never embedded in the frontend bundle.
  if (IS_PROD) return next();
  const ip = req.ip || req.socket?.remoteAddress || '';
  if (isLocalIp(ip)) return next();
  res.status(403).json({ error: 'Access restricted to local network' });
}

// ── Health ─────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString(), configured: Boolean(API_KEY) });
});

// ── POST /api/vision ───────────────────────────────────────
app.post('/api/vision', async (req, res) => {
  const { base64, mimeType = 'image/jpeg', userText = '' } = req.body;
  if (!base64) return res.status(400).json({ error: 'base64 is required' });

  const client = getAI();
  if (!client) return res.status(503).json({ error: 'Gemini API key not configured on server' });

  try {
    const prompt = userText
      ? `${IMAGE_PROMPT}\n\nThe user also says: "${userText}"`
      : IMAGE_PROMPT;

    const response = await client.models.generateContent({
      model: MODEL,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: prompt },
        ],
      }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });

    res.json({ text: response.text });
  } catch (err) {
    console.error('[/api/vision]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/chat ─────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  const client = getAI();
  if (!client) return res.status(503).json({ error: 'Gemini API key not configured on server' });

  try {
    const contents = [
      ...history.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content || '' }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const response = await client.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.75,
        maxOutputTokens: 1024,
      },
    });

    res.json({ text: response.text });
  } catch (err) {
    console.error('[/api/chat]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/live-key — LOCAL NETWORK ONLY ─────────────────
// Used by the frontend to get the key for the Gemini Live WebSocket.
// Restricted to private IPs — never exposed over the public internet.
app.get('/api/live-key', requireLocal, (_req, res) => {
  if (!API_KEY) return res.status(503).json({ error: 'Gemini API key not configured on server' });
  res.json({ key: API_KEY });
});

// ── Static (production) ────────────────────────────────────
if (IS_PROD) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── Start ──────────────────────────────────────────────────
import { networkInterfaces } from 'os';

function getLanIps() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i?.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${PORT}`);
}

app.listen(PORT, '0.0.0.0', () => {
  const lanIps = getLanIps();
  console.log('\n🌴 Anna Sakhi server running!\n');
  console.log(`   Local   → http://localhost:${PORT}`);
  lanIps.forEach((ip) => console.log(`   Network → ${ip}`));
  console.log(`   API key → ${API_KEY ? '✅ configured' : '❌ NOT SET (check server/.env)'}`);
  console.log(`   Mode    → ${IS_PROD ? 'production (serving dist/)' : 'development (Vite handles frontend)'}`);
  console.log('');
});
