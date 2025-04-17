import { CodegenConfig } from '@graphql-codegen/cli';
import { baseConfig } from './app/config/config';

const config: CodegenConfig = {
  schema: {
    `${baseConfig.GRAPHQL.PEER_BACKEND_GRAPHQL_ENDPOINT}`: {
      headers: {
        Authorization: `Bearer ${baseConfig.GRAPHQL.PEER_BACKEND_API_TOKEN}`,
      },
    },
  },
  // schema: baseConfig.GRAPHQL.PEER_BACKEND_GRAPHQL_ENDPOINT,
  // this assumes that all your source files are in a top-level `src/` directory - you might need to adjust this to your file structure
  documents: ['src/**/*.{ts,tsx}'],
  generates: {
    './src/__generated__/': {
      preset: 'client',
      plugins: [],
      presetConfig: {
        gqlTagName: 'gql',
      }
    }
  },
  ignoreNoDocuments: true,
};

export default config;