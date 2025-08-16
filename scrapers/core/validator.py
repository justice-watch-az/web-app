"""
Data Validator - Validates scraped and normalized data
"""
from typing import Dict, List, Optional, Tuple
import re
from datetime import datetime
import logging


class DataValidator:
    """Validates court data for completeness and correctness"""
    
    def __init__(self):
        self.logger = logging.getLogger("scraper.validator")
        self.validation_rules = self._define_validation_rules()
        
    def _define_validation_rules(self) -> Dict:
        """Define validation rules for different data types"""
        return {
            'case_number': {
                'required': True,
                'pattern': r'^[A-Z0-9\-]+$',
                'min_length': 5,
                'max_length': 50
            },
            'court_name': {
                'required': True,
                'min_length': 3,
                'max_length': 100
            },
            'case_status': {
                'required': False,
                'allowed_values': ['Active', 'Closed', 'Warrant', 'Dismissed', 'Pending']
            },
            'parties': {
                'required': True,
                'min_count': 1,
                'max_count': 100
            },
            'charges': {
                'required': False,
                'min_count': 0,
                'max_count': 50
            }
        }
    
    def validate_case(self, case_data: Dict) -> Tuple[bool, List[str]]:
        """
        Validate a single case
        
        Args:
            case_data: Case dictionary to validate
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        # Validate required fields
        errors.extend(self._validate_required_fields(case_data))
        
        # Validate case number format
        if 'case_number' in case_data:
            case_errors = self._validate_case_number(case_data['case_number'])
            errors.extend(case_errors)
        
        # Validate dates
        date_errors = self._validate_dates(case_data)
        errors.extend(date_errors)
        
        # Validate parties
        if 'parties' in case_data:
            party_errors = self._validate_parties(case_data['parties'])
            errors.extend(party_errors)
        
        # Validate charges
        if 'charges' in case_data:
            charge_errors = self._validate_charges(case_data['charges'])
            errors.extend(charge_errors)
        
        # Validate status
        if 'case_status' in case_data:
            status_errors = self._validate_status(case_data['case_status'])
            errors.extend(status_errors)
        
        is_valid = len(errors) == 0
        
        if not is_valid:
            self.logger.warning(f"Validation failed for case {case_data.get('case_number', 'UNKNOWN')}: {errors}")
        
        return is_valid, errors
    
    def validate_batch(self, cases: List[Dict]) -> Dict:
        """
        Validate a batch of cases
        
        Args:
            cases: List of case dictionaries
            
        Returns:
            Dictionary with validation results
        """
        results = {
            'total': len(cases),
            'valid': 0,
            'invalid': 0,
            'errors': {},
            'valid_cases': [],
            'invalid_cases': []
        }
        
        for case in cases:
            case_number = case.get('case_number', 'UNKNOWN')
            is_valid, errors = self.validate_case(case)
            
            if is_valid:
                results['valid'] += 1
                results['valid_cases'].append(case_number)
            else:
                results['invalid'] += 1
                results['invalid_cases'].append(case_number)
                results['errors'][case_number] = errors
        
        self.logger.info(f"Batch validation: {results['valid']}/{results['total']} valid cases")
        
        return results
    
    def _validate_required_fields(self, case_data: Dict) -> List[str]:
        """Validate that all required fields are present"""
        errors = []
        
        for field, rules in self.validation_rules.items():
            if rules.get('required', False):
                if field not in case_data or not case_data[field]:
                    errors.append(f"Missing required field: {field}")
        
        return errors
    
    def _validate_case_number(self, case_number: str) -> List[str]:
        """Validate case number format"""
        errors = []
        rules = self.validation_rules.get('case_number', {})
        
        if not case_number:
            return ["Case number is empty"]
        
        # Check pattern
        if 'pattern' in rules:
            if not re.match(rules['pattern'], case_number):
                errors.append(f"Invalid case number format: {case_number}")
        
        # Check length
        if 'min_length' in rules and len(case_number) < rules['min_length']:
            errors.append(f"Case number too short: {case_number}")
        
        if 'max_length' in rules and len(case_number) > rules['max_length']:
            errors.append(f"Case number too long: {case_number}")
        
        return errors
    
    def _validate_dates(self, case_data: Dict) -> List[str]:
        """Validate date fields"""
        errors = []
        date_fields = ['filing_date', 'next_hearing']
        
        for field in date_fields:
            if field in case_data and case_data[field]:
                if not self._is_valid_date(case_data[field]):
                    errors.append(f"Invalid date format for {field}: {case_data[field]}")
                
                # Check if date is reasonable (not too far in past or future)
                if field == 'filing_date':
                    if not self._is_reasonable_past_date(case_data[field]):
                        errors.append(f"Filing date seems unreasonable: {case_data[field]}")
                
                if field == 'next_hearing':
                    if not self._is_reasonable_future_date(case_data[field]):
                        errors.append(f"Next hearing date seems unreasonable: {case_data[field]}")
        
        return errors
    
    def _validate_parties(self, parties: List[Dict]) -> List[str]:
        """Validate party information"""
        errors = []
        rules = self.validation_rules.get('parties', {})
        
        # Check count
        if 'min_count' in rules and len(parties) < rules['min_count']:
            errors.append(f"Too few parties: {len(parties)}")
        
        if 'max_count' in rules and len(parties) > rules['max_count']:
            errors.append(f"Too many parties: {len(parties)}")
        
        # Validate each party
        for i, party in enumerate(parties):
            if not party.get('party_name'):
                errors.append(f"Party {i+1} missing name")
            
            if not party.get('party_type'):
                errors.append(f"Party {i+1} missing type")
            
            # Check attorney name length if present
            if party.get('attorney') and len(party['attorney']) > 10:
                errors.append(f"Attorney name too long for party {i+1}: {party['attorney']}")
        
        return errors
    
    def _validate_charges(self, charges: List[Dict]) -> List[str]:
        """Validate charge information"""
        errors = []
        rules = self.validation_rules.get('charges', {})
        
        # Check count
        if 'max_count' in rules and len(charges) > rules['max_count']:
            errors.append(f"Too many charges: {len(charges)}")
        
        # Validate each charge
        for i, charge in enumerate(charges):
            if not charge.get('description'):
                errors.append(f"Charge {i+1} missing description")
            
            # Check severity format
            if charge.get('severity'):
                severity = charge['severity']
                if len(severity) > 10:
                    errors.append(f"Severity too long for charge {i+1}: {severity}")
                
                if severity and severity not in ['F', 'M', 'I']:
                    errors.append(f"Invalid severity for charge {i+1}: {severity}")
        
        return errors
    
    def _validate_status(self, status: str) -> List[str]:
        """Validate case status"""
        errors = []
        rules = self.validation_rules.get('case_status', {})
        
        if 'allowed_values' in rules:
            if status not in rules['allowed_values']:
                errors.append(f"Invalid case status: {status}")
        
        return errors
    
    def _is_valid_date(self, date_str: str) -> bool:
        """Check if date string is in valid ISO format"""
        try:
            datetime.fromisoformat(date_str)
            return True
        except:
            return False
    
    def _is_reasonable_past_date(self, date_str: str) -> bool:
        """Check if past date is reasonable (within last 50 years)"""
        try:
            date = datetime.fromisoformat(date_str)
            years_ago = (datetime.now() - date).days / 365
            return 0 <= years_ago <= 50
        except:
            return False
    
    def _is_reasonable_future_date(self, date_str: str) -> bool:
        """Check if future date is reasonable (within next 5 years)"""
        try:
            date = datetime.fromisoformat(date_str)
            years_ahead = (date - datetime.now()).days / 365
            return -1 <= years_ahead <= 5
        except:
            return False
    
    def get_validation_report(self, cases: List[Dict]) -> str:
        """Generate a validation report for cases"""
        results = self.validate_batch(cases)
        
        report = f"""
Validation Report
=================
Total Cases: {results['total']}
Valid Cases: {results['valid']} ({results['valid']/results['total']*100:.1f}%)
Invalid Cases: {results['invalid']} ({results['invalid']/results['total']*100:.1f}%)

"""
        
        if results['errors']:
            report += "Errors by Case:\n"
            report += "-" * 50 + "\n"
            for case_number, errors in list(results['errors'].items())[:10]:  # Show first 10
                report += f"\n{case_number}:\n"
                for error in errors:
                    report += f"  - {error}\n"
            
            if len(results['errors']) > 10:
                report += f"\n... and {len(results['errors']) - 10} more cases with errors\n"
        
        return report