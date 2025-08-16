#!/usr/bin/env python3
"""
Parallel Maricopa Court Scraper
Leverages the modular scraper system for parallel execution
"""

import argparse
import json
import logging
import sys
import time
from datetime import datetime
from typing import List, Dict, Any
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add current directory to path for imports
sys.path.insert(0, '.')

from core.manager import ScraperManager
from core.normalizer import DataNormalizer
from core.validator import DataValidator
from strategies.maricopa import MaricopaScraperStrategy
from strategies.base import ScraperConfig
from config import get_config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ParallelMaricopaScraper:
    """Parallel scraper for Maricopa County courts"""
    
    # Define all Maricopa County Justice Courts
    MARICOPA_COURTS = [
        'Agua Fria', 'Arcadia Biltmore', 'Arrowhead', 'Chandler',
        'Country Meadows', 'Deer Valley', 'Desert Ridge', 'Dreamy Draw',
        'East Mesa', 'East Phoenix', 'Encanto', 'Estrella Mountain',
        'Fountain Hills', 'Gila Bend', 'Hassayampa', 'Highland',
        'Kyrene', 'Madison', 'Manistee', 'Maryvale', 'McDowell Mountain',
        'Moon Valley', 'North Mesa', 'North Phoenix', 'North Valley',
        'Red Mountain', 'San Marcos', 'San Tan', 'Scottsdale',
        'South Mountain', 'Surprise', 'University Lakes', 'West McDowell',
        'West Mesa', 'West Phoenix', 'White Tank'
    ]
    
    def __init__(self, max_workers: int = 3):
        self.manager = ScraperManager(max_workers=max_workers)
        self.normalizer = DataNormalizer()
        self.validator = DataValidator()
        self.setup_strategies()
        
    def setup_strategies(self):
        """Register Maricopa strategy for each court"""
        config = get_config()
        
        # Get base Maricopa configuration
        base_config = config.get_scraper_config('maricopa')
        
        # Register a strategy instance for each court
        for court_name in self.MARICOPA_COURTS:
            court_id = court_name.lower().replace(' ', '_')
            
            # Create court-specific config
            court_config = ScraperConfig(
                court_name=f"{court_name} Justice Court",
                base_url=base_config.base_url,
                timeout=base_config.timeout,
                retry_attempts=base_config.retry_attempts,
                use_headless=base_config.use_headless,
                wait_time=base_config.wait_time
            )
            
            # Register the strategy
            self.manager.register_strategy(
                court_id,
                MaricopaScraperStrategy,
                court_config
            )
        
        logger.info(f"Registered {len(self.MARICOPA_COURTS)} court strategies")
    
    def scrape_court(self, court_name: str, search_params: Dict) -> Dict:
        """Scrape a single court"""
        court_id = court_name.lower().replace(' ', '_')
        
        try:
            logger.info(f"Scraping {court_name} Justice Court...")
            
            # Execute scraping
            raw_results = self.manager.scrape_court(court_id, search_params)
            
            # Normalize and validate
            processed_results = []
            for case in raw_results:
                normalized = self.normalizer.normalize_case(case, 'maricopa')
                is_valid, errors = self.validator.validate_case(normalized)
                
                if is_valid:
                    processed_results.append(normalized)
                else:
                    logger.warning(f"Invalid case {case.get('case_number')}: {errors}")
            
            return {
                'court': court_name,
                'cases': processed_results,
                'stats': {
                    'total': len(raw_results),
                    'valid': len(processed_results),
                    'invalid': len(raw_results) - len(processed_results)
                }
            }
            
        except Exception as e:
            logger.error(f"Error scraping {court_name}: {e}")
            return {
                'court': court_name,
                'cases': [],
                'error': str(e),
                'stats': {'total': 0, 'valid': 0, 'invalid': 0}
            }
    
    def scrape_parallel(self, courts: List[str], search_params: Dict) -> Dict:
        """Scrape multiple courts in parallel"""
        logger.info(f"Starting parallel scrape of {len(courts)} courts")
        start_time = time.time()
        
        # Use the manager's parallel scraping capability
        court_ids = [c.lower().replace(' ', '_') for c in courts]
        results = self.manager.scrape_multiple_courts(court_ids, search_params)
        
        # Process and normalize results
        all_results = {
            'timestamp': datetime.now().isoformat(),
            'search_params': search_params,
            'courts': {},
            'summary': {
                'total_courts': len(courts),
                'total_cases': 0,
                'valid_cases': 0,
                'errors': []
            }
        }
        
        for court_id, cases in results.items():
            court_name = court_id.replace('_', ' ').title()
            
            # Normalize and validate
            processed = []
            for case in cases:
                normalized = self.normalizer.normalize_case(case, 'maricopa')
                is_valid, _ = self.validator.validate_case(normalized)
                if is_valid:
                    processed.append(normalized)
                    all_results['summary']['valid_cases'] += 1
            
            all_results['courts'][court_name] = processed
            all_results['summary']['total_cases'] += len(cases)
        
        # Calculate timing
        duration = time.time() - start_time
        all_results['summary']['duration'] = f"{duration:.2f} seconds"
        all_results['summary']['cases_per_second'] = (
            all_results['summary']['total_cases'] / duration 
            if duration > 0 else 0
        )
        
        logger.info(
            f"Parallel scrape complete: {all_results['summary']['total_cases']} cases "
            f"in {duration:.2f}s ({all_results['summary']['cases_per_second']:.2f} cases/sec)"
        )
        
        return all_results
    
    def scrape_arraignments_today(self, courts: List[str] = None) -> Dict:
        """Scrape today's arraignments for specified courts"""
        if courts is None:
            courts = self.MARICOPA_COURTS
        
        today = datetime.now().strftime('%m/%d/%Y')
        search_params = {
            'search_type': 'arraignment',
            'start_date': today,
            'end_date': today
        }
        
        return self.scrape_parallel(courts, search_params)
    
    def get_statistics(self) -> Dict:
        """Get scraping statistics"""
        stats = self.manager.get_statistics()
        stats['validation_report'] = {
            'normalizer_mappings': len(self.normalizer.field_mappings),
            'validator_rules': len(self.validator.validation_rules)
        }
        return stats


def main():
    """Main entry point with CLI"""
    parser = argparse.ArgumentParser(
        description='Parallel Maricopa Court Scraper'
    )
    
    parser.add_argument(
        '--parallel',
        action='store_true',
        help='Enable parallel execution'
    )
    
    parser.add_argument(
        '--courts',
        nargs='+',
        help='Courts to scrape (use "all" for all courts)'
    )
    
    parser.add_argument(
        '--search-type',
        choices=['arraignment', 'date_range', 'case_number'],
        default='arraignment',
        help='Type of search to perform'
    )
    
    parser.add_argument(
        '--date',
        help='Date to search (MM/DD/YYYY format)'
    )
    
    parser.add_argument(
        '--case-number',
        help='Specific case number to search'
    )
    
    parser.add_argument(
        '--output',
        default='parallel_results.json',
        help='Output file for results'
    )
    
    parser.add_argument(
        '--max-workers',
        type=int,
        default=3,
        help='Maximum parallel workers'
    )
    
    parser.add_argument(
        '--test',
        action='store_true',
        help='Run in test mode with limited courts'
    )
    
    args = parser.parse_args()
    
    # Initialize scraper
    scraper = ParallelMaricopaScraper(max_workers=args.max_workers)
    
    # Determine which courts to scrape
    if args.test:
        courts = ['Agua Fria', 'Arcadia Biltmore', 'Arrowhead']
        logger.info("TEST MODE: Scraping 3 courts only")
    elif args.courts:
        if 'all' in args.courts:
            courts = ParallelMaricopaScraper.MARICOPA_COURTS
        else:
            courts = args.courts
    else:
        courts = ['Agua Fria']  # Default to single court
    
    # Set up search parameters
    search_params = {
        'search_type': args.search_type
    }
    
    if args.search_type == 'arraignment':
        date = args.date or datetime.now().strftime('%m/%d/%Y')
        search_params.update({
            'start_date': date,
            'end_date': date
        })
    elif args.search_type == 'case_number':
        if not args.case_number:
            logger.error("Case number required for case search")
            sys.exit(1)
        search_params['case_number'] = args.case_number
    elif args.search_type == 'date_range':
        date = args.date or datetime.now().strftime('%m/%d/%Y')
        search_params.update({
            'start_date': date,
            'end_date': date
        })
    
    # Execute scraping
    try:
        logger.info("="*60)
        logger.info("MARICOPA PARALLEL SCRAPER")
        logger.info("="*60)
        logger.info(f"Mode: {'Parallel' if args.parallel else 'Sequential'}")
        logger.info(f"Courts: {len(courts)}")
        logger.info(f"Search Type: {args.search_type}")
        logger.info(f"Max Workers: {args.max_workers}")
        logger.info("="*60)
        
        if args.parallel:
            results = scraper.scrape_parallel(courts, search_params)
        else:
            # Sequential execution for comparison
            results = {
                'timestamp': datetime.now().isoformat(),
                'search_params': search_params,
                'courts': {},
                'summary': {'total_cases': 0, 'valid_cases': 0}
            }
            
            start_time = time.time()
            for court in courts:
                court_result = scraper.scrape_court(court, search_params)
                results['courts'][court] = court_result['cases']
                results['summary']['total_cases'] += court_result['stats']['total']
                results['summary']['valid_cases'] += court_result['stats']['valid']
            
            duration = time.time() - start_time
            results['summary']['duration'] = f"{duration:.2f} seconds"
        
        # Print summary
        print("\n" + "="*60)
        print("SCRAPING COMPLETE")
        print("="*60)
        print(f"Total Courts Processed: {len(results['courts'])}")
        print(f"Total Cases Found: {results['summary']['total_cases']}")
        print(f"Valid Cases: {results['summary']['valid_cases']}")
        print(f"Duration: {results['summary'].get('duration', 'N/A')}")
        
        if args.parallel and 'cases_per_second' in results['summary']:
            print(f"Performance: {results['summary']['cases_per_second']:.2f} cases/second")
        
        # Show court breakdown
        print("\nCourt Breakdown:")
        print("-" * 40)
        for court, cases in results['courts'].items():
            print(f"  {court}: {len(cases)} cases")
        
        # Save results
        with open(args.output, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        print(f"\nResults saved to: {args.output}")
        
        # Print statistics
        stats = scraper.get_statistics()
        print("\nScraper Statistics:")
        print("-" * 40)
        print(f"  Registered Courts: {stats['registered_courts']}")
        print(f"  Cache Entries: {stats['cache_entries']}")
        print(f"  Total Cached Cases: {stats['total_cached_cases']}")
        
    except KeyboardInterrupt:
        logger.info("\nScraping interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()