import { 
  ErrorSeverity, 
  ErrorCategory 
} from './ErrorHandler';
import { 
  AlertConfig, 
  defaultAlertConfigs 
} from './ErrorMonitor';
import { 
  RecoveryConfig, 
  RecoveryStrategyType,
  blockchainRecoveryStrategies 
} from './ErrorRecovery';

// ===== ENVIRONMENT CONFIGURATION =====
export interface ErrorHandlingConfig {
  environment: 'development' | 'staging' | 'production';
  monitoring: {
    enabled: boolean;
    maxHistorySize: number;
    cleanupInterval: number;
    alertConfigs: AlertConfig[];
  };
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    structured: boolean;
    includeStackTrace: boolean;
  };
  recovery: {
    enabled: boolean;
    defaultRetries: number;
    maxRecoveryTime: number;
    customStrategies: RecoveryConfig[];
  };
  security: {
    sanitizeErrors: boolean;
    hideSensitiveData: boolean;
    allowedContextFields: string[];
  };
}

// ===== DEFAULT CONFIGURATIONS =====
export const developmentConfig: ErrorHandlingConfig = {
  environment: 'development',
  monitoring: {
    enabled: true,
    maxHistorySize: 500,
    cleanupInterval: 60000, // 1 minute
    alertConfigs: [
      {
        severities: [ErrorSeverity.CRITICAL],
        thresholds: { count: 1 },
        notifications: {
          // In development, just log to console
        }
      }
    ]
  },
  logging: {
    enabled: true,
    level: 'debug',
    structured: true,
    includeStackTrace: true
  },
  recovery: {
    enabled: true,
    defaultRetries: 2,
    maxRecoveryTime: 30000, // 30 seconds
    customStrategies: []
  },
  security: {
    sanitizeErrors: false,
    hideSensitiveData: false,
    allowedContextFields: ['*'] // Allow all in development
  }
};

export const stagingConfig: ErrorHandlingConfig = {
  environment: 'staging',
  monitoring: {
    enabled: true,
    maxHistorySize: 1000,
    cleanupInterval: 300000, // 5 minutes
    alertConfigs: [
      ...defaultAlertConfigs,
      {
        severities: [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL],
        thresholds: { count: 3, timeWindow: 10 },
        notifications: {
          webhook: process.env.STAGING_WEBHOOK_URL
        }
      }
    ]
  },
  logging: {
    enabled: true,
    level: 'info',
    structured: true,
    includeStackTrace: true
  },
  recovery: {
    enabled: true,
    defaultRetries: 3,
    maxRecoveryTime: 60000, // 1 minute
    customStrategies: blockchainRecoveryStrategies
  },
  security: {
    sanitizeErrors: true,
    hideSensitiveData: true,
    allowedContextFields: [
      'userId', 'transactionId', 'operationId', 'walletAddress', 
      'mintAddress', 'amount', 'timestamp', 'operation'
    ]
  }
};

export const productionConfig: ErrorHandlingConfig = {
  environment: 'production',
  monitoring: {
    enabled: true,
    maxHistorySize: 2000,
    cleanupInterval: 600000, // 10 minutes
    alertConfigs: [
      ...defaultAlertConfigs,
      {
        severities: [ErrorSeverity.CRITICAL],
        thresholds: { count: 1 },
        notifications: {
          email: (process.env.ALERT_EMAILS || '').split(','),
          webhook: process.env.ALERT_WEBHOOK_URL,
          slack: process.env.SLACK_WEBHOOK_URL
        }
      },
      {
        severities: [ErrorSeverity.HIGH],
        thresholds: { count: 5, timeWindow: 15 },
        notifications: {
          webhook: process.env.ALERT_WEBHOOK_URL,
          slack: process.env.SLACK_WEBHOOK_URL
        }
      },
      {
        categories: [ErrorCategory.BLOCKCHAIN],
        thresholds: { count: 10, timeWindow: 30 },
        notifications: {
          webhook: process.env.BLOCKCHAIN_ALERT_WEBHOOK_URL
        }
      }
    ]
  },
  logging: {
    enabled: true,
    level: 'warn',
    structured: true,
    includeStackTrace: false // Don't include stack traces in production logs
  },
  recovery: {
    enabled: true,
    defaultRetries: 5,
    maxRecoveryTime: 120000, // 2 minutes
    customStrategies: [
      ...blockchainRecoveryStrategies,
      // Production-specific strategies
      {
        errorCodes: [1201], // Internal server error
        strategy: {
          type: RecoveryStrategyType.CIRCUIT_BREAKER,
          maxAttempts: 1,
          onRecoveryFailure: (error, attempts) => {
            console.error('🚨 CRITICAL: Internal server error circuit breaker activated');
            // Could trigger additional alerting here
          }
        }
      }
    ]
  },
  security: {
    sanitizeErrors: true,
    hideSensitiveData: true,
    allowedContextFields: [
      'userId', 'transactionId', 'operationId', 'timestamp', 'operation'
      // Note: Removed sensitive fields like walletAddress, mintAddress for production
    ]
  }
};

// ===== CONFIGURATION MANAGER =====
export class ErrorConfigManager {
  private static instance: ErrorConfigManager;
  private currentConfig: ErrorHandlingConfig;

  private constructor() {
    this.currentConfig = this.getEnvironmentConfig();
  }

  static getInstance(): ErrorConfigManager {
    if (!ErrorConfigManager.instance) {
      ErrorConfigManager.instance = new ErrorConfigManager();
    }
    return ErrorConfigManager.instance;
  }

  private getEnvironmentConfig(): ErrorHandlingConfig {
    const env = process.env.NODE_ENV || 'development';
    
    switch (env) {
      case 'production':
        return productionConfig;
      case 'staging':
        return stagingConfig;
      case 'development':
      default:
        return developmentConfig;
    }
  }

  getConfig(): ErrorHandlingConfig {
    return this.currentConfig;
  }

  updateConfig(partialConfig: Partial<ErrorHandlingConfig>): void {
    this.currentConfig = {
      ...this.currentConfig,
      ...partialConfig
    };
  }

  // Utility methods for common config checks
  isMonitoringEnabled(): boolean {
    return this.currentConfig.monitoring.enabled;
  }

  isRecoveryEnabled(): boolean {
    return this.currentConfig.recovery.enabled;
  }

  shouldSanitizeErrors(): boolean {
    return this.currentConfig.security.sanitizeErrors;
  }

  getLogLevel(): string {
    return this.currentConfig.logging.level;
  }

  getAllowedContextFields(): string[] {
    return this.currentConfig.security.allowedContextFields;
  }

  // Security: Sanitize error context based on configuration
  sanitizeContext(context: any): any {
    if (!this.shouldSanitizeErrors()) {
      return context;
    }

    if (!context || typeof context !== 'object') {
      return context;
    }

    const allowedFields = this.getAllowedContextFields();
    if (allowedFields.includes('*')) {
      return context;
    }

    const sanitized: any = {};
    for (const field of allowedFields) {
      if (context[field] !== undefined) {
        sanitized[field] = context[field];
      }
    }

    return sanitized;
  }

  // Security: Sanitize error messages
  sanitizeErrorMessage(message: string): string {
    if (!this.shouldSanitizeErrors()) {
      return message;
    }

    // Remove potential sensitive information from error messages
    const sensitivePatterns = [
      /private key/gi,
      /secret/gi,
      /password/gi,
      /token/gi,
      /api[_-]?key/gi,
      /[a-fA-F0-9]{64}/g, // Potential private keys
      /[a-zA-Z0-9+/]{40,}/g // Potential tokens
    ];

    let sanitized = message;
    for (const pattern of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    return sanitized;
  }
}

// ===== SINGLETON INSTANCE =====
export const errorConfig = ErrorConfigManager.getInstance();

// ===== ENVIRONMENT-SPECIFIC OVERRIDES =====
export function initializeErrorHandling(): void {
  const config = errorConfig.getConfig();
  
  console.log(`🔧 Initializing error handling for ${config.environment} environment`);
  console.log(`📊 Monitoring: ${config.monitoring.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`🔄 Recovery: ${config.recovery.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`🔒 Security: ${config.security.sanitizeErrors ? 'Enabled' : 'Disabled'}`);
  
  // Initialize monitoring if enabled
  if (config.monitoring.enabled) {
    const { errorMonitor } = require('./ErrorMonitor');
    errorMonitor.configure({
      enabled: true,
      maxHistorySize: config.monitoring.maxHistorySize,
      alertConfigs: config.monitoring.alertConfigs
    });
  }
  
  // Initialize recovery if enabled
  if (config.recovery.enabled) {
    const { errorRecoveryManager } = require('./ErrorRecovery');
    if (config.recovery.customStrategies.length > 0) {
      errorRecoveryManager.addRecoveryConfigs(config.recovery.customStrategies);
    }
  }
}

// ===== HEALTH CHECK CONFIGURATION =====
export const healthCheckConfig = {
  endpoints: {
    errors: '/health/errors',
    recovery: '/health/recovery',
    system: '/health/system'
  },
  thresholds: {
    errorRate: 10, // per minute
    criticalErrors: 1,
    recoverySuccessRate: 0.8 // 80%
  }
};

// ===== METRICS CONFIGURATION =====
export const metricsConfig = {
  collection: {
    enabled: process.env.NODE_ENV === 'production',
    interval: 60000, // 1 minute
    retention: 24 * 60 * 60 * 1000 // 24 hours
  },
  aggregation: {
    windows: [5, 15, 30, 60], // minutes
    categories: Object.values(ErrorCategory),
    severities: Object.values(ErrorSeverity)
  }
}; 