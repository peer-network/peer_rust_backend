# Peer Platform Backend

A Rust-based backend platform for peer network operations.

## Project Structure

- **peer-token-cli**: Token management CLI tool
- **peer-server**: GraphQL server for platform operations
- **peer-common**: Shared utilities and common code

## Getting Started

```bash
# Build all crates
cargo build

# Run the server
cargo run -p peer-server

# Run the token CLI
cargo run -p peer-token-cli
```

## Configuration

Configuration files are located in the `config/` directory:
- `development.toml` - Development environment settings
- `production.toml` - Production environment settings
