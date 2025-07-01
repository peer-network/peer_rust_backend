# Production-Grade Error Handling System

## Overview

This directory contains a comprehensive, production-ready error handling system designed for the peer-token project. The system provides advanced error categorization, monitoring, recovery strategies, and security features suitable for enterprise-level applications.

## Architecture

### Core Components

1. **ErrorHandler.ts** - Main error handling engine with categorization, severity levels, and factory patterns
2. **ErrorMonitor.ts** - Real-time error monitoring, aggregation, and alerting system
3. **ErrorRecovery.ts** - Automatic error recovery with circuit breaker patterns and retry strategies
4. **ErrorConfig.ts** - Environment-specific configuration management
5. **index.ts** - Unified exports and global error handlers

## Features

### 🎯 Advanced Error Categorization

- **Error Categories**: Authentication, Authorization, Validation, Business Logic, Network, Blockchain, System, External Service, Configuration, Data
- **Severity Levels**: Low, Medium, High, Critical
- **Hierarchical Error Codes**: Organized by category (700-799: Auth, 800-899: Validation, etc.)

### 📊 Real-time Monitoring

```typescript
import { errorMonitor } from './errors';

// Get system health
const health = errorMonitor.getHealthStatus();
console.log(`System status: ${health.status}`);

// Get error statistics
const stats = errorMonitor.getErrorStats(15); // Last 15 minutes
console.log(`Error rate: ${stats.errorRate} per minute`);
```

### 🔄 Automatic Recovery

```typescript
import { withRecovery, ProductionErrorHandler } from './errors';

// Automatic retry with exponential backoff
const result = await withRecovery(async () => {
  return await riskyBlockchainOperation();
});

// Full error handling with monitoring and recovery
const result = await ProductionErrorHandler.handleWithFullRecovery(async () => {
  return await complexOperation();
}, { userId: 'user123', operation: 'mint' });
```

### 🛡️ Security Features

- **Data Sanitization**: Automatic removal of sensitive information from error messages
- **Context Filtering**: Environment-specific context field filtering
- **Secure Logging**: Production-safe error logging with configurable verbosity

### 🔧 Environment Configuration

```typescript
import { initializeErrorHandling } from './errors';

// Initialize with environment-specific settings
initializeErrorHandling();

// Development: Full logging, no sanitization
// Staging: Structured logging, basic alerts
// Production: Sanitized errors, full alerting, circuit breakers
```

## Quick Start

### 1. Basic Error Handling

```typescript
import { ErrorFactory, ProductionErrorHandler } from './errors';

try {
  // Your operation
  await tokenMint();
} catch (error) {
  // Comprehensive error handling
  const errorResponse = ProductionErrorHandler.handle(error, {
    userId: 'user123',
    operation: 'mint',
    amount: 1000
  });
  
  // Error is automatically logged, monitored, and categorized
  throw errorResponse;
}
```

### 2. Creating Custom Errors

```typescript
import { ErrorFactory } from './errors';

// Business logic error
throw ErrorFactory.dailyLimitExceeded(1000, 1500, {
  userId: 'user123',
  walletAddress: 'wallet456'
});

// Blockchain error with recovery info
throw ErrorFactory.transactionFailed('mint', error, txSignature, {
  mintAddress: 'mint789',
  amount: 1000
});
```

### 3. Advanced Recovery Strategies

```typescript
import { errorRecoveryManager, RecoveryStrategyType } from './errors';

// Add custom recovery strategy
errorRecoveryManager.addRecoveryConfig({
  errorCodes: [1001], // Mint not found
  strategy: {
    type: RecoveryStrategyType.FALLBACK,
    fallbackFunction: async () => {
      return await createMintAccount();
    },
    onRecoverySuccess: (error, result) => {
      console.log('Successfully created missing mint account');
    }
  }
});
```

### 4. Monitoring and Alerts

```typescript
import { errorMonitor, AlertConfig } from './errors';

// Configure production alerts
errorMonitor.configure({
  alertConfigs: [
    {
      severities: [ErrorSeverity.CRITICAL],
      thresholds: { count: 1 },
      notifications: {
        email: ['admin@company.com'],
        slack: process.env.SLACK_WEBHOOK_URL
      }
    }
  ]
});
```

## Error Codes Reference

### Authentication & Authorization (700-799)
- `701` - Authentication Failed
- `702` - Authorization Denied
- `703` - Token Expired
- `704` - Invalid Credentials

### Validation Errors (800-899)
- `801` - Validation Error
- `802` - Missing Required Field
- `803` - Invalid Format
- `804` - Invalid Range

### Business Logic (900-999)
- `901` - Insufficient Balance
- `902` - Daily Limit Exceeded
- `903` - Operation Not Allowed
- `905` - Already Minted Today

### Blockchain Specific (1000-1099)
- `1001` - Mint Not Found
- `1002` - Token Account Not Found
- `1003` - Transaction Failed
- `1007` - Insufficient SOL

### Network & Connection (1100-1199)
- `1101` - Connection Failed
- `1102` - Connection Timeout
- `1105` - Rate Limit Exceeded

### On-Chain Error Codes (6000+)
- `6000` - Invalid Mint (from Rust program)
- `6004` - Insufficient PEER Tokens
- `6008` - Already Minted Today

## Configuration

### Environment Variables

```bash
# Production alerting
ALERT_EMAILS=admin@company.com,devops@company.com
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
BLOCKCHAIN_ALERT_WEBHOOK_URL=https://custom-webhook.com/blockchain

# Environment
NODE_ENV=production
```

### Development Setup

```typescript
import { developmentConfig } from './errors/ErrorConfig';

// Development features:
// - Full error context
// - Stack traces included
// - No data sanitization
// - Console-only alerts
```

### Production Setup

```typescript
import { productionConfig } from './errors/ErrorConfig';

// Production features:
// - Sanitized error messages
// - Context field filtering
// - Multi-channel alerting
// - Circuit breaker protection
// - Advanced recovery strategies
```

## Best Practices

### 1. Always Use Context

```typescript
// Good
ProductionErrorHandler.handle(error, {
  userId: user.id,
  operation: 'daily_mint',
  amount: 5000,
  walletAddress: wallet.publicKey.toString()
});

// Basic (still works)
ProductionErrorHandler.handle(error);
```

### 2. Leverage Recovery Wrapper

```typescript
// Automatic recovery for critical operations
const result = await ProductionErrorHandler.handleWithFullRecovery(async () => {
  return await criticalBlockchainOperation();
}, { userId, operation: 'critical_mint' });
```

### 3. Monitor System Health

```typescript
// Regular health checks
setInterval(() => {
  const health = ProductionErrorHandler.getSystemHealth();
  if (health.errorMonitor.status === 'critical') {
    // Trigger additional alerts
  }
}, 60000); // Every minute
```

### 4. Use Structured Logging

```typescript
// The system automatically structures logs
// In production, you'll see:
// 🚨 ERROR [1003] - BLOCKCHAIN
// 📝 Message: Transaction failed during mint
// 👤 User Message: Transaction failed. Please try again.
// 🏷️ Severity: HIGH
// 🔄 Recoverable: Yes
// 🔁 Retryable: Yes
// 🆔 Reference: abc123def456
```

## Integration Examples

### Token Operations

```typescript
// In mint operations
try {
  const result = await withRecovery(async () => {
    return await performDailyMint();
  }, ProductionErrorHandler.handle);
  
  return result;
} catch (error) {
  // Error is already handled, monitored, and recovery attempted
  throw error;
}
```

### API Endpoints

```typescript
app.post('/api/mint', async (req, res) => {
  try {
    const result = await ProductionErrorHandler.handleWithFullRecovery(async () => {
      return await mintTokens(req.body);
    }, { 
      userId: req.user?.id, 
      endpoint: '/api/mint',
      userAgent: req.get('User-Agent')
    });
    
    res.json(result);
  } catch (error) {
    // Error response is properly formatted for API consumption
    res.status(error.severity === 'critical' ? 500 : 400).json({
      error: {
        code: error.code,
        message: error.userMessage,
        reference: error.supportReferenceId,
        retryable: error.retryable,
        suggestedActions: error.suggestedActions
      }
    });
  }
});
```

## Monitoring Dashboard Data

The system provides rich data for building monitoring dashboards:

```typescript
// Get comprehensive error statistics
const stats = errorMonitor.getErrorStats(60); // Last hour
const aggregations = errorMonitor.getAggregations();
const recoveryStats = errorRecoveryManager.getRecoveryStats();

// Example dashboard data:
{
  totalErrors: 15,
  errorRate: 0.25, // per minute
  errorsByCategory: {
    blockchain: 8,
    validation: 4,
    network: 3
  },
  errorsBySeverity: {
    critical: 1,
    high: 5,
    medium: 6,
    low: 3
  },
  recoverySuccessRate: 0.87,
  topErrors: [
    { code: 1003, count: 5, message: "Transaction failed" },
    { code: 905, count: 3, message: "Already minted today" }
  ]
}
```

## Testing

The error handling system includes comprehensive test utilities:

```typescript
import { errorMonitor, errorRecoveryManager } from './errors';

// Reset state between tests
beforeEach(() => {
  errorMonitor.reset();
  errorRecoveryManager.reset();
});

// Test error handling
it('should handle blockchain errors correctly', async () => {
  const error = ErrorFactory.transactionFailed('test', new Error('Network timeout'));
  expect(error.retryable).toBe(true);
  expect(error.category).toBe(ErrorCategory.BLOCKCHAIN);
});
```

## Support and Troubleshooting

Each error includes a unique support reference ID (`supportReferenceId`) that can be used to:

1. Track the error in monitoring systems
2. Correlate related errors
3. Provide to users for support tickets
4. Debug specific error instances

The system is designed to be self-healing and provide maximum uptime while giving operators the visibility needed to maintain and improve the system. 