"""
Configuration management for scraper strategies
"""
import os
import json
from typing import Dict, Any
from dataclasses import dataclass, asdict
from pathlib import Path


@dataclass
class CourtConfig:
    """Configuration for a specific court"""
    name: str
    base_url: str
    strategy_class: str
    timeout: int = 30
    retry_attempts: int = 3
    use_headless: bool = True
    wait_time: int = 10
    user_agent: str = None
    selectors: Dict[str, str] = None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return asdict(self)


class ScraperConfiguration:
    """Manages scraper configurations"""
    
    def __init__(self, config_path: str = None):
        self.config_path = config_path or self._get_default_config_path()
        self.courts = {}
        self.load_configuration()
    
    def _get_default_config_path(self) -> str:
        """Get default configuration file path"""
        return os.path.join(
            os.path.dirname(__file__),
            'config',
            'courts.json'
        )
    
    def load_configuration(self):
        """Load configuration from file or use defaults"""
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r') as f:
                config_data = json.load(f)
                for court_name, court_config in config_data.get('courts', {}).items():
                    self.courts[court_name] = CourtConfig(**court_config)
        else:
            # Load default configuration
            self._load_default_configuration()
    
    def _load_default_configuration(self):
        """Load default court configurations"""
        self.courts = {
            'maricopa': CourtConfig(
                name='Maricopa County Superior Court',
                base_url='https://superiorcourt.maricopa.gov',
                strategy_class='MaricopaScraperStrategy',
                timeout=30,
                retry_attempts=3,
                use_headless=True,
                selectors={
                    'search_button': '#SearchSubmit',
                    'case_number_input': '#CaseNumber',
                    'results_table': '.SearchResults',
                    'party_section': '#PartySection',
                    'charge_section': '#ChargeSection',
                    'event_section': '#EventSection',
                    'document_section': '#DocumentSection'
                }
            ),
            'pima': CourtConfig(
                name='Pima County Superior Court',
                base_url='https://www.agave.cosc.pima.gov',
                strategy_class='PimaScraperStrategy',
                timeout=30,
                retry_attempts=3,
                use_headless=True,
                selectors={
                    'search_form': '#searchForm',
                    'case_search': '#caseSearch',
                    'results_container': '.resultsContainer'
                }
            ),
            'coconino': CourtConfig(
                name='Coconino County Superior Court',
                base_url='https://www.coconino.az.gov/386/Superior-Court',
                strategy_class='CoconinoScraperStrategy',
                timeout=30,
                retry_attempts=3,
                use_headless=True
            )
        }
    
    def get_court_config(self, court_name: str) -> CourtConfig:
        """Get configuration for a specific court"""
        return self.courts.get(court_name.lower())
    
    def list_courts(self) -> list:
        """List all configured courts"""
        return list(self.courts.keys())
    
    def add_court(self, court_name: str, config: CourtConfig):
        """Add or update court configuration"""
        self.courts[court_name.lower()] = config
    
    def save_configuration(self, path: str = None):
        """Save current configuration to file"""
        save_path = path or self.config_path
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        
        config_data = {
            'courts': {
                name: court.to_dict()
                for name, court in self.courts.items()
            }
        }
        
        with open(save_path, 'w') as f:
            json.dump(config_data, f, indent=2)
    
    def get_scraper_config(self, court_name: str) -> 'ScraperConfig':
        """Get ScraperConfig object for court"""
        from strategies.base import ScraperConfig
        
        court_config = self.get_court_config(court_name)
        if not court_config:
            raise ValueError(f"No configuration found for court: {court_name}")
        
        return ScraperConfig(
            court_name=court_config.name,
            base_url=court_config.base_url,
            timeout=court_config.timeout,
            retry_attempts=court_config.retry_attempts,
            use_headless=court_config.use_headless,
            wait_time=court_config.wait_time,
            user_agent=court_config.user_agent
        )


# Global configuration instance
config = ScraperConfiguration()


def get_config() -> ScraperConfiguration:
    """Get global configuration instance"""
    return config


def reload_config(config_path: str = None):
    """Reload configuration from file"""
    global config
    config = ScraperConfiguration(config_path)
    return config