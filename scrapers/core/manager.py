"""
Scraper Manager - Orchestrates scraping operations across different courts
"""
import asyncio
from typing import Dict, List, Optional, Type
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
from datetime import datetime
import json

from strategies.base import BaseScraperStrategy, ScraperConfig


class ScraperManager:
    """Orchestrates scraping operations across different courts"""
    
    def __init__(self, max_workers: int = 3):
        self.strategies: Dict[str, BaseScraperStrategy] = {}
        self.configs: Dict[str, ScraperConfig] = {}
        self.max_workers = max_workers
        self.logger = self._setup_logger()
        self.results_cache = {}
        
    def _setup_logger(self) -> logging.Logger:
        """Set up manager logger"""
        logger = logging.getLogger("scraper.manager")
        logger.setLevel(logging.INFO)
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        return logger
    
    def register_strategy(self, court_name: str, strategy_class: Type[BaseScraperStrategy], config: ScraperConfig):
        """
        Register a scraping strategy for a court
        
        Args:
            court_name: Name of the court
            strategy_class: Strategy class to instantiate
            config: Configuration for the strategy
        """
        try:
            strategy = strategy_class(config)
            self.strategies[court_name] = strategy
            self.configs[court_name] = config
            self.logger.info(f"Registered strategy for {court_name}")
        except Exception as e:
            self.logger.error(f"Failed to register strategy for {court_name}: {e}")
            raise
    
    def get_strategy(self, court_name: str) -> Optional[BaseScraperStrategy]:
        """Get strategy for a specific court"""
        return self.strategies.get(court_name)
    
    def list_courts(self) -> List[str]:
        """List all registered courts"""
        return list(self.strategies.keys())
    
    def scrape_court(self, court_name: str, search_params: Dict) -> List[Dict]:
        """
        Scrape a single court
        
        Args:
            court_name: Name of the court to scrape
            search_params: Search parameters
            
        Returns:
            List of case data
        """
        strategy = self.strategies.get(court_name)
        if not strategy:
            raise ValueError(f"No strategy registered for {court_name}")
        
        self.logger.info(f"Starting scrape for {court_name}")
        start_time = datetime.now()
        
        try:
            results = strategy.execute(search_params)
            
            duration = (datetime.now() - start_time).total_seconds()
            self.logger.info(f"Completed {court_name} scrape in {duration:.2f}s - {len(results)} cases")
            
            # Cache results
            cache_key = f"{court_name}:{json.dumps(search_params, sort_keys=True)}"
            self.results_cache[cache_key] = {
                'data': results,
                'timestamp': datetime.now().isoformat()
            }
            
            return results
            
        except Exception as e:
            self.logger.error(f"Error scraping {court_name}: {e}")
            raise
    
    def scrape_multiple_courts(self, courts: List[str], search_params: Dict) -> Dict[str, List[Dict]]:
        """
        Scrape multiple courts in parallel
        
        Args:
            courts: List of court names to scrape
            search_params: Search parameters for all courts
            
        Returns:
            Dictionary mapping court names to results
        """
        results = {}
        errors = {}
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all tasks
            future_to_court = {
                executor.submit(self.scrape_court, court, search_params): court
                for court in courts
                if court in self.strategies
            }
            
            # Collect results
            for future in as_completed(future_to_court):
                court = future_to_court[future]
                try:
                    court_results = future.result()
                    results[court] = court_results
                except Exception as e:
                    self.logger.error(f"Error scraping {court}: {e}")
                    errors[court] = str(e)
        
        if errors:
            self.logger.warning(f"Scraping completed with errors: {errors}")
        
        return results
    
    async def scrape_court_async(self, court_name: str, search_params: Dict) -> List[Dict]:
        """
        Asynchronously scrape a court
        
        Args:
            court_name: Name of the court
            search_params: Search parameters
            
        Returns:
            List of case data
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self.scrape_court,
            court_name,
            search_params
        )
    
    async def scrape_multiple_courts_async(self, courts: List[str], search_params: Dict) -> Dict[str, List[Dict]]:
        """
        Asynchronously scrape multiple courts
        
        Args:
            courts: List of court names
            search_params: Search parameters
            
        Returns:
            Dictionary mapping court names to results
        """
        tasks = [
            self.scrape_court_async(court, search_params)
            for court in courts
            if court in self.strategies
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        output = {}
        for court, result in zip(courts, results):
            if isinstance(result, Exception):
                self.logger.error(f"Error scraping {court}: {result}")
            else:
                output[court] = result
        
        return output
    
    def get_cached_results(self, court_name: str, search_params: Dict) -> Optional[Dict]:
        """
        Get cached results if available
        
        Args:
            court_name: Name of the court
            search_params: Search parameters
            
        Returns:
            Cached results or None
        """
        cache_key = f"{court_name}:{json.dumps(search_params, sort_keys=True)}"
        return self.results_cache.get(cache_key)
    
    def clear_cache(self, court_name: Optional[str] = None):
        """Clear cached results"""
        if court_name:
            # Clear cache for specific court
            keys_to_remove = [k for k in self.results_cache.keys() if k.startswith(f"{court_name}:")]
            for key in keys_to_remove:
                del self.results_cache[key]
            self.logger.info(f"Cleared cache for {court_name}")
        else:
            # Clear all cache
            self.results_cache.clear()
            self.logger.info("Cleared all cache")
    
    def get_statistics(self) -> Dict:
        """Get scraping statistics"""
        stats = {
            'registered_courts': len(self.strategies),
            'courts': list(self.strategies.keys()),
            'cache_entries': len(self.results_cache),
            'total_cached_cases': sum(
                len(entry['data']) 
                for entry in self.results_cache.values()
            )
        }
        return stats