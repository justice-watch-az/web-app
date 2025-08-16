"""
Retry decorators and error handling utilities
"""
import time
import functools
import logging
from typing import Callable, Any, Optional, Tuple, Type
from selenium.common.exceptions import (
    TimeoutException,
    NoSuchElementException,
    StaleElementReferenceException,
    WebDriverException
)


logger = logging.getLogger("scraper.retry")


def retry_on_exception(
    max_attempts: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    log_errors: bool = True
) -> Callable:
    """
    Decorator to retry a function on specified exceptions
    
    Args:
        max_attempts: Maximum number of retry attempts
        delay: Initial delay between retries in seconds
        backoff: Multiplier for delay after each retry
        exceptions: Tuple of exception types to catch
        log_errors: Whether to log retry attempts
        
    Returns:
        Decorated function
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            current_delay = delay
            last_exception = None
            
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                    
                except exceptions as e:
                    last_exception = e
                    
                    if attempt < max_attempts - 1:
                        if log_errors:
                            logger.warning(
                                f"Attempt {attempt + 1}/{max_attempts} failed for {func.__name__}: {e}. "
                                f"Retrying in {current_delay:.1f}s..."
                            )
                        
                        time.sleep(current_delay)
                        current_delay *= backoff
                    else:
                        if log_errors:
                            logger.error(
                                f"All {max_attempts} attempts failed for {func.__name__}: {e}"
                            )
            
            # Re-raise the last exception if all attempts failed
            if last_exception:
                raise last_exception
        
        return wrapper
    return decorator


def retry_selenium_action(
    max_attempts: int = 3,
    delay: float = 0.5
) -> Callable:
    """
    Specialized retry decorator for Selenium actions
    
    Args:
        max_attempts: Maximum number of retry attempts
        delay: Delay between retries
        
    Returns:
        Decorated function
    """
    selenium_exceptions = (
        TimeoutException,
        NoSuchElementException,
        StaleElementReferenceException,
        WebDriverException
    )
    
    return retry_on_exception(
        max_attempts=max_attempts,
        delay=delay,
        backoff=1.5,
        exceptions=selenium_exceptions,
        log_errors=True
    )


def with_fallback(
    fallback_value: Any = None,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    log_errors: bool = True
) -> Callable:
    """
    Decorator to return a fallback value on exception
    
    Args:
        fallback_value: Value to return on exception
        exceptions: Exceptions to catch
        log_errors: Whether to log errors
        
    Returns:
        Decorated function
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            try:
                return func(*args, **kwargs)
            except exceptions as e:
                if log_errors:
                    logger.warning(f"{func.__name__} failed with {e}, returning fallback value")
                return fallback_value
        
        return wrapper
    return decorator


def rate_limit(
    calls: int = 10,
    period: float = 60.0
) -> Callable:
    """
    Decorator to rate limit function calls
    
    Args:
        calls: Maximum number of calls
        period: Time period in seconds
        
    Returns:
        Decorated function
    """
    min_interval = period / calls
    last_called = [0.0]
    
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            elapsed = time.time() - last_called[0]
            left_to_wait = min_interval - elapsed
            
            if left_to_wait > 0:
                time.sleep(left_to_wait)
            
            ret = func(*args, **kwargs)
            last_called[0] = time.time()
            
            return ret
        
        return wrapper
    return decorator


class CircuitBreaker:
    """
    Circuit breaker pattern for handling repeated failures
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        expected_exception: Type[Exception] = Exception
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'closed'  # closed, open, half-open
        
    def __call__(self, func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            if self.state == 'open':
                if self._should_attempt_reset():
                    self.state = 'half-open'
                else:
                    raise Exception(f"Circuit breaker is open for {func.__name__}")
            
            try:
                result = func(*args, **kwargs)
                self._on_success()
                return result
                
            except self.expected_exception as e:
                self._on_failure()
                raise e
        
        return wrapper
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        return (
            self.last_failure_time and
            time.time() - self.last_failure_time >= self.recovery_timeout
        )
    
    def _on_success(self):
        """Reset circuit breaker on successful call"""
        self.failure_count = 0
        self.state = 'closed'
        self.last_failure_time = None
    
    def _on_failure(self):
        """Handle failure and potentially open circuit"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = 'open'
            logger.error(f"Circuit breaker opened after {self.failure_count} failures")
    
    def reset(self):
        """Manually reset the circuit breaker"""
        self.failure_count = 0
        self.state = 'closed'
        self.last_failure_time = None


def handle_stale_element(func: Callable) -> Callable:
    """
    Decorator to handle stale element references
    
    Automatically retries the function if a stale element is encountered
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        max_retries = 3
        
        for attempt in range(max_retries):
            try:
                return func(*args, **kwargs)
            except StaleElementReferenceException:
                if attempt < max_retries - 1:
                    logger.debug(f"Stale element in {func.__name__}, retrying...")
                    time.sleep(0.5)
                else:
                    raise
    
    return wrapper


def measure_time(func: Callable) -> Callable:
    """
    Decorator to measure and log function execution time
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        start_time = time.time()
        
        try:
            result = func(*args, **kwargs)
            elapsed = time.time() - start_time
            logger.info(f"{func.__name__} completed in {elapsed:.2f}s")
            return result
            
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"{func.__name__} failed after {elapsed:.2f}s: {e}")
            raise
    
    return wrapper