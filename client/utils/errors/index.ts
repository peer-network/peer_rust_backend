// Direct exports from main ErrorHandler - single source of truth
export { 
  ErrorHandler,
  ErrorFactory,
  ErrorCode,
  OnChainErrorCode,
  ErrorResponse,
  Validators
} from '../../../peer-token/app/errors/ErrorHandler';

// Legacy support - keep only what's heavily used
export { 
  ClientErrorCases,
  IClientErrorCases 
} from './IClientErrorCases';

// Legacy type for backward compatibility
export type CodeDescription = {
  code: string;
  message: string;
};