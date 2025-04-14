import { logger } from '../../utils/logger';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// API endpoint
const API_URL = process.env.API_URL || 'http://80.158.109.151:5000/graphql';

// Interface for the GemsReady response
interface GemsReadyResponse {
  data: {
    GemsReady: {
      status: string;
      Date: string;
    }
  }
}

/**
 * Function to be called after receiving and responding to a ping
 * Queries the GemsReady endpoint and processes the response
 */
export async function handleDataReady(): Promise<void> {
  try {
    logger.info('Data ready handler triggered');
    
    // Get current date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Query the GemsReady endpoint
    const response = await queryGemsReady(today);
    
    // Process the response
    if (response.data.GemsReady.status === 'success') {
      logger.info('GemsReady query successful', { 
        date: response.data.GemsReady.Date 
      });
      
      // Here we'll add the next query in the next step
      // For now, just log that we're ready to proceed
      logger.info('Ready to proceed with next query');
    } else {
      logger.warn('GemsReady query returned non-success status', { 
        status: response.data.GemsReady.status,
        date: response.data.GemsReady.Date
      });
    }
  } catch (error) {
    logger.error('Error in data ready handler', { error });
    throw error;
  }
}

/**
 * Queries the GemsReady endpoint with the specified date
 * @param date Date in YYYY-MM-DD format
 * @returns Promise with the API response
 */
async function queryGemsReady(date: string): Promise<GemsReadyResponse> {
  try {
    logger.info('Querying GemsReady endpoint', { date });
    
    const response = await axios.post(API_URL, {
      query: `
        query GemsReady($day: String!) {
          GemsReady(day: $day) {
            status
            Date
          }
        }
      `,
      variables: {
        day: date
      }
    });
    
    logger.debug('GemsReady response received', { 
      status: response.data.data?.GemsReady?.status,
      date: response.data.data?.GemsReady?.Date
    });
    
    return response.data;
  } catch (error) {
    logger.error('Failed to query GemsReady endpoint', { error, date });
    throw error;
  }
} 