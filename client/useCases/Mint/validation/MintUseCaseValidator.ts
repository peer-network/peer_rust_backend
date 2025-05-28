import { ErrorCode, ErrorFactory } from "../../../utils/errors";
import { IMintUseCaseValidator } from "./IMintUseCaseValidator";
import { SimpleValidator } from "../../../utils/validation/SimpleValidator";
import { ClientTypes } from "../../../domain/GemsResultsData";

export default class MintUseCaseValidator implements IMintUseCaseValidator {
    
    validateGemsResults(data: any): boolean {
        try {
            return SimpleValidator.validateGemsData(data);
        } catch (error: any) {
            const validationError = ErrorFactory.validationError('gems results', data, error.message);
            throw new Error(`${validationError.message} (Code: ${validationError.code})`);
        }
    }

    validateMintRequest(amount: number, recipient: string): { isValid: boolean; errors?: string[] } {
        const errors: string[] = [];

        if (typeof amount !== 'number' || amount <= 0) {
            const error = ErrorFactory.validationError('amount', amount, 'must be a positive number');
            errors.push(`${error.message} (Code: ${error.code})`);
        }

        if (typeof recipient !== 'string' || !recipient.trim()) {
            const error = ErrorFactory.missingRequiredField('recipient');
            errors.push(`${error.message} (Code: ${error.code})`);
        }

        return {
            isValid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
        };
    }
}