import { IResolvers } from '@graphql-tools/utils';

const resolvers: IResolvers = {
  Query: {
    hello: () => 'Hello from Apollo + TS!',
  },
};

export default resolvers;