#!/bin/bash

echo "Testing GraphQL Cases Query with Charges..."
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { cases(limit: 10) { case_number case_title court_name case_status charges { description ars_code severity } parties { party_name party_type attorney } } }"}' | jq

echo -e "\n\nTesting GraphQL Dashboard Query..."
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { dashboard { recent_cases { case_number case_title court_name } statistics { total_cases total_courts upcoming_hearings } } }"}' | jq

echo -e "\n\nTesting GraphQL Single Case Query..."
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { case(case_number: \"CR-2024-001234\") { case_number case_title charges { description ars_code } parties { party_name attorney } } }"}' | jq