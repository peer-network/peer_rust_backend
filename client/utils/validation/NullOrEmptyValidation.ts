import { ErrorHandler, ErrorFactory } from "../errors";

export class EmptyOrNullValidator {
    static validateAndGet<T>(obj: T | null | undefined): T {
        if (obj === null || obj === undefined) {
            // Use ErrorFactory to create a proper error
            const error = ErrorFactory.validationError('object', 'null or undefined');
            throw new Error(`${error.message} (Code: ${error.code})`);
        }
        return obj;
    }
}