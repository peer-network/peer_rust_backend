import WebSocket from 'ws';
import { logger } from '../../utils/logger';
import dotenv from 'dotenv';
import { EventEmitter } from 'events';

// Load environment variables
dotenv.config();

interface WebSocketMessage {
  type: string;
  message: string;
  client?: string;
  data?: any;
}

class SolanaWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly options: WebSocket.ClientOptions;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;
  private readonly initialReconnectDelay: number = 1000;
  private readonly maxReconnectDelay: number = 30000;
  private reconnectTimeout?: NodeJS.Timeout;
  private pingTimeout?: NodeJS.Timeout;
  private isAlive: boolean = false;

  constructor() {
    super();
    this.url = process.env.WS_URL || 'ws://80.158.109.151:5000';
    this.options = {
      handshakeTimeout: 10000,
      headers: {
        'User-Agent': 'Solana-Client'
      }
    };
  }

  public async connect(): Promise<void> {
    try {
      this.ws = new WebSocket(this.url, this.options);
      this.attachEventListeners();
      logger.info('Attempting to connect to WebSocket server', { url: this.url });
    } catch (error) {
      logger.error('Failed to create WebSocket connection', { error });
      this.handleConnectionFailure();
    }
  }

  private attachEventListeners(): void {
    if (!this.ws) return;

    this.ws.on('open', () => this.handleConnection());
    this.ws.on('message', (data) => {
      try {
        // Handle all possible WebSocket data types
        let messageStr: string;
        if (Buffer.isBuffer(data)) {
          messageStr = data.toString('utf8');
        } else if (data instanceof ArrayBuffer) {
          messageStr = Buffer.from(data).toString('utf8');
        } else if (data instanceof Uint8Array) {
          messageStr = Buffer.from(data).toString('utf8');
        } else {
          messageStr = String(data);
        }
        this.handleMessage(messageStr);
      } catch (error) {
        logger.error('Failed to process WebSocket message data', { error });
      }
    });
    this.ws.on('error', (error) => this.handleError(error));
    this.ws.on('close', (code, reason) => this.handleClose(code, reason));
    this.ws.on('ping', () => this.handlePing());
    this.ws.on('pong', () => this.handlePong());
  }

  private handleConnection(): void {
    this.isAlive = true;
    this.reconnectAttempts = 0;
    logger.info('WebSocket connection established successfully');
    this.emit('connected');
    this.setupPingTimeout();
  }

  private handleMessage(messageStr: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(messageStr);
      logger.debug('Received WebSocket message', { message });

      if (message.type === 'ping' && message.message === 'hey are u there') {
        this.handlePingMessage();
      }

      this.emit('message', message);
    } catch (error) {
      logger.error('Failed to process WebSocket message', { error, messageStr });
    }
  }

  private handlePingMessage(): void {
    try {
      const response: WebSocketMessage = {
        type: 'pong',
        message: 'yes i am here solana',
        client: 'solana'
      };

      this.sendMessage(response);
      this.emit('ping-received');
    } catch (error) {
      logger.error('Failed to handle ping message', { error });
    }
  }

  private handleError(error: Error): void {
    logger.error('WebSocket error occurred', {
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    this.emit('error', error);
  }

  private handleClose(code: number, reason: string): void {
    this.isAlive = false;
    this.clearTimeouts();
    logger.warn('WebSocket connection closed', { code, reason });
    this.emit('disconnected', { code, reason });
    this.handleConnectionFailure();
  }

  private handleConnectionFailure(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Maximum reconnection attempts reached', {
        attempts: this.reconnectAttempts
      });
      this.emit('max-retries-reached');
      return;
    }

    const delay = Math.min(
      this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    this.reconnectAttempts++;
    logger.info('Scheduling reconnection attempt', {
      attempt: this.reconnectAttempts,
      delay
    });

    this.reconnectTimeout = setTimeout(() => this.connect(), delay);
  }

  private handlePing(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.pong();
    }
  }

  private handlePong(): void {
    this.isAlive = true;
  }

  private setupPingTimeout(): void {
    this.pingTimeout = setInterval(() => {
      if (!this.isAlive) {
        logger.warn('Connection dead - terminating');
        this.terminate();
        return;
      }
      this.isAlive = false;
      this.ws?.ping();
    }, 30000);
  }

  private clearTimeouts(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.pingTimeout) {
      clearInterval(this.pingTimeout);
    }
  }

  public sendMessage(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.error('Cannot send message - connection not open');
      throw new Error('WebSocket connection not open');
    }

    try {
      this.ws.send(JSON.stringify(message));
      logger.debug('Sent WebSocket message', { message });
    } catch (error) {
      logger.error('Failed to send WebSocket message', { error, message });
      throw error;
    }
  }

  public terminate(): void {
    this.clearTimeouts();
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
    this.emit('terminated');
  }
}

// Create and export singleton instance
export const wsClient = new SolanaWebSocketClient();

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Process termination signal received');
  wsClient.terminate();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  wsClient.terminate();
  process.exit(1);
}); 