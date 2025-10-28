#!/bin/bash
set -e

echo "🔧 Installing PEER Token CLI"
echo "════════════════════════════════════"

# Check if in workspace root
if [ ! -f "Cargo.toml" ]; then
    echo "❌ Error: Run this script from workspace root (peer-platform-backend/)"
    exit 1
fi

# Build release binary
echo "📦 Building release binary..."
cargo build --package peer-token-cli --release

# Get binary path
BINARY_PATH="$(pwd)/target/release/peer-token"

if [ ! -f "$BINARY_PATH" ]; then
    echo "❌ Error: Binary not found at $BINARY_PATH"
    exit 1
fi

echo "✅ Binary built successfully"
echo "   Location: $BINARY_PATH"

# Option 1: Install to ~/.cargo/bin (global)
read -p "Install globally to ~/.cargo/bin? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cargo install --path crates/peer-token-cli --force
    echo "✅ Installed globally"
    echo "   Run: peer-token <command>"
    echo ""
    echo "Available anywhere on your system!"
else
    # Option 2: Add to PATH (session only)
    echo ""
    echo "📝 To use in this session, run:"
    echo "   export PATH=\"$(pwd)/target/release:\$PATH\""
    echo ""
    echo "📝 To make permanent, add to ~/.bashrc or ~/.zshrc:"
    echo "   export PATH=\"$(pwd)/target/release:\$PATH\""
fi

echo ""
echo "🎉 Installation complete!"
echo ""
echo "Usage:"
echo "  peer-token create    # Create token"
echo "  peer-token status    # Check status"
echo "  peer-token lock      # Lock mint"
echo "  peer-token help      # Show help"
