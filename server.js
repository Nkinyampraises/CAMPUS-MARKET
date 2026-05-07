#!/usr/bin/env node

/**
 * Render Backend Server
 * Express.js + WebSocket server for production deployment
 * 
 * Usage:
 *   npm run start:render
 * 
 * Environment:
 *   PORT - Server port (default: 3000)
 *   FRONTEND_URL - Frontend URL for CORS
 *   DATABASE_URL - PostgreSQL connection string
 *   NODE_ENV - Environment (development/production)
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';

// Configuration
const port = process.env.PORT || 3000;
const nodeEnv = process.env.NODE_ENV || 'development';
const frontendUrl = (process.env.FRONTEND_URL || '').trim();

// Create Express app
const app = express();
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors({
  origin: '*',
  allowedHeaders: ['Content-Type', 'Authorization', 'x-ai-guest-id'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposedHeaders: ['Content-Length'],
  maxAge: 600,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    console.log(
      `${statusColor}${res.statusCode}\x1b[0m ${req.method} ${req.path} (${duration}ms)`
    );
  });
  next();
});

// ============================================================================
// Health Check Endpoint
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: nodeEnv,
  });
});

app.get('/make-server-50b25a4f/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Static Files (if needed)
// ============================================================================

if (nodeEnv === 'production') {
  const distPath = path.join(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

// ============================================================================
// API Routes - Import from existing server code
// ============================================================================

// TODO: Import and implement actual routes from server/index.ts
// For now, providing placeholder implementations

/**
 * Auth Routes
 */
app.post('/make-server-50b25a4f/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // TODO: Implement signup logic
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: { email, name },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      error: 'Signup failed',
      details: nodeEnv === 'development' ? error.message : undefined,
    });
  }
});

app.post('/make-server-50b25a4f/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // TODO: Implement signin logic with JWT token
    res.json({
      success: true,
      accessToken: 'jwt-token-here',
      refreshToken: 'refresh-token-here',
      user: { email },
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({
      error: 'Signin failed',
      details: nodeEnv === 'development' ? error.message : undefined,
    });
  }
});

app.get('/make-server-50b25a4f/auth/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // TODO: Verify token and get user
    res.json({
      id: 'user-id',
      email: 'user@example.com',
      name: 'User Name',
    });
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * Listings Routes
 */
app.get('/make-server-50b25a4f/listings', async (req, res) => {
  try {
    // TODO: Implement get listings
    res.json({
      listings: [],
      total: 0,
    });
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ error: 'Failed to get listings' });
  }
});

app.get('/make-server-50b25a4f/listings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // TODO: Implement get listing by ID
    res.json({
      id,
      title: 'Listing Title',
      description: 'Listing description',
    });
  } catch (error) {
    console.error('Get listing error:', error);
    res.status(500).json({ error: 'Failed to get listing' });
  }
});

app.post('/make-server-50b25a4f/listings', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // TODO: Implement create listing
    res.status(201).json({
      success: true,
      listingId: 'new-listing-id',
    });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

/**
 * Messages Routes
 */
app.get('/make-server-50b25a4f/messages', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // TODO: Implement get messages
    res.json({ messages: [] });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

app.post('/make-server-50b25a4f/messages', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // TODO: Implement send message
    res.status(201).json({
      success: true,
      messageId: 'new-message-id',
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ============================================================================
// WebSocket Handlers
// ============================================================================

// Keep track of connected clients
const clients = new Map();

wss.on('connection', (ws, req) => {
  const clientId = req.headers['sec-websocket-key'];
  const userId = new URL(req.url || '', `http://${req.headers.host}`).searchParams.get('userId');
  
  console.log(`✅ WebSocket client connected: ${clientId} (userId: ${userId})`);
  
  clients.set(clientId, {
    ws,
    userId,
    connectedAt: new Date(),
  });

  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    timestamp: Date.now(),
  }));

  // Handle incoming messages
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📨 WebSocket message from ${clientId}:`, message.type);

      switch (message.type) {
        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now(),
          }));
          break;

        case 'message':
          // Broadcast message to all connected clients
          broadcastMessage({
            type: 'message',
            from: userId,
            data: message.data,
            timestamp: Date.now(),
          });
          break;

        case 'notification':
          // Send notification to specific user
          broadcastMessage({
            type: 'notification',
            to: message.to,
            data: message.data,
            timestamp: Date.now(),
          });
          break;

        case 'typing':
          // Broadcast typing indicator
          broadcastMessage({
            type: 'typing',
            from: userId,
            conversationId: message.conversationId,
            timestamp: Date.now(),
          });
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        timestamp: Date.now(),
      }));
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    console.log(`❌ WebSocket client disconnected: ${clientId}`);
    clients.delete(clientId);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`⚠️ WebSocket error for ${clientId}:`, error);
  });
});

/**
 * Broadcast message to all connected clients or specific user
 */
function broadcastMessage(message) {
  const messageStr = JSON.stringify(message);
  
  clients.forEach((client) => {
    if (client.ws.readyState === 1) { // WebSocket.OPEN
      // If message has 'to' field, only send to that user
      if (message.to && message.to !== client.userId) {
        return;
      }
      
      client.ws.send(messageStr);
    }
  });
}

/**
 * Get connected clients count
 */
app.get('/api/debug/ws-clients', (req, res) => {
  if (nodeEnv !== 'development') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  const clientsList = Array.from(clients.values()).map(client => ({
    userId: client.userId,
    connectedAt: client.connectedAt,
    state: client.ws.readyState,
  }));

  res.json({
    connectedClients: clients.size,
    clients: clientsList,
  });
});

// ============================================================================
// Error Handlers
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    details: nodeEnv === 'development' ? err.stack : undefined,
  });
});

// ============================================================================
// Start Server
// ============================================================================

server.listen(port, () => {
  const protocol = process.env.HTTPS ? 'https' : 'http';
  console.log('');
  console.log('🚀 Server started successfully!');
  console.log(`   API: ${protocol}://localhost:${port}`);
  console.log(`   WebSocket: ws${protocol === 'https' ? 's' : ''}://localhost:${port}`);
  console.log(`   Frontend: ${frontendUrl || 'Not configured'}`);
  console.log(`   Environment: ${nodeEnv}`);
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received: shutting down gracefully');
  
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close all WebSocket connections
    wss.clients.forEach((client) => {
      client.close();
    });
    
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forcing shutdown');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  console.log('SIGINT received: shutting down');
  process.exit(0);
});

export default server;
