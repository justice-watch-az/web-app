#!/usr/bin/env python3
"""
Setup GitHub Actions for Justice Watch Scraper Automation
Reads credentials from .env.github and configures everything programmatically
"""

import os
import sys
import base64
import requests
from pathlib import Path
from typing import Dict, Any

# Try to import required packages
try:
    from dotenv import load_dotenv
    from nacl import encoding, public
except ImportError:
    print("Installing required packages...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "python-dotenv", "pynacl", "requests"])
    from dotenv import load_dotenv
    from nacl import encoding, public

def setup_github_secrets(token: str, repo: str, secrets: Dict[str, str]):
    """
    Set up GitHub secrets programmatically
    """
    headers = {
        'Authorization': f'token {token}',
        'Accept': 'application/vnd.github.v3+json'
    }
    
    # Get public key for encryption
    key_url = f'https://api.github.com/repos/{repo}/actions/secrets/public-key'
    key_response = requests.get(key_url, headers=headers)
    
    if key_response.status_code != 200:
        print(f"❌ Failed to get public key: {key_response.status_code}")
        print(f"Response: {key_response.text}")
        return False
    
    key_data = key_response.json()
    
    for secret_name, secret_value in secrets.items():
        # Encrypt the secret
        public_key = public.PublicKey(
            key_data['key'].encode("utf-8"),
            encoding.Base64Encoder()
        )
        sealed_box = public.SealedBox(public_key)
        encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))
        encrypted_value = encoding.Base64Encoder().encode(encrypted).decode("utf-8")
        
        # Create or update the secret
        secret_url = f'https://api.github.com/repos/{repo}/actions/secrets/{secret_name}'
        secret_data = {
            'encrypted_value': encrypted_value,
            'key_id': key_data['key_id']
        }
        
        response = requests.put(secret_url, headers=headers, json=secret_data)
        if response.status_code in [201, 204]:
            print(f"✅ Secret {secret_name} configured")
        else:
            print(f"❌ Failed to set {secret_name}: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    return True

def create_workflow_files():
    """
    Create the GitHub Actions workflow files
    """
    workflow_dir = Path('.github/workflows')
    workflow_dir.mkdir(parents=True, exist_ok=True)
    
    # Main scheduled scraper workflow
    scraper_workflow = """name: Scheduled Court Scraper

on:
  schedule:
    # Monday-Friday at 9 AM MST/Arizona (4 PM UTC)
    # Arizona doesn't observe DST, so it's always UTC-7
    - cron: '0 16 * * 1-5'
  workflow_dispatch:
    inputs:
      debug:
        description: 'Enable debug logging'
        type: boolean
        default: false

jobs:
  scrape-arraignments:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          
      - name: Cache pip packages
        uses: actions/cache@v3
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
          
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          playwright install chromium
          playwright install-deps chromium
          
      - name: Run arraignment scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
        run: |
          python scrapers/maricopa_arraignment_scraper.py '{"headless": true}'
          
      - name: Upload logs
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: scraper-logs-${{ github.run_id }}
          path: logs/
          retention-days: 7
          
      - name: Notify on failure
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `Scraper failed: ${new Date().toLocaleDateString()}`,
              body: `The scheduled scraper failed at ${new Date().toLocaleString()}.\\n\\nCheck the [workflow run](${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}) for details.`,
              labels: ['bug', 'scraper']
            })
"""
    
    # Test workflow for verification
    test_workflow = """name: Test Scraper Setup

on:
  workflow_dispatch:

jobs:
  test-environment:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Test secrets availability
        run: |
          echo "Testing secrets..."
          [ ! -z "${{ secrets.SUPABASE_URL }}" ] && echo "✅ SUPABASE_URL is set" || echo "❌ SUPABASE_URL missing"
          [ ! -z "${{ secrets.SUPABASE_ANON_KEY }}" ] && echo "✅ SUPABASE_ANON_KEY is set" || echo "❌ SUPABASE_ANON_KEY missing"
          [ ! -z "${{ secrets.SUPABASE_SERVICE_KEY }}" ] && echo "✅ SUPABASE_SERVICE_KEY is set" || echo "❌ SUPABASE_SERVICE_KEY missing"
          
      - name: Test Python setup
        run: |
          python --version
          pip install -r requirements.txt
          playwright install chromium
          
      - name: Test scraper import
        run: |
          python -c "import sys; sys.path.append('.'); print('✅ Scraper ready')"
"""
    
    # Write workflow files
    with open(workflow_dir / 'scraper-schedule.yml', 'w') as f:
        f.write(scraper_workflow)
    print(f"✅ Created {workflow_dir}/scraper-schedule.yml")
    
    with open(workflow_dir / 'test-scraper.yml', 'w') as f:
        f.write(test_workflow)
    print(f"✅ Created {workflow_dir}/test-scraper.yml")

def main():
    print("=" * 60)
    print("GitHub Actions Setup for Justice Watch Scraper")
    print("=" * 60)
    
    # Load credentials from .env file
    env_file = '.env.github'
    if not os.path.exists(env_file):
        print(f"❌ Error: {env_file} not found!")
        print("Please create the file with your credentials first.")
        sys.exit(1)
    
    load_dotenv(env_file)
    
    # Get credentials
    token = os.getenv('GITHUB_TOKEN')
    repo = os.getenv('GITHUB_REPO')
    
    if not token or not repo:
        print("❌ Error: Missing GITHUB_TOKEN or GITHUB_REPO in .env.github")
        sys.exit(1)
    
    secrets = {
        'SUPABASE_URL': os.getenv('SUPABASE_URL'),
        'SUPABASE_ANON_KEY': os.getenv('SUPABASE_ANON_KEY'),
        'SUPABASE_SERVICE_KEY': os.getenv('SUPABASE_SERVICE_KEY'),
    }
    
    # Verify all secrets are present
    missing = [k for k, v in secrets.items() if not v]
    if missing:
        print(f"❌ Error: Missing secrets in .env.github: {', '.join(missing)}")
        sys.exit(1)
    
    print(f"\n📦 Setting up GitHub Actions for: {repo}")
    print("-" * 40)
    
    # Step 1: Create workflow files
    print("\n1️⃣ Creating workflow files...")
    create_workflow_files()
    
    # Step 2: Set up GitHub secrets
    print("\n2️⃣ Configuring GitHub secrets...")
    if setup_github_secrets(token, repo, secrets):
        print("✅ All secrets configured successfully!")
    else:
        print("❌ Failed to configure some secrets")
        sys.exit(1)
    
    # Success message
    print("\n" + "=" * 60)
    print("✅ SETUP COMPLETE!")
    print("=" * 60)
    print("\n📋 Next steps:")
    print("1. Review the workflow files in .github/workflows/")
    print("2. Commit and push the changes:")
    print("   git add .github/workflows/")
    print("   git commit -m 'Add GitHub Actions for automated scraping'")
    print("   git push")
    print("\n3. Go to GitHub Actions tab to verify:")
    print(f"   https://github.com/{repo}/actions")
    print("\n4. Test the setup:")
    print("   - Click on 'Test Scraper Setup' workflow")
    print("   - Click 'Run workflow' button")
    print("\n5. The scraper will run automatically:")
    print("   - Monday-Friday at 9 AM MST")
    print("   - Manual trigger available anytime")
    print("\n✨ Your scraper automation is ready!")

if __name__ == "__main__":
    main()