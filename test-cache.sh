#!/bin/bash

echo "Testing GraphQL Cache Performance..."
echo "====================================="

# First query - will hit database and populate cache
echo -e "\n1st Query (Cold Cache):"
time curl -s -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { dashboard { statistics { total_cases total_courts } } }"}' | jq .data.dashboard.statistics

# Second query - should hit cache (within 30 seconds)
echo -e "\n2nd Query (Warm Cache - should be faster):"
time curl -s -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { dashboard { statistics { total_cases total_courts } } }"}' | jq .data.dashboard.statistics

# Different query to test case caching
echo -e "\n\nCase Query Test:"
echo "----------------"
echo -e "\n1st Case Query (Cold):"
time curl -s -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { case(case_number: \"CR-2024-001234\") { case_number case_title } }"}' | jq .data.case

echo -e "\n2nd Case Query (Warm):"
time curl -s -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { case(case_number: \"CR-2024-001234\") { case_number case_title } }"}' | jq .data.case

# Check Redis directly
echo -e "\n\nCache Keys in Redis:"
echo "--------------------"
redis-cli KEYS "justice:*" | head -10