import { IBackendRepository } from "../../interfaces/repos/IPeerBackendRepository";
import { IPeerBackendAuthRepository } from "../../interfaces/repos/IPeerBackendAuthRepository";
import { ISolanaRepository } from "../../interfaces/repos/ISolanaRepository";
import { IUseCase } from "../../interfaces/useCase/IUseCase"
import { CodeDescription, ErrorHandler, ErrorFactory, ErrorCode } from "../../utils/errors";
import { AuthService } from "../Auth/AuthService";
import CoreClientResponse from "../../domain/CoreClientResponse";
import { ClientErrorCases, IClientErrorCases } from "../../utils/errors";
// import dailyGemsResultsResponse from "../../domain/mock/dailyGemsResultsResponse.json"
import { IMintUseCaseValidator } from "./validation/IMintUseCaseValidator";
import AuthServiceValidator from "../../useCases/Auth/validation/AuthServiceValidator";
import {ClientTypes} from "../../domain/GemsResultsData"
import {DistributionCalculator} from "../Mint/distributionCalculation/DistributionCalculator"
import { Status } from "../../handlers/solanaProvider/SolanaProviderResponse";

class MintUseCaseErrors implements IClientErrorCases {
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
  public static filedToMint : CodeDescription = {
    code: ErrorCode.TRANSACTION_FAILED.toString(),
    message: 'Failed to mint tokens'
  };
  public static filedToAuthorise : CodeDescription = {
    code: ErrorCode.AUTHORIZATION_DENIED.toString(),
    message: 'Failed to authorize user'
  };
  public static NoResponseFromPeerBackend : CodeDescription = {
    code: ErrorCode.EXTERNAL_SERVICE_ERROR.toString(),
    message: 'No response from PeerBackend service'
  };
}

export class MintUseCase implements IUseCase {
  readonly errors = new MintUseCaseErrors();

  constructor(
    private backendRepo: IBackendRepository,
    private authRepo: IPeerBackendAuthRepository,
    private solanaRepo: ISolanaRepository,
    private validator: IMintUseCaseValidator,
  ) {}

  async execute(day : ClientTypes.DayFilterType): Promise<CoreClientResponse<any>> {
      try {
        await this.authorise()
    
        const gemsData = await this.backendRepo.getDailyGemsResultData(day)
        this.validator.validateGemsResults(gemsData)
        
        const distribution = DistributionCalculator.calculate(gemsData)

        const result = await this.solanaRepo.mint()
        
        if (result.isFailure()) {
          return CoreClientResponse.error(result.error)
        } else {
          return CoreClientResponse.success()
        }
      } catch(e) {
        // Use main ErrorHandler to handle any error type
        const errorResponse = ErrorHandler.handle(e);
        return CoreClientResponse.error(errorResponse);
      }
    }
  
  async authorise() {
    let response = await new AuthService(
      this.backendRepo,
      this.authRepo,
      new AuthServiceValidator()
    ).execute()
    
    if (response.responseCode != CoreClientResponse.successCodeDescription.code) {
      // Use ErrorFactory to create a proper error
      const error = ErrorFactory.transactionFailed('authorization', 'Failed to authorize user');
      throw new Error(`${error.message} (Code: ${error.code})`);
    }
  }
}