/// <reference types="jest" />
import { fetchHelloData } from '../api';
import { HelloResponse } from '../types';
import { GraphQLClient } from 'graphql-request';

// Mock GraphQLClient
jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn()
  })),
  gql: jest.fn()
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
  
  describe('fetchHelloData function', () => {
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
    });
    
    it('should handle errors properly', async () => {
      // Setup mock client to throw an error
      const mockError = new Error('Network error');
      mockClient.request.mockRejectedValue(mockError);
      
      // Mock the GraphQLClient constructor
      (GraphQLClient as jest.Mock).mockImplementation(() => mockClient);
      
      // Call the fetchHelloData function and expect it to throw
      await expect(fetchHelloData()).rejects.toThrow('Network error');
      
      // Verify the client was called
      expect(mockClient.request).toHaveBeenCalledTimes(1);
    });
  });
}); 