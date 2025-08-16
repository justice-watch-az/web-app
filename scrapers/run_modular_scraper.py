#!/usr/bin/env python3
"""
Integration script to run the modular scraper system
"""
import sys
import os
import json
import argparse
import logging
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from strategies.maricopa import MaricopaScraperStrategy
from core.manager import ScraperManager
from core.normalizer import DataNormalizer
from core.validator import DataValidator
from config import get_config


# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def setup_manager() -> ScraperManager:
    """Set up the scraper manager with configured strategies"""
    manager = ScraperManager(max_workers=3)
    config = get_config()
    
    # Register Maricopa strategy
    if 'maricopa' in config.list_courts():
        maricopa_config = config.get_scraper_config('maricopa')
        manager.register_strategy(
            'maricopa',
            MaricopaScraperStrategy,
            maricopa_config
        )
        logger.info("Registered Maricopa strategy")
    
    # Additional strategies would be registered here
    # if 'pima' in config.list_courts():
    #     pima_config = config.get_scraper_config('pima')
    #     manager.register_strategy('pima', PimaScraperStrategy, pima_config)
    
    return manager


def run_arraignment_scrape(manager: ScraperManager, date: str = None):
    """Run arraignment scraping for all courts"""
    if not date:
        date = datetime.now().strftime('%m/%d/%Y')
    
    search_params = {
        'search_type': 'arraignment',
        'start_date': date,
        'end_date': date
    }
    
    logger.info(f"Starting arraignment scrape for {date}")
    
    # Scrape all registered courts
    courts = manager.list_courts()
    results = manager.scrape_multiple_courts(courts, search_params)
    
    # Process results
    normalizer = DataNormalizer()
    validator = DataValidator()
    
    all_cases = []
    for court, cases in results.items():
        logger.info(f"Processing {len(cases)} cases from {court}")
        
        # Normalize cases
        normalized_cases = []
        for case in cases:
            normalized = normalizer.normalize_case(case, court)
            normalized_cases.append(normalized)
        
        # Validate cases
        validation_results = validator.validate_batch(normalized_cases)
        logger.info(f"{court}: {validation_results['valid']}/{validation_results['total']} valid cases")
        
        # Add valid cases to results
        for case in normalized_cases:
            case_number = case.get('case_number', 'UNKNOWN')
            if case_number in validation_results['valid_cases']:
                all_cases.append(case)
    
    return all_cases


def run_case_detail_scrape(manager: ScraperManager, case_number: str, court: str = 'maricopa'):
    """Scrape details for a specific case"""
    logger.info(f"Scraping case {case_number} from {court}")
    
    search_params = {
        'search_type': 'case_number',
        'case_number': case_number
    }
    
    results = manager.scrape_court(court, search_params)
    
    if results:
        # Normalize and validate
        normalizer = DataNormalizer()
        validator = DataValidator()
        
        normalized = normalizer.normalize_case(results[0], court)
        is_valid, errors = validator.validate_case(normalized)
        
        if is_valid:
            logger.info(f"Successfully scraped and validated case {case_number}")
            return normalized
        else:
            logger.error(f"Validation errors for {case_number}: {errors}")
            return None
    else:
        logger.warning(f"No results found for case {case_number}")
        return None


def save_results(cases: list, output_file: str):
    """Save scraping results to file"""
    with open(output_file, 'w') as f:
        json.dump(cases, f, indent=2, default=str)
    logger.info(f"Saved {len(cases)} cases to {output_file}")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Run modular court scraper')
    parser.add_argument(
        '--mode',
        choices=['arraignment', 'case', 'date_range'],
        default='arraignment',
        help='Scraping mode'
    )
    parser.add_argument(
        '--court',
        default='maricopa',
        help='Court to scrape (for case mode)'
    )
    parser.add_argument(
        '--case-number',
        help='Case number to scrape (for case mode)'
    )
    parser.add_argument(
        '--date',
        help='Date to scrape (MM/DD/YYYY format)'
    )
    parser.add_argument(
        '--output',
        default='scraped_cases.json',
        help='Output file for results'
    )
    parser.add_argument(
        '--test',
        action='store_true',
        help='Run in test mode with mock data'
    )
    
    args = parser.parse_args()
    
    try:
        if args.test:
            # Test mode - use mock data
            logger.info("Running in test mode with mock data")
            
            mock_cases = [
                {
                    'case_number': 'CR-2024-TEST001',
                    'court_name': 'Maricopa',
                    'case_title': 'State vs Test Defendant',
                    'case_status': 'Active',
                    'filing_date': '2024-01-15',
                    'parties': [
                        {
                            'party_name': 'Test Defendant',
                            'party_type': 'Defendant',
                            'attorney': 'J. Smith'
                        },
                        {
                            'party_name': 'State of Arizona',
                            'party_type': 'State'
                        }
                    ],
                    'charges': [
                        {
                            'description': 'Test Charge',
                            'ars_code': '13-1234',
                            'severity': 'F'
                        }
                    ],
                    'scraped_at': datetime.now().isoformat()
                }
            ]
            
            # Validate mock data
            validator = DataValidator()
            validation_results = validator.validate_batch(mock_cases)
            
            print("\n" + "="*50)
            print("MODULAR SCRAPER TEST RESULTS")
            print("="*50)
            print(f"Total cases: {len(mock_cases)}")
            print(f"Valid cases: {validation_results['valid']}")
            print(f"Invalid cases: {validation_results['invalid']}")
            
            if validation_results['errors']:
                print("\nValidation Errors:")
                for case_num, errors in validation_results['errors'].items():
                    print(f"  {case_num}: {', '.join(errors)}")
            
            print("\nSample Case Data:")
            print(json.dumps(mock_cases[0], indent=2, default=str))
            
            save_results(mock_cases, args.output)
            
        else:
            # Production mode - real scraping
            manager = setup_manager()
            
            if args.mode == 'arraignment':
                cases = run_arraignment_scrape(manager, args.date)
                save_results(cases, args.output)
                
            elif args.mode == 'case':
                if not args.case_number:
                    logger.error("Case number required for case mode")
                    sys.exit(1)
                    
                case = run_case_detail_scrape(
                    manager,
                    args.case_number,
                    args.court
                )
                
                if case:
                    save_results([case], args.output)
                    
            elif args.mode == 'date_range':
                # Date range scraping
                search_params = {
                    'search_type': 'date_range',
                    'start_date': args.date or datetime.now().strftime('%m/%d/%Y'),
                    'end_date': args.date or datetime.now().strftime('%m/%d/%Y')
                }
                
                courts = manager.list_courts()
                results = manager.scrape_multiple_courts(courts, search_params)
                
                all_cases = []
                for court, cases in results.items():
                    all_cases.extend(cases)
                
                save_results(all_cases, args.output)
        
        logger.info("Scraping completed successfully")
        
    except Exception as e:
        logger.error(f"Error during scraping: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()