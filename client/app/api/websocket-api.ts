import axios, { AxiosError } from 'axios';
import { logger } from '../../utils/logger';

// API endpoint
const API_URL = process.env.API_URL || 'http://80.158.109.151:5000/graphql';

/**
 * Fetches data from the GraphQL API
 * @returns Promise with the API response data
 */
export async function fetchDataFromAPI() {
  try {
    console.log('🔍 Fetching data from API...');
    const response = await axios.post(API_URL, {
      query: `
        query {
          hello {
            currentuserid
          }
        }
      `
    });
    
    console.log('✅ API Response:', response.data);
    logger.info('API Response received', response.data);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('❌ API Error:', error.message);
      logger.error('API request failed', { error: error.message });
      throw new Error(`API request failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Processes a ping message and returns the appropriate response
 * @param message The received WebSocket message
 * @returns Object containing the response to send back
 */
export function handlePingMessage(message: any) {
  if (message.type === 'ping' && message.message === 'hey are u there') {
    return { 
      type: 'pong', 
      message: 'yes i am here solana',
      client: 'solana'
    };
  }
  return null;
}

/**
 * Creates a data message with API response
 * @param apiData The data received from the API
 * @returns Object containing the data message
 */
export function createDataMessage(apiData: any) {
  return {
    type: 'data',
    message: 'API data fetched',
    data: apiData
  };
}

/**
 * Creates an error message
 * @param error The error that occurred
 * @returns Object containing the error message
 */
export function createErrorMessage(error: Error) {
  return {
    type: 'error',
    message: 'Failed to fetch API data',
    error: error.message
  };
} 