// ===== CORE ERROR HANDLING =====
export * from './ErrorHandler';

// ===== ERROR MONITORING =====
export * from './ErrorMonitor';

// ===== ERROR RECOVERY =====
export * from './ErrorRecovery';

// ===== ENHANCED ERROR LOGGER INTEGRATION =====
import { ErrorHandler, ErrorLogger } from './ErrorHandler';
import { errorMonitor } from './ErrorMonitor';
import { errorRecoveryManager } from './ErrorRecovery';

// Enhanced error handler that integrates monitoring and recovery
export class ProductionErrorHandler {
  static async handleWithFullRecovery<T>(
    operation: () => Promise<T>,
    context?: any
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      return await operation();
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorResponse = ErrorHandler.handle(error, context);
      
      // Record in monitoring system
      errorMonitor.recordError(errorResponse, duration);
      
      // Attempt recovery
      const recoveryResult = await errorRecoveryManager.attemptRecovery(
        operation,
        errorResponse,
        context
      );
      
      if (recoveryResult.success) {
        return recoveryResult.result!;
      }
      
      // If recovery failed, throw the processed error
      throw recoveryResult.error || errorResponse;
    }
  }
  
  static handle(error: any, context?: any) {
    const errorResponse = ErrorHandler.handle(error, context);
    errorMonitor.recordError(errorResponse);
    return errorResponse;
  }
  
  static getSystemHealth() {
    return {
      errorMonitor: errorMonitor.getHealthStatus(),
      recovery: errorRecoveryManager.getRecoveryStats()
    };
  }
}

// Global error handler for unhandled promise rejections
if (typeof process !== 'undefined') {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 UNHANDLED PROMISE REJECTION:', reason);
    ProductionErrorHandler.handle(reason, { 
      type: 'unhandledRejection',
      promise: promise.toString() 
    });
  });
  
  process.on('uncaughtException', (error) => {
    console.error('🚨 UNCAUGHT EXCEPTION:', error);
    ProductionErrorHandler.handle(error, { 
      type: 'uncaughtException' 
    });
    // Don't exit the process in production, let it recover
  });
} 