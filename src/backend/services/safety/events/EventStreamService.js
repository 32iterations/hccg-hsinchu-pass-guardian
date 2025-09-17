/**
 * EventStreamService - Real-time event streaming service for safety guardian system
 * Supports both WebSocket and Server-Sent Events (SSE) for real-time communication
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class EventStreamService extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      port: process.env.EVENT_STREAM_PORT || 8080,
      heartbeatInterval: process.env.HEARTBEAT_INTERVAL || 30000,
      maxConnections: process.env.MAX_WS_CONNECTIONS || 1000,
      ...config
    };

    this.connections = new Map();
    this.sseClients = new Map();
    this.wss = null;
    this.heartbeatTimer = null;

    this.logger = this._initLogger();
  }

  /**
   * Initialize the WebSocket server
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.wss = new WebSocket.Server({
        port: this.config.port,
        maxPayload: 1024 * 1024 // 1MB limit
      });

      this.wss.on('connection', this._handleWebSocketConnection.bind(this));
      this.wss.on('error', this._handleServerError.bind(this));

      this._startHeartbeat();

      this.logger.info(`EventStreamService initialized on port ${this.config.port}`);
    } catch (error) {
      this.logger.error('Failed to initialize EventStreamService:', error);
      throw error;
    }
  }

  /**
   * Handle new WebSocket connections
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} req - HTTP request object
   * @private
   */
  _handleWebSocketConnection(ws, req) {
    try {
      if (this.connections.size >= this.config.maxConnections) {
        ws.close(1013, 'Server overloaded');
        return;
      }

      const connectionId = this._generateConnectionId();
      const clientInfo = this._extractClientInfo(req);

      this.connections.set(connectionId, {
        ws,
        clientInfo,
        lastPing: Date.now(),
        subscriptions: new Set()
      });

      ws.on('message', (message) => this._handleMessage(connectionId, message));
      ws.on('close', () => this._handleDisconnection(connectionId));
      ws.on('error', (error) => this._handleConnectionError(connectionId, error));
      ws.on('pong', () => this._handlePong(connectionId));

      this.logger.info(`WebSocket connection established: ${connectionId}`, clientInfo);

      // Send initial connection confirmation
      this._sendToConnection(connectionId, {
        type: 'connection_established',
        connectionId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Error handling WebSocket connection:', error);
      ws.close(1011, 'Server error');
    }
  }

  /**
   * Handle incoming messages from WebSocket clients
   * @param {string} connectionId - Connection identifier
   * @param {Buffer} message - Raw message buffer
   * @private
   */
  _handleMessage(connectionId, message) {
    try {
      const data = JSON.parse(message.toString());
      const connection = this.connections.get(connectionId);

      if (!connection) return;

      switch (data.type) {
        case 'subscribe':
          this._handleSubscription(connectionId, data.channels);
          break;
        case 'unsubscribe':
          this._handleUnsubscription(connectionId, data.channels);
          break;
        case 'ping':
          this._sendToConnection(connectionId, { type: 'pong', timestamp: Date.now() });
          break;
        default:
          this.logger.warn(`Unknown message type: ${data.type}`, { connectionId });
      }
    } catch (error) {
      this.logger.error('Error handling message:', error, { connectionId });
    }
  }

  /**
   * Handle channel subscriptions
   * @param {string} connectionId - Connection identifier
   * @param {string[]} channels - Array of channel names to subscribe to
   * @private
   */
  _handleSubscription(connectionId, channels) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    channels.forEach(channel => {
      if (this._isValidChannel(channel)) {
        connection.subscriptions.add(channel);
        this.logger.debug(`Client subscribed to channel: ${channel}`, { connectionId });
      }
    });

    this._sendToConnection(connectionId, {
      type: 'subscription_confirmed',
      channels: Array.from(connection.subscriptions),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle channel unsubscriptions
   * @param {string} connectionId - Connection identifier
   * @param {string[]} channels - Array of channel names to unsubscribe from
   * @private
   */
  _handleUnsubscription(connectionId, channels) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    channels.forEach(channel => {
      connection.subscriptions.delete(channel);
      this.logger.debug(`Client unsubscribed from channel: ${channel}`, { connectionId });
    });

    this._sendToConnection(connectionId, {
      type: 'unsubscription_confirmed',
      channels,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast event to specific channel subscribers
   * @param {string} channel - Channel name
   * @param {Object} event - Event data to broadcast
   * @returns {number} Number of clients that received the message
   */
  broadcastToChannel(channel, event) {
    let sentCount = 0;

    try {
      const message = {
        type: 'event',
        channel,
        data: event,
        timestamp: new Date().toISOString()
      };

      // Broadcast to WebSocket connections
      for (const [connectionId, connection] of this.connections) {
        if (connection.subscriptions.has(channel)) {
          if (this._sendToConnection(connectionId, message)) {
            sentCount++;
          }
        }
      }

      // Broadcast to SSE clients
      for (const [clientId, client] of this.sseClients) {
        if (client.subscriptions.has(channel)) {
          if (this._sendSSEEvent(clientId, message)) {
            sentCount++;
          }
        }
      }

      this.logger.debug(`Broadcasted to channel: ${channel}`, { sentCount, event: event.type });
      return sentCount;
    } catch (error) {
      this.logger.error('Error broadcasting to channel:', error, { channel });
      return 0;
    }
  }

  /**
   * Send event to specific connection
   * @param {string} connectionId - Connection identifier
   * @param {Object} event - Event data to send
   * @returns {boolean} Success status
   */
  sendToConnection(connectionId, event) {
    try {
      const message = {
        type: 'direct_event',
        data: event,
        timestamp: new Date().toISOString()
      };

      return this._sendToConnection(connectionId, message);
    } catch (error) {
      this.logger.error('Error sending to connection:', error, { connectionId });
      return false;
    }
  }

  /**
   * Handle Server-Sent Events (SSE) endpoint
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  handleSSE(req, res) {
    try {
      const clientId = this._generateConnectionId();

      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      const clientInfo = this._extractClientInfo(req);

      this.sseClients.set(clientId, {
        res,
        clientInfo,
        lastPing: Date.now(),
        subscriptions: new Set()
      });

      // Send initial connection event
      this._sendSSEEvent(clientId, {
        type: 'connection_established',
        connectionId: clientId,
        timestamp: new Date().toISOString()
      });

      req.on('close', () => {
        this.sseClients.delete(clientId);
        this.logger.info(`SSE client disconnected: ${clientId}`);
      });

      this.logger.info(`SSE connection established: ${clientId}`, clientInfo);
    } catch (error) {
      this.logger.error('Error handling SSE connection:', error);
      res.status(500).end();
    }
  }

  /**
   * Send event via Server-Sent Events
   * @param {string} clientId - Client identifier
   * @param {Object} data - Data to send
   * @returns {boolean} Success status
   * @private
   */
  _sendSSEEvent(clientId, data) {
    try {
      const client = this.sseClients.get(clientId);
      if (!client || client.res.destroyed) {
        this.sseClients.delete(clientId);
        return false;
      }

      const eventData = `data: ${JSON.stringify(data)}\n\n`;
      client.res.write(eventData);
      return true;
    } catch (error) {
      this.logger.error('Error sending SSE event:', error, { clientId });
      this.sseClients.delete(clientId);
      return false;
    }
  }

  /**
   * Send message to WebSocket connection
   * @param {string} connectionId - Connection identifier
   * @param {Object} message - Message to send
   * @returns {boolean} Success status
   * @private
   */
  _sendToConnection(connectionId, message) {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
        this.connections.delete(connectionId);
        return false;
      }

      connection.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      this.logger.error('Error sending to WebSocket connection:', error, { connectionId });
      this.connections.delete(connectionId);
      return false;
    }
  }

  /**
   * Start heartbeat mechanism
   * @private
   */
  _startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();

      // Check WebSocket connections
      for (const [connectionId, connection] of this.connections) {
        if (connection.ws.readyState === WebSocket.OPEN) {
          if (now - connection.lastPing > this.config.heartbeatInterval * 2) {
            connection.ws.terminate();
            this.connections.delete(connectionId);
          } else {
            connection.ws.ping();
          }
        } else {
          this.connections.delete(connectionId);
        }
      }

      // Check SSE connections
      for (const [clientId, client] of this.sseClients) {
        if (client.res.destroyed || now - client.lastPing > this.config.heartbeatInterval * 2) {
          this.sseClients.delete(clientId);
        } else {
          this._sendSSEEvent(clientId, { type: 'ping', timestamp: now });
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Handle WebSocket pong response
   * @param {string} connectionId - Connection identifier
   * @private
   */
  _handlePong(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastPing = Date.now();
    }
  }

  /**
   * Handle connection disconnection
   * @param {string} connectionId - Connection identifier
   * @private
   */
  _handleDisconnection(connectionId) {
    this.connections.delete(connectionId);
    this.logger.info(`Connection closed: ${connectionId}`);
  }

  /**
   * Handle connection errors
   * @param {string} connectionId - Connection identifier
   * @param {Error} error - Error object
   * @private
   */
  _handleConnectionError(connectionId, error) {
    this.logger.error('Connection error:', error, { connectionId });
    this.connections.delete(connectionId);
  }

  /**
   * Handle server errors
   * @param {Error} error - Error object
   * @private
   */
  _handleServerError(error) {
    this.logger.error('WebSocket server error:', error);
    this.emit('error', error);
  }

  /**
   * Validate channel name
   * @param {string} channel - Channel name to validate
   * @returns {boolean} Valid status
   * @private
   */
  _isValidChannel(channel) {
    const validChannels = [
      'geofence_alerts',
      'case_updates',
      'volunteer_notifications',
      'system_alerts',
      'location_updates'
    ];
    return validChannels.includes(channel);
  }

  /**
   * Generate unique connection ID
   * @returns {string} Connection ID
   * @private
   */
  _generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract client information from request
   * @param {Object} req - HTTP request object
   * @returns {Object} Client information
   * @private
   */
  _extractClientInfo(req) {
    return {
      ip: req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin
    };
  }

  /**
   * Initialize logger
   * @returns {Object} Logger instance
   * @private
   */
  _initLogger() {
    return {
      info: (message, meta = {}) => console.log(`[INFO] EventStreamService: ${message}`, meta),
      warn: (message, meta = {}) => console.warn(`[WARN] EventStreamService: ${message}`, meta),
      error: (message, error = null, meta = {}) => console.error(`[ERROR] EventStreamService: ${message}`, error, meta),
      debug: (message, meta = {}) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[DEBUG] EventStreamService: ${message}`, meta);
        }
      }
    };
  }

  /**
   * Get connection statistics
   * @returns {Object} Connection statistics
   */
  getStats() {
    return {
      websocketConnections: this.connections.size,
      sseConnections: this.sseClients.size,
      totalConnections: this.connections.size + this.sseClients.size,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Gracefully shutdown the service
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
      }

      // Close all WebSocket connections
      for (const [connectionId, connection] of this.connections) {
        connection.ws.close(1001, 'Server shutting down');
      }

      // Close all SSE connections
      for (const [clientId, client] of this.sseClients) {
        client.res.end();
      }

      if (this.wss) {
        await new Promise((resolve) => {
          this.wss.close(resolve);
        });
      }

      this.logger.info('EventStreamService shutdown completed');
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      throw error;
    }
  }
}

module.exports = EventStreamService;