export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function validateEnvironment(): void {
  if (!process.env.GRAPHQL_ENDPOINT) {
    throw new Error('GRAPHQL_ENDPOINT is not defined in the .env file');
  }
  if (!process.env.API_TOKEN) {
    throw new Error('API_TOKEN is not defined in the .env file');
  }
}

export function exponentialBackoff(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
} 