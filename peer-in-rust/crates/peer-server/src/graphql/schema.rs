
use async_graphql::{EmptySubscription, Schema};
use crate::graphql::queries::Query;
use crate::graphql::mutations::Mutation;
use peer_common::config::PlatformConfig;

/// Main GraphQL Schema type
pub type PeerSchema = Schema<Query, Mutation, EmptySubscription>;


/// Create the GraphQL schema with the given configuration
pub fn create_schema(config: PlatformConfig) -> PeerSchema {
    Schema::build(Query::default(), Mutation::default(), EmptySubscription)
        .data(config)
        .finish()
}

