# Modular Court Scraper System

## Overview

The modular scraper system implements a **Strategy Pattern** architecture that separates court-specific scraping logic from core functionality. This design enables:

- **Easy addition of new courts** without modifying core code
- **Independent testing** of each court scraper
- **Parallel scraping** of multiple courts
- **Consistent data normalization** across all courts
- **Robust error handling** with retry mechanisms

## Architecture

```
scrapers/
├── strategies/           # Court-specific implementations
│   ├── base.py          # Abstract base strategy
│   └── maricopa.py      # Maricopa County implementation
├── core/                # Core functionality
│   ├── manager.py       # Orchestration and parallelization
│   ├── normalizer.py    # Data standardization
│   └── validator.py     # Data validation
├── utils/               # Utility modules
│   └── retry.py         # Retry decorators and error handling
├── config.py            # Configuration management
└── run_modular_scraper.py  # CLI integration script
```

## Quick Start

### Test Mode

Run with mock data to verify the system:

```bash
cd scrapers
python run_modular_scraper.py --test
```

### Production Mode

Scrape real court data:

```bash
# Arraignment scraping (default)
python run_modular_scraper.py --mode arraignment --date "01/15/2024"

# Specific case lookup
python run_modular_scraper.py --mode case --case-number "CR-2024-001234" --court maricopa

# Date range scraping
python run_modular_scraper.py --mode date_range --date "01/15/2024"
```

## Key Components

### 1. Base Strategy (`strategies/base.py`)

Abstract base class defining the interface all court scrapers must implement:

```python
class BaseScraperStrategy(ABC):
    @abstractmethod
    def search_cases(self, search_params: Dict) -> List[Dict]
    
    @abstractmethod
    def scrape_case_details(self, case_id: str) -> Dict
    
    @abstractmethod
    def parse_parties(self, element) -> List[Dict]
    
    @abstractmethod
    def parse_charges(self, element) -> List[Dict]
```

### 2. Scraper Manager (`core/manager.py`)

Orchestrates scraping across multiple courts:

```python
manager = ScraperManager(max_workers=3)
manager.register_strategy('maricopa', MaricopaScraperStrategy, config)

# Scrape single court
results = manager.scrape_court('maricopa', search_params)

# Scrape multiple courts in parallel
results = manager.scrape_multiple_courts(['maricopa', 'pima'], search_params)
```

### 3. Data Normalizer (`core/normalizer.py`)

Standardizes data from different court formats:

```python
normalizer = DataNormalizer()
normalized_case = normalizer.normalize_case(raw_case, 'maricopa')
```

Handles:
- Field mapping (e.g., `CaseNumber` → `case_number`)
- Date parsing (multiple formats → ISO format)
- Party type standardization (`DEF` → `Defendant`)
- Charge severity normalization (`Felony` → `F`)

### 4. Data Validator (`core/validator.py`)

Ensures data quality and completeness:

```python
validator = DataValidator()
is_valid, errors = validator.validate_case(case_data)

# Batch validation
results = validator.validate_batch(cases)
print(f"Valid: {results['valid']}/{results['total']}")
```

### 5. Retry Utilities (`utils/retry.py`)

Robust error handling:

```python
@retry_selenium_action(max_attempts=3)
def click_element(driver, selector):
    element = driver.find_element(By.CSS_SELECTOR, selector)
    element.click()

@with_fallback(fallback_value=[])
def parse_optional_section(element):
    # Returns empty list on failure
    return element.find_elements(By.CLASS_NAME, "item")
```

## Adding a New Court

1. **Create Strategy Class**:

```python
# strategies/pima.py
from .base import BaseScraperStrategy

class PimaScraperStrategy(BaseScraperStrategy):
    def search_cases(self, search_params):
        # Implement Pima-specific search
        pass
    
    def parse_parties(self, element):
        # Pima-specific party parsing
        pass
```

2. **Add Configuration**:

```python
# config.py
'pima': CourtConfig(
    name='Pima County Superior Court',
    base_url='https://www.agave.cosc.pima.gov',
    strategy_class='PimaScraperStrategy',
    selectors={...}
)
```

3. **Register with Manager**:

```python
# run_modular_scraper.py
if 'pima' in config.list_courts():
    manager.register_strategy('pima', PimaScraperStrategy, config)
```

## Testing

### Unit Tests

```bash
python tests/test_strategies.py
```

Tests cover:
- Strategy initialization
- Data normalization
- Data validation
- Manager orchestration
- Error handling

### Integration Testing

```bash
# Test with mock data
python run_modular_scraper.py --test

# Test specific court
python run_modular_scraper.py --mode case --case-number "TEST123" --court maricopa
```

## Performance Features

- **Parallel Processing**: Scrape multiple courts simultaneously
- **Caching**: Results cached to reduce redundant scraping
- **Rate Limiting**: Configurable delays to respect server limits
- **Circuit Breaker**: Automatic failure detection and recovery

## Configuration

Courts are configured in `config.py` or via JSON:

```json
{
  "courts": {
    "maricopa": {
      "name": "Maricopa County Superior Court",
      "base_url": "https://superiorcourt.maricopa.gov",
      "timeout": 30,
      "retry_attempts": 3,
      "use_headless": true,
      "selectors": {
        "search_button": "#SearchSubmit",
        "case_number_input": "#CaseNumber"
      }
    }
  }
}
```

## Output Format

Scraped data is normalized to a consistent format:

```json
{
  "case_number": "CR-2024-001234",
  "court_name": "Maricopa",
  "case_title": "State vs John Doe",
  "case_status": "Active",
  "filing_date": "2024-01-15",
  "judge": "Smith, J.",
  "parties": [
    {
      "party_name": "John Doe",
      "party_type": "Defendant",
      "attorney": "J. Smith"
    }
  ],
  "charges": [
    {
      "ars_code": "13-1234",
      "description": "Sample Charge",
      "severity": "F",
      "disposition": "Pending"
    }
  ],
  "scraped_at": "2024-01-15T10:30:00"
}
```

## Benefits Over Monolithic Approach

| Aspect | Monolithic | Modular Strategy |
|--------|------------|------------------|
| **Adding Courts** | Modify core code | Add new strategy class |
| **Testing** | Test entire system | Test individual strategies |
| **Maintenance** | Changes affect all | Isolated changes |
| **Performance** | Sequential only | Parallel scraping |
| **Code Reuse** | Limited | Shared base functionality |
| **Error Isolation** | System-wide failures | Court-specific handling |

## Migration from Legacy

The modular system can run alongside the legacy scraper:

```python
if settings.USE_MODULAR_SCRAPER:
    # Use modular system
    manager = ScraperManager()
    results = manager.scrape_court("maricopa", params)
else:
    # Use legacy scraper
    scraper = ArraignmentScraper()
    results = scraper.run()
```

## Future Enhancements

- [ ] Add Pima County strategy
- [ ] Add Coconino County strategy
- [ ] Implement A/B testing for strategies
- [ ] Add Prometheus metrics
- [ ] Create Docker container
- [ ] Add GraphQL API integration
- [ ] Implement webhooks for completion notifications

## Troubleshooting

### Common Issues

1. **Selenium WebDriver errors**:
   - Ensure Chrome/ChromeDriver installed
   - Check `use_headless` setting

2. **Import errors**:
   - Run from `scrapers/` directory
   - Ensure `__init__.py` files exist

3. **Validation failures**:
   - Check field mappings in normalizer
   - Verify database column constraints

4. **Rate limiting**:
   - Adjust delays in configuration
   - Use circuit breaker pattern

## License

Part of the Justice Watch application. See main LICENSE file.