import { ErrorResponse, ErrorSeverity, ErrorCategory, ErrorMetrics } from './ErrorHandler';

// ===== ERROR AGGREGATION =====
export interface ErrorAggregation {
  errorCode: number;
  category: ErrorCategory;
  severity: ErrorSeverity;
  count: number;
  firstOccurrence: string;
  lastOccurrence: string;
  avgResponseTime?: number;
  impactedUsers: Set<string>;
  contexts: any[];
}

// ===== ALERT CONFIGURATION =====
export interface AlertConfig {
  errorCodes?: number[];
  categories?: ErrorCategory[];
  severities?: ErrorSeverity[];
  thresholds: {
    count?: number;
    timeWindow?: number; // in minutes
    errorRate?: number; // percentage
  };
  notifications: {
    email?: string[];
    webhook?: string;
    slack?: string;
  };
}

// ===== ERROR MONITOR =====
export class ErrorMonitor {
  private static instance: ErrorMonitor;
  private errorHistory: ErrorResponse[] = [];
  private aggregations = new Map<string, ErrorAggregation>();
  private alertConfigs: AlertConfig[] = [];
  private isEnabled = true;

  private constructor() {}

  static getInstance(): ErrorMonitor {
    if (!ErrorMonitor.instance) {
      ErrorMonitor.instance = new ErrorMonitor();
    }
    return ErrorMonitor.instance;
  }

  // ===== CONFIGURATION =====
  configure(config: {
    enabled?: boolean;
    maxHistorySize?: number;
    alertConfigs?: AlertConfig[];
  }): void {
    this.isEnabled = config.enabled ?? true;
    
    if (config.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-config.maxHistorySize);
    }
    
    if (config.alertConfigs) {
      this.alertConfigs = config.alertConfigs;
    }
  }

  // ===== ERROR RECORDING =====
  recordError(error: ErrorResponse, duration?: number): void {
    if (!this.isEnabled) return;

    // Add to history
    this.errorHistory.push({
      ...error,
      ...(duration && { responseTime: duration })
    });

    // Update aggregations
    this.updateAggregations(error, duration);

    // Check for alerts
    this.checkAlerts(error);

    // Cleanup old data
    this.cleanup();
  }

  private updateAggregations(error: ErrorResponse, duration?: number): void {
    const key = `${error.code}-${error.category}`;
    
    if (!this.aggregations.has(key)) {
      this.aggregations.set(key, {
        errorCode: error.code,
        category: error.category,
        severity: error.severity,
        count: 0,
        firstOccurrence: error.timestamp,
        lastOccurrence: error.timestamp,
        impactedUsers: new Set(),
        contexts: []
      });
    }

    const aggregation = this.aggregations.get(key)!;
    aggregation.count++;
    aggregation.lastOccurrence = error.timestamp;
    
    if (error.context?.userId) {
      aggregation.impactedUsers.add(error.context.userId);
    }
    
    if (error.context) {
      aggregation.contexts.push(error.context);
    }

    if (duration) {
      const currentAvg = aggregation.avgResponseTime || 0;
      aggregation.avgResponseTime = (currentAvg + duration) / 2;
    }
  }

  private checkAlerts(error: ErrorResponse): void {
    for (const config of this.alertConfigs) {
      if (this.shouldAlert(error, config)) {
        this.triggerAlert(error, config);
      }
    }
  }

  private shouldAlert(error: ErrorResponse, config: AlertConfig): boolean {
    // Check error code filter
    if (config.errorCodes && !config.errorCodes.includes(error.code)) {
      return false;
    }

    // Check category filter
    if (config.categories && !config.categories.includes(error.category)) {
      return false;
    }

    // Check severity filter
    if (config.severities && !config.severities.includes(error.severity)) {
      return false;
    }

    // Check thresholds
    if (config.thresholds.count) {
      const key = `${error.code}-${error.category}`;
      const aggregation = this.aggregations.get(key);
      if (!aggregation || aggregation.count < config.thresholds.count) {
        return false;
      }
    }

    return true;
  }

  private async triggerAlert(error: ErrorResponse, config: AlertConfig): Promise<void> {
    const alertData = {
      error,
      aggregation: this.aggregations.get(`${error.code}-${error.category}`),
      timestamp: new Date().toISOString()
    };

    try {
      // Email alerts
      if (config.notifications.email) {
        await this.sendEmailAlert(alertData, config.notifications.email);
      }

      // Webhook alerts
      if (config.notifications.webhook) {
        await this.sendWebhookAlert(alertData, config.notifications.webhook);
      }

      // Slack alerts
      if (config.notifications.slack) {
        await this.sendSlackAlert(alertData, config.notifications.slack);
      }
    } catch (alertError) {
      console.error('Failed to send alert:', alertError);
    }
  }

  private async sendEmailAlert(alertData: any, emails: string[]): Promise<void> {
    // Implementation would depend on your email service
    console.log('📧 EMAIL ALERT would be sent to:', emails);
    console.log('Alert data:', JSON.stringify(alertData, null, 2));
  }

  private async sendWebhookAlert(alertData: any, webhook: string): Promise<void> {
    try {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alertData)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Webhook alert failed:', error);
    }
  }

  private async sendSlackAlert(alertData: any, slackUrl: string): Promise<void> {
    try {
      const message = {
        text: `🚨 Error Alert: ${alertData.error.message}`,
        attachments: [
          {
            color: this.getSeverityColor(alertData.error.severity),
            fields: [
              {
                title: 'Error Code',
                value: alertData.error.code.toString(),
                short: true
              },
              {
                title: 'Category',
                value: alertData.error.category,
                short: true
              },
              {
                title: 'Severity',
                value: alertData.error.severity.toUpperCase(),
                short: true
              },
              {
                title: 'Support Reference',
                value: alertData.error.supportReferenceId,
                short: true
              }
            ]
          }
        ]
      };

      const response = await fetch(slackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        throw new Error(`Slack alert failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Slack alert failed:', error);
    }
  }

  private getSeverityColor(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'danger';
      case ErrorSeverity.HIGH:
        return 'warning';
      case ErrorSeverity.MEDIUM:
        return 'good';
      case ErrorSeverity.LOW:
        return '#808080';
      default:
        return 'good';
    }
  }

  private cleanup(): void {
    const maxHistorySize = 1000;
    const maxAggregationAge = 24 * 60 * 60 * 1000; // 24 hours

    // Cleanup history
    if (this.errorHistory.length > maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-maxHistorySize);
    }

    // Cleanup old aggregations
    const cutoffTime = new Date(Date.now() - maxAggregationAge);
    for (const [key, aggregation] of this.aggregations) {
      if (new Date(aggregation.lastOccurrence) < cutoffTime) {
        this.aggregations.delete(key);
      }
    }
  }

  // ===== ANALYTICS =====
  getErrorStats(timeWindow?: number): {
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    topErrors: Array<{ code: number; count: number; message: string }>;
    errorRate: number;
  } {
    const cutoffTime = timeWindow 
      ? new Date(Date.now() - timeWindow * 60 * 1000)
      : new Date(0);

    const recentErrors = this.errorHistory.filter(
      error => new Date(error.timestamp) > cutoffTime
    );

    const errorsByCategory = {} as Record<ErrorCategory, number>;
    const errorsBySeverity = {} as Record<ErrorSeverity, number>;
    const errorCounts = new Map<number, { count: number; message: string }>();

    recentErrors.forEach(error => {
      // By category
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
      
      // By severity
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
      
      // By error code
      if (!errorCounts.has(error.code)) {
        errorCounts.set(error.code, { count: 0, message: error.message });
      }
      errorCounts.get(error.code)!.count++;
    });

    const topErrors = Array.from(errorCounts.entries())
      .map(([code, data]) => ({ code, count: data.count, message: data.message }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors: recentErrors.length,
      errorsByCategory,
      errorsBySeverity,
      topErrors,
      errorRate: recentErrors.length / Math.max(1, timeWindow || 60) // errors per minute
    };
  }

  getAggregations(): ErrorAggregation[] {
    return Array.from(this.aggregations.values())
      .sort((a, b) => b.count - a.count);
  }

  getErrorHistory(limit: number = 100): ErrorResponse[] {
    return this.errorHistory.slice(-limit);
  }

  // ===== HEALTH CHECK =====
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    errorRate: number;
    criticalErrors: number;
    lastError?: ErrorResponse;
  } {
    const recentWindow = 15; // 15 minutes
    const stats = this.getErrorStats(recentWindow);
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (stats.errorsBySeverity[ErrorSeverity.CRITICAL] > 0) {
      status = 'critical';
    } else if (stats.errorRate > 10 || stats.errorsBySeverity[ErrorSeverity.HIGH] > 5) {
      status = 'warning';
    }

    return {
      status,
      errorRate: stats.errorRate,
      criticalErrors: stats.errorsBySeverity[ErrorSeverity.CRITICAL] || 0,
      lastError: this.errorHistory[this.errorHistory.length - 1]
    };
  }

  // ===== RESET =====
  reset(): void {
    this.errorHistory = [];
    this.aggregations.clear();
  }
}

// ===== SINGLETON INSTANCE =====
export const errorMonitor = ErrorMonitor.getInstance();

// ===== DEFAULT ALERT CONFIGURATIONS =====
export const defaultAlertConfigs: AlertConfig[] = [
  {
    severities: [ErrorSeverity.CRITICAL],
    thresholds: {
      count: 1
    },
    notifications: {
      // Configure your notification endpoints here
    }
  },
  {
    severities: [ErrorSeverity.HIGH],
    thresholds: {
      count: 5,
      timeWindow: 15
    },
    notifications: {
      // Configure your notification endpoints here
    }
  },
  {
    categories: [ErrorCategory.BLOCKCHAIN],
    thresholds: {
      count: 10,
      timeWindow: 30
    },
    notifications: {
      // Configure your notification endpoints here
    }
  }
]; 