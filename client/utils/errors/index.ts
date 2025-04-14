export * from './types';
export * from './factory';
export * from './handler';

import { ErrorHandler } from './handler';

export const errorHandler = ErrorHandler.getInstance(); 