import { IPeerBackendAuthRepository } from "../../interfaces/repos/IPeerBackendAuthRepository";
import { IBackendRepository } from "../../interfaces/repos/IPeerBackendRepository";
import { IUseCase } from "../../interfaces/useCase/IUseCase"
import {clientManager} from "../../app/api/client/client";
import { CodeDescription, ErrorResponse, ErrorHandler, ErrorFactory, ErrorCode } from "../../utils/errors";
import CoreClientResponse from "../../domain/CoreClientResponse";
import { IClientErrorCases } from "../../utils/errors/IClientErrorCases";
import { IAuthServiceValidator } from "./validation/IAuthServiceValidator";
import LoginClient from "../../utils/login";


class AuthServiceErrors implements IClientErrorCases {
    public AUTHENTICATION_FAILED: CodeDescription = {
        code: ErrorCode.AUTHENTICATION_FAILED.toString(),
        message: 'Authentication failed'
    };
    public VALIDATION_ERROR: CodeDescription = {
        code: ErrorCode.VALIDATION_ERROR.toString(),
        message: 'Validation error'
    };
    public CONFIGURATION_ERROR: CodeDescription = {
        code: ErrorCode.CONFIGURATION_ERROR.toString(),
        message: 'Configuration error'
    };
    public EXTERNAL_SERVICE_ERROR: CodeDescription = {
        code: ErrorCode.EXTERNAL_SERVICE_ERROR.toString(),
        message: 'External service error'
    };
    public static TokenUpdateFailed : CodeDescription = {
      code: ErrorCode.EXTERNAL_SERVICE_ERROR.toString(),
      message: 'Token Update Failed'
    };
    public static NoResponseFromPeerBackend : CodeDescription = {
      code: ErrorCode.EXTERNAL_SERVICE_ERROR.toString(),
      message: 'No Response From Peer Backend'
    };
    public static TokenIsNull : CodeDescription = {
      code: ErrorCode.AUTHENTICATION_FAILED.toString(),
      message: 'Access Token is NULL'
    };
}

export class AuthService implements IUseCase {
  errors = new AuthServiceErrors();

  constructor(
    private backendRepo: IBackendRepository,
    private authRepo: IPeerBackendAuthRepository,
    private validator: IAuthServiceValidator,
  ) {}

  async execute(): Promise<CoreClientResponse<any>> {
    try {
      const helloData = await this.backendRepo.getHelloData()
      if (!helloData) {
        return CoreClientResponse.error(AuthServiceErrors.NoResponseFromPeerBackend)
      }
      const userId = helloData.currentuserid

      if (!userId) {
        const loginData = await this.authRepo.getTokenData()
        this.validator.validateLoginResponse(loginData)

        clientManager.updateAccessToken(loginData.accessToken!)
      }
      return CoreClientResponse.success()

    } catch(e) {
      // Use main ErrorHandler to handle any error type
      const errorResponse = ErrorHandler.handle(e);
      return CoreClientResponse.error(errorResponse);
    }
  }

  static async authFunction(password: string, email: string): Promise<any> {
    try {
      const result = await LoginClient.login();
      return result;
    } catch (error: any) {
      const errorResponse = ErrorFactory.authenticationFailed(error?.message || 'Unknown authentication error');
      const response = {
        success: false,
        code: errorResponse.code.toString(),
        message: errorResponse.message,
        details: errorResponse.details
      };
      console.error("AuthService error:", response);
      return response;
    }
  }
}

