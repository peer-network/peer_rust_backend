import { GraphQLClient, gql } from 'graphql-request';
import { logger } from '../../utils/logger';
import { HelloResponse } from '../types/index';

// GraphQL queries
const HELLO_QUERY = gql`
  query hello {
    hello {
      currentuserid
    }
  }
`;

/**
 * Creates a connection to the GraphQL API
 */
export function connectToGraphQL(): GraphQLClient {
  const endpoint = process.env.GRAPHQL_ENDPOINT;
  const token = process.env.API_TOKEN;

  if (!endpoint) {
    throw new Error('GRAPHQL_ENDPOINT is not defined in the .env file');
  }

  if (!token) {
    throw new Error('API_TOKEN is not defined in the .env file');
  }


  logger.info(`Connecting to GraphQL API: ${endpoint}`);
  
  return new GraphQLClient(endpoint, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}



/**
 * Fetches hello data from the GraphQL API
 */
export async function fetchHelloData(): Promise<HelloResponse> {
  const client = connectToGraphQL();
  
  try {
    logger.info('Fetching hello data...');
    const data = await client.request<HelloResponse>(HELLO_QUERY);
    logger.info('Hello data fetched successfully:', data);
    return data;
  } catch (error) {
    logger.error('Error fetching hello data:', error);
    if (error instanceof Error) {
      logger.error(`Error details: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
    }
    throw error;
  }
} 