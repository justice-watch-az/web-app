#!/bin/bash

# Justice Watch Widget CI/CD Test Script
# Tests widget implementation and deployment

echo "================================================"
echo "Justice Watch Widget CI/CD Test"
echo "================================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test results
print_test() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $2"
        ((TESTS_FAILED++))
    fi
}

# 1. Check if server is running
echo -e "\n${YELLOW}1. Server Health Check${NC}"
curl -s http://localhost:3001/health > /dev/null 2>&1
print_test $? "Server is running on port 3001"

# 2. Check widget routes exist
echo -e "\n${YELLOW}2. Widget Routes Check${NC}"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/widgets/config 2>/dev/null | grep -q "200\|404"
if [ $? -eq 0 ]; then
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/widgets/config 2>/dev/null)
    if [ "$STATUS" = "200" ]; then
        print_test 0 "Widget API routes are accessible (Status: $STATUS)"
    else
        print_test 1 "Widget API routes not found (Status: $STATUS)"
    fi
else
    print_test 1 "Widget API routes timeout or error"
fi

# 3. Check React widget components exist
echo -e "\n${YELLOW}3. React Widget Components${NC}"
[ -f src/components/widgets/WidgetBase.tsx ]
print_test $? "WidgetBase component exists"

[ -f src/components/widgets/ArraignmentsWidget.tsx ]
print_test $? "ArraignmentsWidget component exists"

[ -f src/components/widgets/StatsWidget.tsx ]
print_test $? "StatsWidget component exists"

[ -f src/components/widgets/widget-styles.css ]
print_test $? "Widget styles exist"

# 4. Check server widget routes file
echo -e "\n${YELLOW}4. Server Widget Routes${NC}"
[ -f server/routes/widgets.js ]
print_test $? "Server widget routes file exists"

# 5. Check if widget routes are imported
echo -e "\n${YELLOW}5. Widget Routes Integration${NC}"
grep -q "widgetRoutes" server/index.js
print_test $? "Widget routes imported in server/index.js"

grep -q "/api/widgets" server/index.js
print_test $? "Widget routes mounted in server"

# 6. Test CORS headers
echo -e "\n${YELLOW}6. CORS Configuration${NC}"
CORS_HEADER=$(curl -s -I -H "Origin: http://example.com" http://localhost:3001/health 2>/dev/null | grep -i "access-control-allow-origin")
if [ ! -z "$CORS_HEADER" ]; then
    print_test 0 "CORS headers present: $CORS_HEADER"
else
    print_test 1 "CORS headers not found"
fi

# 7. Check CSP headers for widgets
echo -e "\n${YELLOW}7. CSP Headers Check${NC}"
CSP_HEADER=$(curl -s -I http://localhost:3001/widgets/test 2>/dev/null | grep -i "content-security-policy")
if [ ! -z "$CSP_HEADER" ]; then
    if echo "$CSP_HEADER" | grep -q "frame-ancestors"; then
        print_test 0 "CSP frame-ancestors configured"
    else
        print_test 1 "CSP frame-ancestors not found"
    fi
else
    print_test 1 "CSP headers not present on widget routes"
fi

# 8. Build check
echo -e "\n${YELLOW}8. Build Check${NC}"
if [ -d dist ]; then
    print_test 0 "Production build exists"
    
    # Check if widgets are in build
    if [ -f dist/index.html ]; then
        print_test 0 "Build contains index.html"
    else
        print_test 1 "Build missing index.html"
    fi
else
    print_test 1 "No production build found"
fi

# 9. Test widget embedding HTML
echo -e "\n${YELLOW}9. Widget Test Files${NC}"
[ -f test-widgets.html ]
print_test $? "Full widget test HTML exists"

[ -f test-widget-simple.html ]
print_test $? "Simple widget test HTML exists"

# 10. Database check
echo -e "\n${YELLOW}10. Database Connection${NC}"
curl -s http://localhost:3001/api/cases 2>/dev/null | grep -q "error\|cases"
if [ $? -eq 0 ]; then
    print_test 0 "Database API endpoint responding"
else
    print_test 1 "Database API not responding"
fi

# Summary
echo -e "\n================================================"
echo "Test Summary"
echo "================================================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ All tests passed! Widget system is ready.${NC}"
    exit 0
else
    echo -e "\n${RED}✗ Some tests failed. Please review the issues above.${NC}"
    
    # Provide troubleshooting hints
    echo -e "\n${YELLOW}Troubleshooting Hints:${NC}"
    if ! curl -s http://localhost:3001/api/widgets/config > /dev/null 2>&1; then
        echo "- Widget routes may not be loaded. Try restarting the server:"
        echo "  npm start"
    fi
    
    if [ ! -f server/routes/widgets.js ]; then
        echo "- Widget routes file is missing. The implementation may not be complete."
    fi
    
    exit 1
fi