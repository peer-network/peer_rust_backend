// import resolvers from './resolvers';
import { ApolloServer } from 'apollo-server';
import { readFileSync } from 'fs';
import path from 'path';
import resolvers from '../resolvers/resolvers';
import { baseConfig } from '../config/config';

const schemaPath : string = "./schema.graphql"
const typeDefs = readFileSync(path.join(__dirname, schemaPath), 'utf8');

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

// Server starten
server.listen({ port: baseConfig.GRAPHQL.APP_PORT }).then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
}); 