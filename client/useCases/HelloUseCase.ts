import { IUseCase } from "../interfaces/useCase/IUseCase";
import GitInfo from '../utils/gitInfo';
import { HelloResponse } from '../infrastructure/gql/generated-types/server/types-server';
import CoreClientResponse from '../domain/CoreClientResponse';
import { ClientErrorCases } from "../utils/errors";
import { ErrorFactory } from '../utils/errors';

export class HelloUseCase implements IUseCase {
  readonly errors = ClientErrorCases;

  async execute(): Promise<CoreClientResponse<HelloResponse>> {
    try {
      const helloResponse: HelloResponse = {
        currentuserid: "user123", // You can make this dynamic based on your needs
        currentVersion: GitInfo.getLastCommitId(),
        wikiLink: `https://github.com/your-repo/tree/${GitInfo.getBranch()}`
      };
      
      if (!helloResponse.currentVersion) {
        const error = ErrorFactory.configurationError('git version', 'Unable to retrieve git commit information');
        return CoreClientResponse.error(error);
      }
      
      return CoreClientResponse.success(helloResponse);
    } catch (error: any) {
      const errorResponse = ErrorFactory.internalServerError('hello operation', error);
      return CoreClientResponse.error(errorResponse);
    }
  }
}