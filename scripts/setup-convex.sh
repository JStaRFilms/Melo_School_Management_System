#!/bin/bash

# Convex Setup Script for School Management System
# Run this script from the monorepo root

echo "Convex Setup for School Management System"
echo "=========================================="
echo ""

echo "Checking Convex CLI installation..."
if ! command -v convex &> /dev/null; then
    echo "Convex CLI not found. Installing..."
    pnpm add -g convex
    if [ $? -ne 0 ]; then
        echo "Failed to install Convex CLI. Please install manually:"
        echo "  npm install -g convex"
        exit 1
    fi
    echo "Convex CLI installed successfully"
else
    echo "Convex CLI is already installed"
fi

echo ""
echo "Initializing Convex project..."
echo "This will create a new Convex project or connect to an existing one."
echo ""

pnpm convex:dev --once

if [ $? -ne 0 ]; then
    echo "Failed to initialize Convex project"
    exit 1
fi

echo ""
echo "Convex project initialized successfully"
echo ""

echo "Setting up environment files..."

if [ ! -f "apps/teacher/.env.local" ]; then
    cp "apps/teacher/.env.example" "apps/teacher/.env.local"
    echo "Created apps/teacher/.env.local"
else
    echo "apps/teacher/.env.local already exists"
fi

if [ ! -f "apps/admin/.env.local" ]; then
    cp "apps/admin/.env.example" "apps/admin/.env.local"
    echo "Created apps/admin/.env.local"
else
    echo "apps/admin/.env.local already exists"
fi

echo ""
echo "Next steps:"
echo "1. Copy CONVEX_URL from the repo root .env.local into NEXT_PUBLIC_CONVEX_URL in both app .env.local files"
echo "2. Copy CONVEX_SITE_URL from the repo root .env.local into NEXT_PUBLIC_CONVEX_SITE_URL in both app .env.local files"
echo "3. Set a BETTER_AUTH_SECRET in both app .env.local files"
echo "4. Run 'pnpm dev' to start the development servers"
echo ""
echo "For more information, see packages/convex/README.md"
echo ""
echo "Setup complete."
