// import resolvers from './resolvers';
import { ApolloServer } from 'apollo-server';
import { readFileSync } from 'fs';
import path from 'path';
import resolvers from '../resolvers/resolvers';

const schemaPath : string = "./schema.graphql"
const typeDefs = readFileSync(path.join(__dirname, schemaPath), 'utf8');

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

// Server starten
server.listen({ port: 4000 }).then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
}); 