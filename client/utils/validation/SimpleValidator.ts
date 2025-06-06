import { ErrorFactory } from "../errors";
import { ClientTypes } from "../../domain/GemsResultsData";

export class SimpleValidator {
  
  static validateGemsData(data: any): data is ClientTypes.GemsResultsData {
    if (!data || typeof data !== 'object') {
      const error = ErrorFactory.missingRequiredField('gemsData');
      throw new Error(`${error.message} (Code: ${error.code})`);
    }

    if (typeof data.totalGems !== 'number' || data.totalGems <= 0) {
      const error = ErrorFactory.validationError('totalGems', data.totalGems, 'must be a positive number');
      throw new Error(`${error.message} (Code: ${error.code})`);
    }

    if (!Array.isArray(data.data) || data.data.length === 0) {
      const error = ErrorFactory.validationError('data', data.data, 'must be a non-empty array');
      throw new Error(`${error.message} (Code: ${error.code})`);
    }

    // Validate each user gems entry
    for (const userGems of data.data) {
      if (!userGems || typeof userGems !== 'object') {
        const error = ErrorFactory.validationError('userGems', userGems, 'must be a valid object');
        throw new Error(`${error.message} (Code: ${error.code})`);
      }
      
      if (typeof userGems.userid !== 'string' || !userGems.userid.trim()) {
        const error = ErrorFactory.missingRequiredField('userid');
        throw new Error(`${error.message} (Code: ${error.code})`);
      }
      
      if (typeof userGems.gems !== 'number' || userGems.gems < 0) {
        const error = ErrorFactory.validationError('gems', userGems.gems, 'must be a non-negative number');
        throw new Error(`${error.message} (Code: ${error.code})`);
      }
    }

    return true;
  }

  static validateLoginResponse(data: any): boolean {
    if (!data || typeof data !== 'object') {
      const error = ErrorFactory.validationError('loginResponse', data, 'must be a valid object');
      throw new Error(`${error.message} (Code: ${error.code})`);
    }

    // Optional fields - just check they're strings if present
    if (data.userId !== undefined && typeof data.userId !== 'string') {
      const error = ErrorFactory.invalidFormat('userId', 'string');
      throw new Error(`${error.message} (Code: ${error.code})`);
    }

    if (data.accessToken !== undefined && typeof data.accessToken !== 'string') {
      const error = ErrorFactory.invalidFormat('accessToken', 'string');
      throw new Error(`${error.message} (Code: ${error.code})`);
    }

    return true;
  }

  static validateMintRequest(data: any): boolean {
    if (!data || typeof data !== 'object') {
      const error = ErrorFactory.missingRequiredField('mintRequest');
      throw new Error(`${error.message} (Code: ${error.code})`);
    }

    if (typeof data.amount !== 'number' || data.amount <= 0) {
      const error = ErrorFactory.validationError('amount', data.amount, 'must be a positive number');
      throw new Error(`${error.message} (Code: ${error.code})`);
    }

    if (typeof data.recipient !== 'string' || !data.recipient.trim()) {
      const error = ErrorFactory.missingRequiredField('recipient');
      throw new Error(`${error.message} (Code: ${error.code})`);
    }

    return true;
  }
} 