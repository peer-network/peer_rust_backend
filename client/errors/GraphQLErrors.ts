export class GraphQLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphQLError';
  }
}

export class NetworkError extends GraphQLError {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends GraphQLError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
} 