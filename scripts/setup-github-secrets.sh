#!/bin/bash

# GitHub Secrets Setup Script for Justice Watch v3
# This script helps configure repository secrets needed for CI/CD

set -e

echo "========================================="
echo "Justice Watch v3 - GitHub Secrets Setup"
echo "========================================="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed!"
    echo "Please install it first:"
    echo "  - macOS: brew install gh"
    echo "  - Linux: https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
    echo "  - Windows: winget install --id GitHub.cli"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "📝 Please authenticate with GitHub first:"
    gh auth login
fi

echo "✅ GitHub CLI is ready!"
echo ""

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "📦 Repository: $REPO"
echo ""

# Function to set a secret
set_secret() {
    local name=$1
    local prompt=$2
    local example=$3
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Setting: $name"
    echo "Description: $prompt"
    if [ ! -z "$example" ]; then
        echo "Example: $example"
    fi
    echo ""
    
    read -p "Enter value for $name (or 'skip' to skip): " value
    
    if [ "$value" != "skip" ] && [ ! -z "$value" ]; then
        echo "$value" | gh secret set "$name"
        echo "✅ $name set successfully!"
    else
        echo "⏭️  Skipped $name"
    fi
    echo ""
}

echo "🔐 Let's configure your GitHub Secrets..."
echo ""
echo "You'll need the following information:"
echo "1. Supabase project URL and keys"
echo "2. Netlify auth token and site ID"
echo ""
echo "Press Enter to continue..."
read

# Supabase Secrets
echo "═══════════════════════════════════════"
echo "SUPABASE CONFIGURATION"
echo "═══════════════════════════════════════"
echo ""

set_secret "SUPABASE_URL" \
    "Your Supabase project URL" \
    "https://abcdefghijk.supabase.co"

set_secret "SUPABASE_SERVICE_KEY" \
    "Your Supabase service role key (for backend/scraper)" \
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

set_secret "VITE_SUPABASE_URL" \
    "Same as SUPABASE_URL (for frontend build)" \
    "https://abcdefghijk.supabase.co"

set_secret "VITE_SUPABASE_ANON_KEY" \
    "Your Supabase anon/public key (for frontend)" \
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Netlify Secrets
echo "═══════════════════════════════════════"
echo "NETLIFY CONFIGURATION"
echo "═══════════════════════════════════════"
echo ""

set_secret "NETLIFY_AUTH_TOKEN" \
    "Your Netlify personal access token" \
    "Get from: https://app.netlify.com/user/applications#personal-access-tokens"

set_secret "NETLIFY_SITE_ID" \
    "Your Netlify site ID" \
    "Get from: Netlify Dashboard > Site Settings > General > Site ID"

echo "═══════════════════════════════════════"
echo "✅ SETUP COMPLETE!"
echo "═══════════════════════════════════════"
echo ""
echo "To verify your secrets were set:"
echo "  gh secret list"
echo ""
echo "To update a secret later:"
echo "  gh secret set SECRET_NAME"
echo ""
echo "Next steps:"
echo "1. Run: npm install (if not done)"
echo "2. Run: npx supabase start (for local development)"
echo "3. Run: npm run dev (to start local server)"
echo "4. Push to GitHub to trigger deployments!"
echo ""