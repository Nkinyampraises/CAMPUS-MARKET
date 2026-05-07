#!/usr/bin/env node

/**
 * MARKET BACKEND SERVER
 * 
 * ✅ Frontend: https://market-ebon-one.vercel.app
 * ✅ Database: Supabase (https://gidhrctnjfxzccaplkjj.supabase.co)
 * ✅ WebSocket: Real-time messaging support
 * 
 * Deployment: Render (https://market-backend.onrender.com)
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import pg from 'pg';
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';

const { Pool } = pg;
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://market-ebon-one.vercel.app').trim();
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://gidhrctnjfxzccaplkjj.supabase.co').trim();
const DATABASE_URL = process.env.DATABASE_URL;

console.log('\n═══════════════════════════════════════════════════════════');
console.log('MARKET BACKEND SERVER');
console.log('═══════════════════════════════════════════════════════════');
console.log(`✅ Port: ${PORT}`);
console.log(`✅ Environment: ${NODE_ENV}`);
console.log(`✅ Frontend: ${FRONTEND_URL}`);
console.log(`✅ Database: ${DATABASE_URL ? 'Connected' : 'Not configured'}`);
console.log(`✅ Supabase: ${SUPABASE_URL}`);
console.log('═══════════════════════════════════════════════════════════\n');

// ============================================================================
// DATABASE SETUP (SUPABASE)
// ============================================================================

let dbPool = null;

function initDatabase() {
  if (!DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL not set. Database operations will be unavailable.');
    return null;
  }

  try {
    dbPool = new Pool({
      connectionString: DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    dbPool.on('error', (err) => {
      console.error('❌ Database pool error:', err);
    });

    // Test connection
    dbPool.query('SELECT NOW()', (err, result) => {
      if (err) {
        console.error('❌ Database connection failed:', err.message);
      } else {
        console.log('✅ Database connected successfully');
      }
    });

    return dbPool;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    return null;
  }
}

/**
 * Execute database query
 */
async function dbQuery(sql, params = []) {
  if (!dbPool) {
    throw new Error('Database pool not initialized');
  }
  
  try {
    const result = await dbPool.query(sql, params);
    return result;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

// Initialize database
initDatabase();

// ============================================================================
// EXPRESS SETUP
// ============================================================================

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ============================================================================
// MIDDLEWARE
// ============================================================================

// CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (NODE_ENV !== 'production') {
      callback(null, true); // Allow all in development
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-ai-guest-id'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 600,
}));

// Body Parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const method = req.method.padEnd(6);
    const status = res.statusCode >= 400 
      ? `\x1b[31m${res.statusCode}\x1b[0m`
      : `\x1b[32m${res.statusCode}\x1b[0m`;
    console.log(`[${new Date().toISOString()}] ${status} ${method} ${req.path} (${duration}ms)`);
  });
  next();
});

// ============================================================================
// HEALTH & DIAGNOSTIC ENDPOINTS
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'market-backend',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: NODE_ENV,
    frontend: FRONTEND_URL,
    supabase: SUPABASE_URL,
    database: dbPool ? 'connected' : 'disconnected',
  });
});

app.get('/make-server-50b25a4f/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Database connection test
app.get('/api/test/database', async (req, res) => {
  if (NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  try {
    if (!dbPool) {
      return res.status(503).json({ error: 'Database pool not initialized' });
    }

    const result = await dbQuery('SELECT NOW() as current_time');
    res.json({
      status: 'ok',
      message: 'Database connection successful',
      timestamp: result.rows[0].current_time,
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      error: 'Database connection failed',
      details: NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// CORS configuration test
app.get('/api/test/cors', (req, res) => {
  res.json({
    status: 'ok',
    origin: req.get('origin'),
    allowedOrigin: FRONTEND_URL,
    isCorsEnabled: true,
  });
});

// ============================================================================
// API ENDPOINTS (PLACEHOLDER)
// ============================================================================

// Authentication
app.post('/make-server-50b25a4f/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    // TODO: Implement with database
    res.status(201).json({ success: true, user: { email, name } });
  } catch (error) {
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/make-server-50b25a4f/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    // TODO: Implement with database
    res.json({ success: true, accessToken: 'token', user: { email } });
  } catch (error) {
    res.status(500).json({ error: 'Signin failed' });
  }
});

app.get('/make-server-50b25a4f/auth/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ id: 'user-id', email: 'user@example.com' });
});

// Listings
app.get('/make-server-50b25a4f/listings', (req, res) => {
  res.json({ listings: [], total: 0 });
});

app.get('/make-server-50b25a4f/listings/:id', (req, res) => {
  res.json({ id: req.params.id, title: 'Listing' });
});

app.post('/make-server-50b25a4f/listings', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  res.status(201).json({ success: true, listingId: 'new-id' });
});

// Messages
app.get('/make-server-50b25a4f/messages', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ messages: [] });
});

app.post('/make-server-50b25a4f/messages', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  res.status(201).json({ success: true, messageId: 'new-id' });
});

// ============================================================================
// WEBSOCKET HANDLERS
// ============================================================================

const wsClients = new Map();

wss.on('connection', (ws, req) => {
  const clientId = req.headers['sec-websocket-key'];
  const userId = new URL(req.url || '', `http://${req.headers.host}`).searchParams.get('userId');
  
  console.log(`✅ WebSocket connected: ${clientId} (user: ${userId || 'anonymous'})`);
  
  wsClients.set(clientId, { ws, userId, connectedAt: new Date() });

  ws.send(JSON.stringify({ type: 'connected', clientId, timestamp: Date.now() }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      } else if (msg.type === 'message') {
        broadcastWsMessage({ type: 'message', from: userId, data: msg.data, timestamp: Date.now() });
      } else if (msg.type === 'notification') {
        broadcastWsMessage({ type: 'notification', to: msg.to, data: msg.data });
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid format' }));
    }
  });

  ws.on('close', () => {
    console.log(`❌ WebSocket disconnected: ${clientId}`);
    wsClients.delete(clientId);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error (${clientId}):`, error);
  });
});

function broadcastWsMessage(message) {
  const msg = JSON.stringify(message);
  wsClients.forEach((client) => {
    if (client.ws.readyState === 1) {
      if (!message.to || message.to === client.userId) {
        client.ws.send(msg);
      }
    }
  });
}

// Debug endpoint
app.get('/api/debug/ws', (req, res) => {
  if (NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  res.json({
    connectedClients: wsClients.size,
    clients: Array.from(wsClients.values()).map(c => ({
      userId: c.userId,
      connectedAt: c.connectedAt,
    })),
  });
});

// ============================================================================
// ERROR HANDLERS
// ============================================================================

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    details: NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

server.listen(PORT, () => {
  console.log('\n🚀 SERVER RUNNING');
  console.log(`   HTTP:      http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log('\n📝 TEST ENDPOINTS (Development only):`);
  console.log(`   Health:    GET http://localhost:${PORT}/health`);
  console.log(`   Database:  GET http://localhost:${PORT}/api/test/database`);
  console.log(`   CORS:      GET http://localhost:${PORT}/api/test/cors`);
  console.log(`   WebSocket: GET http://localhost:${PORT}/api/debug/ws`);
  console.log('');
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on('SIGTERM', () => {
  console.log('SIGTERM: Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    if (dbPool) {
      dbPool.end(() => {
        console.log('Database pool closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
  setTimeout(() => {
    console.error('Force shutdown');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  console.log('SIGINT: Shutting down');
  process.exit(0);
});

export default server;
