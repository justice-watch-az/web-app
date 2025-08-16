#!/usr/bin/env python3
"""Test script for Justice Watch widgets"""

import requests
import time

def test_widget_endpoints():
    """Test all widget endpoints"""
    
    base_url = "http://localhost:3001"
    
    # Test widget API endpoints
    widget_endpoints = [
        "/api/widgets/config",
        "/api/widgets/data/arraignments",
        "/api/widgets/data/stats"
    ]
    
    print("=" * 50)
    print("Testing Widget API Endpoints")
    print("=" * 50)
    
    for endpoint in widget_endpoints:
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=5)
            status = "✓" if response.status_code == 200 else "✗"
            print(f"{status} {endpoint}: {response.status_code}")
            
            if response.status_code == 200:
                # Show first 100 chars of response
                content = str(response.json())[:100] if response.headers.get('content-type', '').startswith('application/json') else response.text[:100]
                print(f"  Response: {content}...")
        except requests.exceptions.RequestException as e:
            print(f"✗ {endpoint}: Error - {e}")
    
    # Test widget React routes (these should return the main HTML)
    widget_routes = [
        "/widgets/stats",
        "/widgets/arraignments", 
        "/widgets/gallery"
    ]
    
    print("\n" + "=" * 50)
    print("Testing Widget React Routes")
    print("=" * 50)
    
    for route in widget_routes:
        try:
            response = requests.get(f"{base_url}{route}", timeout=5)
            status = "✓" if response.status_code == 200 else "✗"
            print(f"{status} {route}: {response.status_code}")
            
            if response.status_code == 200:
                # Check if it returns HTML
                if 'text/html' in response.headers.get('content-type', ''):
                    print(f"  Returns HTML (length: {len(response.text)} bytes)")
                else:
                    print(f"  Content-Type: {response.headers.get('content-type')}")
        except requests.exceptions.RequestException as e:
            print(f"✗ {route}: Error - {e}")
    
    # Test CORS headers
    print("\n" + "=" * 50)
    print("Testing CORS Headers")
    print("=" * 50)
    
    headers = {'Origin': 'http://example.com'}
    response = requests.get(f"{base_url}/api/widgets/config", headers=headers, timeout=5)
    
    cors_headers = {
        'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
        'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
    }
    
    for header, value in cors_headers.items():
        if value:
            print(f"✓ {header}: {value}")
        else:
            print(f"✗ {header}: Not set")
    
    # Test CSP headers for widget routes
    print("\n" + "=" * 50)
    print("Testing CSP Headers for Widget Routes")
    print("=" * 50)
    
    response = requests.get(f"{base_url}/widgets/stats", timeout=5)
    csp = response.headers.get('Content-Security-Policy')
    
    if csp and 'frame-ancestors' in csp:
        print(f"✓ CSP frame-ancestors: {csp}")
    else:
        print(f"✗ CSP frame-ancestors not found")
        if csp:
            print(f"  CSP header: {csp}")

if __name__ == "__main__":
    test_widget_endpoints()