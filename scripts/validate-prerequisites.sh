#!/bin/bash

# Validation Script for Justice Watch v3 Migration Prerequisites
# This script checks that all required tools and configurations are in place

set -e

echo "================================================"
echo "Justice Watch v3 - Prerequisites Validation"
echo "================================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Check function
check() {
    local name=$1
    local command=$2
    local required=$3
    
    echo -n "Checking $name... "
    
    if eval "$command" &> /dev/null; then
        echo -e "${GREEN}✅ PASSED${NC}"
        ((PASSED++))
        return 0
    else
        if [ "$required" = "true" ]; then
            echo -e "${RED}❌ FAILED${NC}"
            ((FAILED++))
        else
            echo -e "${YELLOW}⚠️  WARNING${NC}"
            ((WARNINGS++))
        fi
        return 1
    fi
}

echo "═══════════════════════════════════════"
echo "1. TOOL INSTALLATION CHECKS"
echo "═══════════════════════════════════════"

check "Node.js" "node --version" "true"
check "npm" "npm --version" "true"
check "Python 3" "python3 --version" "true"
check "pip" "pip3 --version" "true"
check "Git" "git --version" "true"
check "GitHub CLI" "gh --version" "false"
check "Netlify CLI" "netlify --version" "false"
check "Supabase CLI" "supabase --version" "false"

echo ""
echo "═══════════════════════════════════════"
echo "2. ENVIRONMENT FILES"
echo "═══════════════════════════════════════"

check ".env.local exists" "[ -f .env.local ]" "true"
check ".env.production.example exists" "[ -f .env.production.example ]" "false"
check "netlify.toml exists" "[ -f netlify.toml ]" "true"

echo ""
echo "═══════════════════════════════════════"
echo "3. GITHUB CONFIGURATION"
echo "═══════════════════════════════════════"

check "Git repository" "git rev-parse --git-dir" "true"
check "Feature branch exists" "git branch --list feature/v3-serverless-migration" "true"
check "GitHub Actions workflows" "[ -d .github/workflows ]" "true"

echo ""
echo "═══════════════════════════════════════"
echo "4. LOCAL SUPABASE"
echo "═══════════════════════════════════════"

# Check if Supabase is running locally
if command -v supabase &> /dev/null; then
    if supabase status 2>/dev/null | grep -q "RUNNING"; then
        echo -e "Local Supabase... ${GREEN}✅ RUNNING${NC}"
        ((PASSED++))
    else
        echo -e "Local Supabase... ${YELLOW}⚠️  NOT RUNNING${NC}"
        echo "  Run: npx supabase start"
        ((WARNINGS++))
    fi
else
    echo -e "Local Supabase... ${YELLOW}⚠️  CLI NOT INSTALLED${NC}"
    ((WARNINGS++))
fi

echo ""
echo "═══════════════════════════════════════"
echo "5. PYTHON DEPENDENCIES"
echo "═══════════════════════════════════════"

check "Selenium" "python3 -c 'import selenium'" "false"
check "Supabase Python" "python3 -c 'import supabase'" "false"
check "python-dotenv" "python3 -c 'import dotenv'" "false"

echo ""
echo "═══════════════════════════════════════"
echo "6. NPM DEPENDENCIES"
echo "═══════════════════════════════════════"

check "node_modules exists" "[ -d node_modules ]" "true"
check "@supabase/supabase-js installed" "[ -d node_modules/@supabase/supabase-js ]" "false"

echo ""
echo "═══════════════════════════════════════"
echo "VALIDATION SUMMARY"
echo "═══════════════════════════════════════"
echo ""
echo -e "✅ Passed:   ${GREEN}$PASSED${NC}"
echo -e "❌ Failed:   ${RED}$FAILED${NC}"
echo -e "⚠️  Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All required prerequisites are in place!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run: ./scripts/setup-github-secrets.sh (to configure GitHub secrets)"
    echo "2. Create Supabase project at https://supabase.com"
    echo "3. Create Netlify site with: netlify init"
    echo "4. Update .env.production with actual values"
    exit 0
else
    echo -e "${RED}❌ Some required prerequisites are missing!${NC}"
    echo ""
    echo "Please install missing requirements before proceeding."
    exit 1
fi