# PRP: Scraper Automation with GitHub Actions

## Goal
Implement fully automated court case scraping using GitHub Actions with scheduled workflows, eliminating the need for manual intervention or a running server.

## Context
The Justice Watch application needs to scrape Maricopa County court cases regularly without requiring a dedicated server. GitHub Actions provides free compute time for public repositories (2000 minutes/month) and can run scheduled workflows.

## Requirements

### Functional Requirements
1. **Scheduled Scraping**
   - Monday-Friday at 9 AM MST/Arizona Time (UTC-7)
   - No weekend runs
   - On-demand manual trigger capability

2. **Data Pipeline**
   - Scraper runs in GitHub Actions
   - Results pushed directly to Supabase
   - Error notifications via GitHub Actions

3. **Monitoring**
   - Scrape success/failure tracking
   - Email notifications on failures
   - Execution logs in GitHub

### Technical Requirements
- GitHub Actions workflows
- Secrets management for credentials
- Docker container for scraper
- Supabase connection from Actions

## Implementation Options

### Option A: Programmatic Setup (Using .env file)
```bash
# Create a .env file with your credentials:
# /home/ice/PRPs-agentic-eng/justice-watch-app/.env.github

GITHUB_TOKEN=your_github_personal_access_token
GITHUB_REPO=owner/repository-name
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# The setup script will:
- Read credentials from .env file
- Create .github/workflows/scraper-schedule.yml
- Set up GitHub Secrets via API
- Test the workflow
```

### Option B: GUI Setup (Manual)
```markdown
If you prefer to set it up manually through the GUI:
1. I'll generate the workflow files
2. You'll add secrets through GitHub Settings
3. You'll commit and push the workflows
4. We'll test together
```

## Implementation Plan

### Phase 1: Workflow Creation

#### 1.1 Create Schedule Workflow
```yaml
# .github/workflows/scraper-schedule.yml
name: Scheduled Court Scraper

on:
  schedule:
    # Monday-Friday at 9 AM MST/Arizona (4 PM UTC)
    # Arizona doesn't observe DST, so it's always UTC-7
    - cron: '0 16 * * 1-5'
  workflow_dispatch:
    inputs:
      scrape_type:
        description: 'Type of scrape to run'
        required: false
        default: 'arraignments'
        type: choice
        options:
          - arraignments
          - full

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
          python scrapers/maricopa_arraignment_scraper.py \
            --headless \
            --supabase-url $SUPABASE_URL \
            --supabase-key $SUPABASE_SERVICE_KEY
            
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
              title: `Scraper failed: ${new Date().toISOString()}`,
              body: `The scheduled scraper failed. Check the [workflow run](${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId})`,
              labels: ['bug', 'scraper']
            })
```

#### 1.2 Create Manual Trigger Workflow
```yaml
# .github/workflows/scraper-manual.yml
name: Manual Court Scraper

on:
  workflow_dispatch:
    inputs:
      courts:
        description: 'Courts to scrape (comma-separated or "all")'
        required: false
        default: 'all'
      debug:
        description: 'Enable debug logging'
        type: boolean
        default: false

jobs:
  manual-scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run targeted scrape
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
        run: |
          python scrapers/maricopa_arraignment_scraper.py \
            --courts "${{ github.event.inputs.courts }}" \
            --debug ${{ github.event.inputs.debug }}
```

### Phase 2: Secrets Configuration

#### Programmatic Setup Script
```python
#!/usr/bin/env python3
# scripts/setup_github_actions.py

import os
import sys
import requests
from typing import Dict, Any
from dotenv import load_dotenv

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
    key_data = key_response.json()
    
    from nacl import encoding, public
    
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
            print(f"✓ Secret {secret_name} configured")
        else:
            print(f"✗ Failed to set {secret_name}: {response.text}")

if __name__ == "__main__":
    # Load credentials from .env file
    load_dotenv('.env.github')
    
    token = os.getenv('GITHUB_TOKEN')
    repo = os.getenv('GITHUB_REPO')
    
    if not token or not repo:
        print("Error: Missing GITHUB_TOKEN or GITHUB_REPO in .env.github")
        sys.exit(1)
    
    secrets = {
        'SUPABASE_URL': os.getenv('SUPABASE_URL'),
        'SUPABASE_ANON_KEY': os.getenv('SUPABASE_ANON_KEY'),
        'SUPABASE_SERVICE_KEY': os.getenv('SUPABASE_SERVICE_KEY'),
    }
    
    # Verify all secrets are present
    missing = [k for k, v in secrets.items() if not v]
    if missing:
        print(f"Error: Missing secrets in .env.github: {', '.join(missing)}")
        sys.exit(1)
    
    print(f"Setting up GitHub Actions for {repo}...")
    setup_github_secrets(token, repo, secrets)
    
    # Create workflow file
    workflow_dir = '.github/workflows'
    os.makedirs(workflow_dir, exist_ok=True)
    
    with open('scripts/scraper-schedule.yml', 'r') as src:
        with open(f'{workflow_dir}/scraper-schedule.yml', 'w') as dst:
            dst.write(src.read())
    
    print("✓ Workflow file created")
    print("\nNext steps:")
    print("1. Commit and push the workflow file")
    print("2. Check GitHub Actions tab to verify setup")
    print("3. Run test workflow to verify everything works")
```

#### Manual GUI Setup Instructions
```markdown
1. Go to your repository on GitHub
2. Click Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret:
   - Name: SUPABASE_URL
   - Value: [your supabase url]
   - Click "Add secret"
5. Repeat for:
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_KEY
```

### Phase 3: Scraper Modifications

#### Update scraper for GitHub Actions environment
```python
# scrapers/maricopa_arraignment_scraper.py updates

import os
import argparse
from datetime import datetime

def get_config():
    """Get configuration from environment or arguments"""
    parser = argparse.ArgumentParser()
    parser.add_argument('--headless', action='store_true', default=True)
    parser.add_argument('--type', choices=['daily', 'weekly', 'full'], default='daily')
    parser.add_argument('--courts', default='all')
    parser.add_argument('--supabase-url', default=os.getenv('SUPABASE_URL'))
    parser.add_argument('--supabase-key', default=os.getenv('SUPABASE_SERVICE_KEY'))
    parser.add_argument('--debug', action='store_true')
    
    args = parser.parse_args()
    return args

def main():
    config = get_config()
    
    # Set up logging for GitHub Actions
    logging.basicConfig(
        level=logging.DEBUG if config.debug else logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(f'logs/scraper_{datetime.now():%Y%m%d_%H%M%S}.log')
        ]
    )
    
    # Initialize Supabase client
    supabase = create_client(config.supabase_url, config.supabase_key)
    
    # Run appropriate scrape type
    if config.type == 'daily':
        scrape_daily_arraignments(supabase, config.headless)
    elif config.type == 'weekly':
        scrape_all_courts(supabase, config.headless)
    elif config.type == 'full':
        scrape_full_history(supabase, config.headless)
```

### Phase 4: Testing & Monitoring

#### Test Workflow
```yaml
# .github/workflows/test-scraper.yml
name: Test Scraper Setup

on:
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Test environment
        run: |
          echo "Testing secrets availability..."
          [ ! -z "${{ secrets.SUPABASE_URL }}" ] && echo "✓ SUPABASE_URL is set" || echo "✗ SUPABASE_URL missing"
          [ ! -z "${{ secrets.SUPABASE_ANON_KEY }}" ] && echo "✓ SUPABASE_ANON_KEY is set" || echo "✗ SUPABASE_ANON_KEY missing"
          [ ! -z "${{ secrets.SUPABASE_SERVICE_KEY }}" ] && echo "✓ SUPABASE_SERVICE_KEY is set" || echo "✗ SUPABASE_SERVICE_KEY missing"
          
      - name: Test Python setup
        run: |
          python --version
          pip install -r requirements.txt
          playwright install chromium
          
      - name: Test scraper import
        run: |
          python -c "from scrapers.maricopa_arraignment_scraper import main; print('✓ Scraper imports successfully')"
```

## Validation

### Automated Tests
```bash
# After setup, these should work:

# 1. Test manual trigger
gh workflow run scraper-manual.yml

# 2. Check workflow status
gh run list --workflow=scraper-schedule.yml

# 3. View logs
gh run view [run-id] --log

# 4. Check Supabase for new data
curl $SUPABASE_URL/rest/v1/cases?limit=1 \
  -H "apikey: $SUPABASE_ANON_KEY"
```

### Success Criteria
- [ ] Workflows created and visible in Actions tab
- [ ] Secrets configured (test workflow passes)
- [ ] Manual trigger works
- [ ] Schedule triggers at correct times
- [ ] Data appears in Supabase after run
- [ ] Logs are accessible
- [ ] Failure notifications work

## Decision Point

**Please let me know:**

1. **Do you want to proceed programmatically?**
   - If yes, you'll need to provide:
     - GitHub Personal Access Token
     - Repository details
     - Supabase credentials
   - I'll run the setup script and configure everything

2. **Or prefer GUI setup?**
   - I'll generate all the workflow files
   - You'll add secrets through GitHub UI
   - We'll test together

3. **Which GitHub account?**
   - If using a different account, we'll need:
     - Account has access to the repository
     - Token from that account
     - Proper permissions set

## Benefits

- **Zero infrastructure cost** - Uses GitHub's free tier
- **No server maintenance** - GitHub manages everything
- **Built-in monitoring** - GitHub Actions UI shows all runs
- **Easy debugging** - Logs available for each run
- **Version controlled** - Workflows in git
- **Scalable** - Can add more workflows easily

## Next Steps

Once you decide on the setup method:

1. **Programmatic**: Provide credentials → I run setup → Test together
2. **GUI**: I create files → You add secrets → We test

Let me know which approach you prefer and whether you have the GitHub credentials ready!