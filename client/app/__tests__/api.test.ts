import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { connectToGraphQL, fetchHelloData } from '../api/client';
import { GraphQLClient } from 'graphql-request';
import dotenv from 'dotenv';
import { logger } from '../../utils/logger';

// Load environment variables
dotenv.config();

// Define the response type
interface HelloResponse {
  hello: {
    currentuserid: string;
  };
}

// Mock environment variables
process.env.GRAPHQL_ENDPOINT = 'https://test-endpoint.com/graphql';
process.env.API_TOKEN = 'test-token';

// Create a type for the mock request function
type MockRequestFunction = (query: string, variables?: any) => Promise<HelloResponse>;

// Mock the GraphQL client
jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn() as MockRequestFunction,
  })),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('API Functions', () => {
  let mockClient: jest.Mocked<GraphQLClient>;
  const endpoint = process.env.GRAPHQL_ENDPOINT!;
  const token = process.env.API_TOKEN!;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new GraphQLClient(endpoint) as jest.Mocked<GraphQLClient>;
  });

  describe('connectToGraphQL', () => {
    it('should create a GraphQL client with correct configuration', () => {
      // Act
      const client = connectToGraphQL();

      // Assert
      expect(GraphQLClient).toHaveBeenCalledWith(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
    });

    it('should throw error when GRAPHQL_ENDPOINT is not defined', () => {
      // Arrange
      delete process.env.GRAPHQL_ENDPOINT;

      // Act & Assert
      expect(() => connectToGraphQL()).toThrow('GRAPHQL_ENDPOINT environment variable is not defined');
    });

    it('should throw error when API_TOKEN is not defined', () => {
      // Arrange
      delete process.env.API_TOKEN;

      // Act & Assert
      expect(() => connectToGraphQL()).toThrow('API_TOKEN environment variable is not defined');
    });
  });

  describe('fetchHelloData', () => {
    const mockResponse: HelloResponse = {
      hello: {
        currentuserid: 'test-user-id'
      }
    };

    beforeEach(() => {
      (mockClient.request as jest.Mock).mockResolvedValue(mockResponse);
    });

    it('should fetch hello data successfully', async () => {
      // Act
      const result = await fetchHelloData();

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledTimes(1);
    });

    it('should handle network errors', async () => {
      // Arrange
      const mockError = new Error('Network error');
      (mockClient.request as jest.Mock).mockRejectedValue(mockError);

      // Act & Assert
      await expect(fetchHelloData()).rejects.toThrow('Network error');
      expect(mockClient.request).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('Error fetching hello data:', mockError);
    });

    it('should handle invalid response format', async () => {
      // Arrange
      const invalidResponse = { invalid: 'format' };
      (mockClient.request as jest.Mock).mockResolvedValue(invalidResponse);

      // Act & Assert
      await expect(fetchHelloData()).rejects.toThrow('Invalid response format');
      expect(mockClient.request).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('Error fetching hello data:', expect.any(Error));
    });

    it('should handle empty response', async () => {
      // Arrange
      (mockClient.request as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(fetchHelloData()).rejects.toThrow('Empty response received');
      expect(mockClient.request).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('Error fetching hello data:', expect.any(Error));
    });
  });

  describe('Integration Tests', () => {
    it('should perform complete workflow', async () => {
      // Arrange
      const expectedResponse: HelloResponse = {
        hello: {
          currentuserid: 'test-user-id'
        }
      };
      (mockClient.request as jest.Mock).mockResolvedValue(expectedResponse);

      // Act
      const client = connectToGraphQL();
      const result = await fetchHelloData();

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(mockClient.request).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent requests', async () => {
      // Arrange
      const expectedResponse: HelloResponse = {
        hello: {
          currentuserid: 'test-user-id'
        }
      };
      (mockClient.request as jest.Mock).mockResolvedValue(expectedResponse);

      // Act
      const promises = Array(3).fill(null).map(() => fetchHelloData());
      const results = await Promise.all(promises);

      // Assert
      results.forEach(result => {
        expect(result).toEqual(expectedResponse);
      });
      expect(mockClient.request).toHaveBeenCalledTimes(3);
    });
  });
}); 