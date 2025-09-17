const WebSocket = require('ws');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map<userId, WebSocket>
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws/notifications'
    });

    this.wss.on('connection', (ws, request) => {
      console.log('📡 New WebSocket connection');

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          if (data.type === 'auth') {
            await this.authenticateClient(ws, data.token);
          } else if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        // Remove client from map
        for (const [userId, client] of this.clients.entries()) {
          if (client === ws) {
            this.clients.delete(userId);
            console.log(`📡 Client ${userId} disconnected`);
            break;
          }
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });

    console.log('📡 WebSocket server initialized');
  }

  async authenticateClient(ws, token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
      
      // Store authenticated client
      this.clients.set(userId, ws);
      
      ws.userId = userId;
      ws.authenticated = true;
      
      // Send authentication success
      ws.send(JSON.stringify({
        type: 'authenticated',
        userId: userId
      }));
      
      console.log(`📡 Client ${userId} authenticated`);
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'auth_error',
        message: 'Invalid token'
      }));
      ws.close();
    }
  }

  // Send notification to specific user
  sendToUser(userId, notification) {
    const client = this.clients.get(userId);
    
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'notification',
        data: notification
      }));
      
      console.log(`📡 Notification sent to user ${userId}:`, notification.title);
      return true;
    }
    
    console.log(`📡 User ${userId} not connected or not available`);
    return false;
  }

  // Send notification to multiple users
  sendToUsers(userIds, notification) {
    let sentCount = 0;
    
    userIds.forEach(userId => {
      if (this.sendToUser(userId, notification)) {
        sentCount++;
      }
    });
    
    return sentCount;
  }

  // Broadcast to all connected users
  broadcast(notification) {
    let sentCount = 0;
    
    this.clients.forEach((client, userId) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'notification',
          data: notification
        }));
        sentCount++;
      }
    });
    
    console.log(`📡 Broadcast sent to ${sentCount} clients`);
    return sentCount;
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.clients.size;
  }

  // Get connected user IDs
  getConnectedUserIds() {
    return Array.from(this.clients.keys());
  }
}

module.exports = new WebSocketService();