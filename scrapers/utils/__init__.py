"""
Scraper utility modules
"""
from .retry import (
    retry_on_exception,
    retry_selenium_action,
    with_fallback,
    rate_limit,
    CircuitBreaker,
    handle_stale_element,
    measure_time
)

__all__ = [
    'retry_on_exception',
    'retry_selenium_action',
    'with_fallback',
    'rate_limit',
    'CircuitBreaker',
    'handle_stale_element',
    'measure_time'
]