import { GraphQLClient, gql } from 'graphql-request';
import { connectToGraphQL, fetchHelloData } from '../api/client';
import { HelloResponse } from '../types';
import { logger } from '../../utils/logger';
import axios from 'axios';

// Mock GraphQLClient
jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn()
  })),
  gql: jest.fn()
}));

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }
}));

describe('API Client', () => {
  let mockClient: jest.Mocked<GraphQLClient>;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup mock client
    mockClient = new GraphQLClient('mock-endpoint') as jest.Mocked<GraphQLClient>;
    mockClient.request = jest.fn();
    
    // Mock environment variables
    process.env.GRAPHQL_ENDPOINT = 'https://test-api.example.com/graphql';
    process.env.API_TOKEN = 'test-token';
  });
  
  afterEach(() => {
    // Restore environment variables
    delete process.env.GRAPHQL_ENDPOINT;
    delete process.env.API_TOKEN;
    
    // Clear module cache
    jest.resetModules();
  });

  describe('connectToGraphQL', () => {
    it('should create a GraphQL client with correct configuration', () => {
      // Mock the GraphQLClient constructor
      (GraphQLClient as jest.Mock).mockImplementation(() => mockClient);
      
      // Call the connectToGraphQL function
      const client = connectToGraphQL();
      
      // Verify the client was created with correct parameters
      expect(GraphQLClient).toHaveBeenCalledWith(
        'https://test-api.example.com/graphql',
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          }
        }
      );
      
      // Verify logger was called
      expect(logger.info).toHaveBeenCalledWith(
        'Connecting to GraphQL API: https://test-api.example.com/graphql'
      );
    });

    it('should throw error when GRAPHQL_ENDPOINT is not defined', () => {
      // Remove the environment variable
      delete process.env.GRAPHQL_ENDPOINT;
      
      // Expect the function to throw
      expect(() => connectToGraphQL()).toThrow('GRAPHQL_ENDPOINT is not defined in the .env file');
    });

    it('should throw error when API_TOKEN is not defined', () => {
      // Remove the environment variable
      delete process.env.API_TOKEN;
      
      // Expect the function to throw
      expect(() => connectToGraphQL()).toThrow('API_TOKEN is not defined in the .env file');
    });
  });

  describe('fetchHelloData', () => {
    it('should successfully fetch hello data', async () => {
      // Mock response data
      const mockHelloData: HelloResponse = {
        hello: {
          currentuserid: 'user123'
        }
      };
      
      // Setup mock client request
      mockClient.request.mockResolvedValue(mockHelloData);
      
      // Mock the GraphQLClient constructor
      (GraphQLClient as jest.Mock).mockImplementation(() => mockClient);
      
      // Call the fetchHelloData function
      const result = await fetchHelloData();
      
      // Verify the result
      expect(result).toEqual(mockHelloData);
      
      // Verify the client was called with the correct query
      expect(mockClient.request).toHaveBeenCalledTimes(1);
      
      // Verify logger was called
      expect(logger.info).toHaveBeenCalledWith('Fetching hello data...');
      expect(logger.info).toHaveBeenCalledWith('Hello data fetched successfully:', mockHelloData);
    });

    it('should handle network errors properly', async () => {
      // Setup mock client to throw an error
      const mockError = new Error('Network error');
      mockClient.request.mockRejectedValue(mockError);
      
      // Mock the GraphQLClient constructor
      (GraphQLClient as jest.Mock).mockImplementation(() => mockClient);
      
      // Call the fetchHelloData function and expect it to throw
      await expect(fetchHelloData()).rejects.toThrow('Network error');
      
      // Verify the client was called
      expect(mockClient.request).toHaveBeenCalledTimes(1);
      
      // Verify logger was called with the correct error messages
      expect(logger.info).toHaveBeenCalledWith('Fetching hello data...');
      expect(logger.error).toHaveBeenCalledWith('Error fetching hello data:', mockError);
      expect(logger.error).toHaveBeenCalledWith(`Error details: ${mockError.message}`);
      expect(logger.error).toHaveBeenCalledWith(`Error stack: ${mockError.stack}`);
    });

    it('should handle GraphQL errors properly', async () => {
      // Setup mock client to throw a GraphQL error
      const mockGraphQLError = {
        message: 'GraphQL Error',
        locations: [{ line: 1, column: 1 }],
        path: ['hello'],
        extensions: { code: 'INTERNAL_SERVER_ERROR' }
      };
      mockClient.request.mockRejectedValue(mockGraphQLError);
      
      // Mock the GraphQLClient constructor
      (GraphQLClient as jest.Mock).mockImplementation(() => mockClient);
      
      // Call the fetchHelloData function and expect it to throw
      await expect(fetchHelloData()).rejects.toEqual(mockGraphQLError);
      
      // Verify the client was called
      expect(mockClient.request).toHaveBeenCalledTimes(1);
      
      // Verify logger was called
      expect(logger.info).toHaveBeenCalledWith('Fetching hello data...');
      expect(logger.error).toHaveBeenCalledWith('Error fetching hello data:', mockGraphQLError);
    });
  });
}); 