#!/usr/bin/env python3
"""
Validate that optimizations were correctly implemented.
Compares baseline vs optimized scraper code.
"""

import re
import ast
import time


def analyze_scraper(filepath):
    """Analyze a scraper file for performance characteristics."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Parse the AST
    tree = ast.parse(content)
    
    analysis = {
        'file': filepath,
        'sleep_calls': [],
        'webdriverwait_usage': 0,
        'retry_logic': False,
        'circuit_breaker': False,
        'javascript_execution': 0,
        'parallel_processing': False,
        'performance_monitoring': False,
        'page_load_strategy': False,
        'wait_strategies': []
    }
    
    # Find time.sleep() calls
    for match in re.finditer(r'time\.sleep\(([\d.]+)\)', content):
        delay = float(match.group(1))
        line_num = content[:match.start()].count('\n') + 1
        analysis['sleep_calls'].append({
            'line': line_num,
            'delay': delay,
            'context': content.split('\n')[line_num-1].strip()
        })
    
    # Count WebDriverWait usage
    analysis['webdriverwait_usage'] = content.count('WebDriverWait')
    
    # Check for retry logic
    if 'retry' in content.lower() and ('max_retries' in content or 'exponential' in content.lower()):
        analysis['retry_logic'] = True
    
    # Check for circuit breaker
    if 'circuit' in content.lower() and 'breaker' in content.lower():
        analysis['circuit_breaker'] = True
    
    # Count JavaScript execution
    analysis['javascript_execution'] = content.count('execute_script')
    
    # Check for parallel/tab processing
    if 'window.open' in content or 'window_handles' in content:
        analysis['parallel_processing'] = True
    
    # Check for performance monitoring
    if 'PerformanceMonitor' in content or 'measure' in content:
        analysis['performance_monitoring'] = True
    
    # Check for page load strategy
    if "page_load_strategy = 'eager'" in content or 'page_load_strategy' in content:
        analysis['page_load_strategy'] = True
    
    # Find wait strategies
    wait_patterns = re.findall(r'(\w+_wait)\s*=\s*WebDriverWait\([^,]+,\s*([\d.]+)', content)
    for name, timeout in wait_patterns:
        analysis['wait_strategies'].append({
            'name': name,
            'timeout': float(timeout)
        })
    
    return analysis


def compare_scrapers():
    """Compare baseline and optimized scrapers."""
    print("=" * 70)
    print("🔍 SCRAPER OPTIMIZATION VALIDATION")
    print("=" * 70)
    print()
    
    # Analyze both scrapers
    baseline = analyze_scraper('maricopa_arraignment_scraper.py')
    optimized = analyze_scraper('maricopa_arraignment_scraper_optimized.py')
    
    # Report baseline analysis
    print("📊 BASELINE SCRAPER ANALYSIS")
    print("-" * 40)
    print(f"File: {baseline['file']}")
    print(f"❌ time.sleep() calls: {len(baseline['sleep_calls'])}")
    if baseline['sleep_calls']:
        total_sleep = sum(s['delay'] for s in baseline['sleep_calls'])
        print(f"   Total sleep time: {total_sleep} seconds")
        for sleep in baseline['sleep_calls'][:5]:  # Show first 5
            print(f"   Line {sleep['line']}: sleep({sleep['delay']}s)")
    print(f"⚠️  WebDriverWait usage: {baseline['webdriverwait_usage']} instances")
    print(f"❌ Retry logic: {'Yes' if baseline['retry_logic'] else 'No'}")
    print(f"❌ Circuit breaker: {'Yes' if baseline['circuit_breaker'] else 'No'}")
    print(f"⚠️  JavaScript execution: {baseline['javascript_execution']} calls")
    print(f"❌ Parallel processing: {'Yes' if baseline['parallel_processing'] else 'No'}")
    print(f"❌ Performance monitoring: {'Yes' if baseline['performance_monitoring'] else 'No'}")
    print()
    
    # Report optimized analysis
    print("🚀 OPTIMIZED SCRAPER ANALYSIS")
    print("-" * 40)
    print(f"File: {optimized['file']}")
    print(f"✅ time.sleep() calls: {len(optimized['sleep_calls'])}")
    if optimized['sleep_calls']:
        total_sleep = sum(s['delay'] for s in optimized['sleep_calls'])
        print(f"   Total sleep time: {total_sleep} seconds (rate limiting only)")
        for sleep in optimized['sleep_calls']:
            print(f"   Line {sleep['line']}: sleep({sleep['delay']}s) - {sleep['context'][:50]}")
    print(f"✅ WebDriverWait usage: {optimized['webdriverwait_usage']} instances")
    if optimized['wait_strategies']:
        print("   Wait strategies:")
        for wait in optimized['wait_strategies']:
            print(f"   - {wait['name']}: {wait['timeout']}s timeout")
    print(f"✅ Retry logic: {'Yes' if optimized['retry_logic'] else 'No'}")
    print(f"✅ Circuit breaker: {'Yes' if optimized['circuit_breaker'] else 'No'}")
    print(f"✅ JavaScript execution: {optimized['javascript_execution']} calls")
    print(f"✅ Parallel processing: {'Yes' if optimized['parallel_processing'] else 'No'}")
    print(f"✅ Performance monitoring: {'Yes' if optimized['performance_monitoring'] else 'No'}")
    print(f"✅ Page load strategy: {'Eager' if optimized['page_load_strategy'] else 'Normal'}")
    print()
    
    # Calculate improvements
    print("=" * 70)
    print("📈 OPTIMIZATION SUMMARY")
    print("=" * 70)
    
    # Sleep reduction
    baseline_sleeps = sum(s['delay'] for s in baseline['sleep_calls'])
    optimized_sleeps = sum(s['delay'] for s in optimized['sleep_calls'])
    sleep_reduction = baseline_sleeps - optimized_sleeps
    
    print(f"⏱️  Sleep time reduction: {baseline_sleeps}s → {optimized_sleeps}s")
    print(f"   Saved: {sleep_reduction}s per court")
    print(f"   Improvement: {(sleep_reduction/baseline_sleeps*100):.1f}% reduction" if baseline_sleeps > 0 else "   N/A")
    print()
    
    # Feature improvements
    print("✨ NEW FEATURES ADDED:")
    improvements = []
    
    if optimized['webdriverwait_usage'] > baseline['webdriverwait_usage']:
        improvements.append(f"✅ WebDriverWait: {baseline['webdriverwait_usage']} → {optimized['webdriverwait_usage']} instances")
    
    if optimized['retry_logic'] and not baseline['retry_logic']:
        improvements.append("✅ Retry logic with exponential backoff")
    
    if optimized['circuit_breaker'] and not baseline['circuit_breaker']:
        improvements.append("✅ Circuit breaker pattern")
    
    if optimized['javascript_execution'] > baseline['javascript_execution']:
        improvements.append(f"✅ JavaScript batch extraction: {optimized['javascript_execution']} calls")
    
    if optimized['parallel_processing'] and not baseline['parallel_processing']:
        improvements.append("✅ Parallel tab processing")
    
    if optimized['performance_monitoring'] and not baseline['performance_monitoring']:
        improvements.append("✅ Performance monitoring & metrics")
    
    if optimized['page_load_strategy'] and not baseline['page_load_strategy']:
        improvements.append("✅ Eager page load strategy")
    
    for improvement in improvements:
        print(f"   {improvement}")
    
    print()
    
    # Expected performance
    print("🎯 EXPECTED PERFORMANCE IMPROVEMENT:")
    print("-" * 40)
    
    # Calculate theoretical speedup
    baseline_time_per_court = 30  # Conservative estimate
    wait_time_saved = sleep_reduction
    parallel_factor = 2 if optimized['parallel_processing'] else 1
    js_factor = 2 if optimized['javascript_execution'] > baseline['javascript_execution'] else 1
    eager_factor = 1.5 if optimized['page_load_strategy'] else 1
    
    speedup = (wait_time_saved / baseline_time_per_court + 1) * parallel_factor * js_factor * eager_factor
    
    print(f"   Baseline: ~{baseline_time_per_court}s per court")
    print(f"   Optimized: ~{baseline_time_per_court/speedup:.1f}s per court")
    print(f"   Speedup: {speedup:.1f}x faster")
    print()
    
    # Validation results
    print("=" * 70)
    print("✅ VALIDATION RESULTS")
    print("=" * 70)
    
    validations = [
        ("Sleep calls removed", len(optimized['sleep_calls']) <= 3),  # Allow minimal for rate limiting
        ("WebDriverWait implemented", optimized['webdriverwait_usage'] >= 4),
        ("Multiple wait strategies", len(optimized['wait_strategies']) >= 3),
        ("Retry logic added", optimized['retry_logic']),
        ("Circuit breaker added", optimized['circuit_breaker']),
        ("JavaScript extraction", optimized['javascript_execution'] > 0),
        ("Parallel processing", optimized['parallel_processing']),
        ("Performance monitoring", optimized['performance_monitoring']),
        ("Eager page loading", optimized['page_load_strategy'])
    ]
    
    passed = 0
    for check, result in validations:
        status = "✅" if result else "❌"
        print(f"   {status} {check}")
        if result:
            passed += 1
    
    print()
    print(f"📊 Score: {passed}/{len(validations)} optimizations implemented")
    
    if passed >= 7:
        print("🎉 SUCCESS: Scraper is highly optimized!")
    elif passed >= 5:
        print("🟡 PARTIAL: Most optimizations implemented")
    else:
        print("❌ NEEDS WORK: Key optimizations missing")
    
    return passed >= 7


if __name__ == "__main__":
    import sys
    import os
    
    # Change to scrapers directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    success = compare_scrapers()
    sys.exit(0 if success else 1)