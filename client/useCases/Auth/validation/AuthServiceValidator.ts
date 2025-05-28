import { ErrorHandler, ErrorFactory, ErrorCode } from "../../../utils/errors";
import { ClientErrorCases, IClientErrorCases } from "../../../utils/errors";
import { IAuthServiceValidator } from "./IAuthServiceValidator";
import { SimpleValidator } from "../../../utils/validation/SimpleValidator";

class AuthServiceValidatorErrors implements IClientErrorCases {
  public AUTHENTICATION_FAILED = {
    code: ErrorCode.AUTHENTICATION_FAILED.toString(),
    message: 'Authentication failed'
  };
  public VALIDATION_ERROR = {
    code: ErrorCode.VALIDATION_ERROR.toString(),
    message: 'Validation error'
  };
  public CONFIGURATION_ERROR = {
    code: ErrorCode.CONFIGURATION_ERROR.toString(),
    message: 'Configuration error'
  };
  public EXTERNAL_SERVICE_ERROR = {
    code: ErrorCode.EXTERNAL_SERVICE_ERROR.toString(),
    message: 'External service error'
  };
  public static LOGIN_RESPONSE_VALIDATION_FAILED = {
    code: ErrorCode.VALIDATION_ERROR.toString(),
    message: 'Login Response Validation Failed'
  };
}

export default class AuthServiceValidator implements IAuthServiceValidator {
  errors = AuthServiceValidatorErrors;

  validateLoginResponse(data: any): void {
    SimpleValidator.validateLoginResponse(data);
  }
}