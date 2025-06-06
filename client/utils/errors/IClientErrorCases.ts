// Legacy ClientErrorCases - only for backward compatibility
// Import directly from main ErrorHandler
import { ErrorCode } from '../../../peer-token/app/errors/ErrorHandler';
import { CodeDescription } from ".";

export interface IClientErrorCases {
    AUTHENTICATION_FAILED: CodeDescription;
    VALIDATION_ERROR: CodeDescription;
    CONFIGURATION_ERROR: CodeDescription;
    EXTERNAL_SERVICE_ERROR: CodeDescription;
}

export const ClientErrorCases: IClientErrorCases = {
    AUTHENTICATION_FAILED: {
        code: ErrorCode.AUTHENTICATION_FAILED.toString(),
        message: 'Authentication failed'
    },
    VALIDATION_ERROR: {
        code: ErrorCode.VALIDATION_ERROR.toString(),
        message: 'Validation error'
    },
    CONFIGURATION_ERROR: {
        code: ErrorCode.CONFIGURATION_ERROR.toString(),
        message: 'Configuration error'
    },
    EXTERNAL_SERVICE_ERROR: {
        code: ErrorCode.EXTERNAL_SERVICE_ERROR.toString(),
        message: 'External service error'
    }
}; 