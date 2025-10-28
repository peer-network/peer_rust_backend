
use async_graphql::http::{playground_source, GraphQLPlaygroundConfig};
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{
    extract::Extension,
    http::StatusCode,
    response::{Html, IntoResponse},
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tracing::{info, debug};



use peer_common::config::PlatformConfig;
use crate::graphql::{ create_schema, PeerSchema };

pub struct GraphQLServer {
    config: PlatformConfig,
    schema: PeerSchema,
}

impl GraphQLServer {
    /// Create a new GraphQL server instance
    pub async fn new(config: PlatformConfig) -> anyhow::Result<Self> {
        info!(" Creating GraphQL server");
        
          let schema = create_schema(config.clone());
        debug!("GraphQL schema created with platform config");
        
        Ok(Self { config, schema })
    }

    /// Start the GraphQL server
    pub async fn run(self) -> anyhow::Result<()> {
        let host = self.config.server.host.clone();
        let port = self.config.server.port;
        
        info!("Starting GraphQL server on {}:{}", host, port);
        
        // Create the router with GraphQL endpoints
        let app = self.create_router();
        
        // Create socket address
        let addr: SocketAddr = format!("{}:{}", host, port)
            .parse()
            .map_err(|e| anyhow::anyhow!("Invalid server address: {}", e))?;
            
        info!("Server running at:");
        info!("   GraphQL API:    http://{}:{}/graphql", host, port);
        info!("   GraphQL Studio: http://{}:{}/", host, port);
        
        // Start the server
        axum::Server::bind(&addr)
            .serve(app.into_make_service())
            .await?;
        
        Ok(())
    }

    fn create_router(self) -> Router {
        Router::new()
            .route("/graphql", post(graphql_handler))
            .route("/", get(graphql_playground))
            .route("/health", get(health_check))
            .layer(Extension(self.schema))
            .layer(CorsLayer::permissive()) // Allow all origins in development
    }

    /// Get server host
    pub fn host(&self) -> &str {
        &self.config.server.host
    }

    /// Get server port
    pub fn port(&self) -> u16 {
        self.config.server.port
    }
}

/// Handle GraphQL requests
async fn graphql_handler(
    schema: Extension<PeerSchema>,
    req: GraphQLRequest,
) -> GraphQLResponse {
    debug!(" Received GraphQL request");
    schema.execute(req.into_inner()).await.into()
}

/// Serve GraphQL Playground for development
async fn graphql_playground() -> impl IntoResponse {
    Html(playground_source(GraphQLPlaygroundConfig::new("/graphql")))
}

/// Simple health check endpoint
async fn health_check() -> impl IntoResponse {
    debug!("Health check requested");
    (StatusCode::OK, "PEER Platform Backend is healthy!")
}
