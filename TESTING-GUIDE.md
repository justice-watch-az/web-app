# Justice Watch Testing Guide

## 🎯 Complete Testing Infrastructure

All testing infrastructure has been added to the project. Here's how to use each testing framework:

## 1. Unit Tests (Jest) ✅

### Setup Complete
- Jest configuration: `jest.config.js`
- Test setup: `src/setupTests.ts`
- Example test: `src/components/widgets/__tests__/WidgetBase.test.tsx`

### Run Tests
```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Generate coverage report
```

### Writing Tests
```typescript
// Example: src/components/__tests__/MyComponent.test.tsx
import { render, screen } from '@testing-library/react';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## 2. E2E Tests (Playwright) ✅

### Setup Complete
- Config: `playwright.config.ts`
- Test files: `e2e/widgets.spec.ts`

### Run Tests
```bash
npm run e2e              # Run all E2E tests
npm run e2e:ui           # Run with UI mode
npm run e2e:debug        # Debug mode

# Run specific browsers
npx playwright test --project=chromium
npx playwright test --project=firefox
```

### Install Browsers (if needed)
```bash
npx playwright install
```

### Writing E2E Tests
```typescript
// Example: e2e/feature.spec.ts
import { test, expect } from '@playwright/test';

test('user can navigate', async ({ page }) => {
  await page.goto('/');
  await page.click('button#start');
  await expect(page.locator('.result')).toBeVisible();
});
```

## 3. Python Tests (pytest) ✅

### Setup Complete
- Config: `pytest.ini`
- Test files: `tests/test_scrapers.py`
- Requirements: `requirements-test.txt`

### Install Dependencies
```bash
pip install -r requirements-test.txt
```

### Run Tests
```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=scrapers --cov-report=html

# Run specific markers
pytest -m unit           # Unit tests only
pytest -m "not slow"     # Skip slow tests

# Verbose output
pytest -v

# Run specific file
pytest tests/test_scrapers.py
```

### Writing Python Tests
```python
# Example: tests/test_feature.py
import pytest
from scrapers.module import MyClass

class TestMyClass:
    def test_method(self):
        obj = MyClass()
        result = obj.method()
        assert result == expected_value
    
    @pytest.mark.slow
    def test_slow_operation(self):
        # Long running test
        pass
```

## 4. Performance Benchmarks ✅

### Setup Complete
- Benchmark script: `benchmarks/performance.py`

### Run Benchmarks
```bash
# All benchmarks
npm run benchmark
python benchmarks/performance.py --all

# Specific benchmarks
npm run benchmark:api
npm run benchmark:scraper

# With custom iterations
python benchmarks/performance.py --api --iterations 100

# Save results
python benchmarks/performance.py --all --output results.json
```

### Benchmark Categories
1. **Scraper Performance**: Initialization and scraping times
2. **Database Performance**: Insert, query, update operations
3. **API Performance**: Response times and success rates

## 5. Linting & Type Checking ✅

### JavaScript/TypeScript
```bash
npm run lint             # ESLint
npm run type-check       # TypeScript compiler
```

### Python
```bash
# Install tools
pip install black flake8 mypy pylint

# Run linters
black scrapers/          # Format code
flake8 scrapers/        # Style checker
mypy scrapers/          # Type checker
pylint scrapers/        # Code analysis
```

## 6. Continuous Integration

### GitHub Actions Workflow (example)
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linting
        run: npm run lint
      
      - name: Run type check
        run: npm run type-check
      
      - name: Run unit tests
        run: npm run test:coverage
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install Python deps
        run: pip install -r requirements-test.txt
      
      - name: Run Python tests
        run: pytest --cov
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        run: npm run e2e
```

## 7. Test Coverage Goals

### Target Coverage
- **Unit Tests**: 70% minimum
- **E2E Tests**: Critical user paths
- **API Tests**: All endpoints
- **Python**: 70% minimum

### View Coverage Reports
```bash
# JavaScript coverage
npm run test:coverage
open coverage/lcov-report/index.html

# Python coverage
pytest --cov --cov-report=html
open htmlcov/index.html
```

## 8. Testing Best Practices

### Unit Tests
- Test one thing at a time
- Use descriptive test names
- Mock external dependencies
- Keep tests fast

### E2E Tests
- Test user journeys, not implementation
- Use data-testid attributes
- Keep selectors maintainable
- Run against production build

### Performance Tests
- Establish baselines
- Monitor trends over time
- Test under realistic conditions
- Document hardware specs

## Quick Start Commands

```bash
# Install all test dependencies
npm install --save-dev jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom @playwright/test
pip install -r requirements-test.txt

# Run all validation
npm run lint && npm run type-check && npm run test && npm run e2e

# Full benchmark
npm run benchmark

# Generate all coverage reports
npm run test:coverage && pytest --cov --cov-report=html
```

## Troubleshooting

### Jest Issues
- Clear cache: `npx jest --clearCache`
- Check tsconfig: Ensure `jsx: "react-jsx"`

### Playwright Issues
- Install browsers: `npx playwright install`
- Check server is running on port 3001

### Python Issues
- Virtual environment: `python -m venv venv && source venv/bin/activate`
- Install deps: `pip install -r requirements.txt -r requirements-test.txt`

## Summary

✅ **Jest** - Unit testing for React components
✅ **Playwright** - E2E testing for user flows
✅ **pytest** - Python scraper testing
✅ **Benchmarks** - Performance monitoring
✅ **Linting** - Code quality checks

All testing infrastructure is now in place and ready to use!