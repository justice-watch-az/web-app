"""
Data Normalizer - Standardizes court data across different formats
"""
from typing import Dict, List, Optional, Any
from datetime import datetime
import re
import logging


class DataNormalizer:
    """Normalizes court data to consistent format"""
    
    def __init__(self):
        self.logger = logging.getLogger("scraper.normalizer")
        self.field_mappings = self._load_field_mappings()
        
    def _load_field_mappings(self) -> Dict[str, Dict[str, str]]:
        """Load field mappings for different courts"""
        return {
            'maricopa': {
                'case_number': 'CaseNumber',
                'case_title': 'CaseTitle',
                'case_type': 'CaseType',
                'case_status': 'Status',
                'filing_date': 'FiledDate',
                'judge': 'JudicialOfficer',
                'location': 'Court',
            },
            'pima': {
                'case_number': 'case_no',
                'case_title': 'title',
                'case_type': 'type',
                'case_status': 'status',
                'filing_date': 'filed',
                'judge': 'judge_name',
                'location': 'court_location',
            },
            'coconino': {
                'case_number': 'docket_number',
                'case_title': 'case_caption',
                'case_type': 'case_category',
                'case_status': 'current_status',
                'filing_date': 'date_filed',
                'judge': 'assigned_judge',
                'location': 'courthouse',
            }
        }
    
    def normalize_case(self, raw_case: Dict, court_name: str) -> Dict:
        """
        Normalize a case to standard format
        
        Args:
            raw_case: Raw case data from court
            court_name: Name of the court
            
        Returns:
            Normalized case dictionary
        """
        mapping = self.field_mappings.get(court_name.lower(), {})
        
        # Map fields using court-specific mapping
        normalized = {}
        for standard_field, court_field in mapping.items():
            if court_field in raw_case:
                normalized[standard_field] = raw_case[court_field]
        
        # Add fields that don't need mapping
        normalized.update({
            'court_name': court_name,
            'parties': self.normalize_parties(raw_case.get('parties', [])),
            'charges': self.normalize_charges(raw_case.get('charges', [])),
            'events': self.normalize_events(raw_case.get('events', [])),
            'documents': self.normalize_documents(raw_case.get('documents', [])),
            'case_url': raw_case.get('case_url', ''),
            'next_hearing': self._parse_date(raw_case.get('next_hearing')),
            'scraped_at': datetime.now().isoformat()
        })
        
        # Apply transformations
        return self._apply_transformations(normalized)
    
    def normalize_parties(self, parties: List[Dict]) -> List[Dict]:
        """Normalize party information"""
        normalized = []
        for party in parties:
            normalized.append({
                'party_name': self._clean_name(party.get('name', party.get('party_name', ''))),
                'party_type': self._standardize_party_type(party.get('type', party.get('party_type', ''))),
                'attorney': self._clean_name(party.get('attorney', party.get('counsel', ''))),
                'relationship': party.get('relationship', ''),
                'sex': party.get('sex', party.get('gender', '')),
            })
        return normalized
    
    def normalize_charges(self, charges: List[Dict]) -> List[Dict]:
        """Normalize charge information"""
        normalized = []
        for charge in charges:
            normalized.append({
                'ars_code': self._extract_statute_code(charge),
                'description': charge.get('description', charge.get('offense', '')),
                'severity': self._standardize_severity(charge.get('severity', charge.get('level', ''))),
                'crime_date': self._parse_date(charge.get('crime_date', charge.get('offense_date'))),
                'disposition': charge.get('disposition', charge.get('outcome', '')),
            })
        return normalized
    
    def normalize_events(self, events: List[Dict]) -> List[Dict]:
        """Normalize event/calendar information"""
        normalized = []
        for event in events:
            normalized.append({
                'event_date': self._parse_date(event.get('date', event.get('event_date'))),
                'event_type': event.get('type', event.get('event_type', '')),
                'event_description': event.get('description', event.get('details', '')),
                'time': event.get('time', ''),
                'result': event.get('result', event.get('outcome', '')),
            })
        return normalized
    
    def normalize_documents(self, documents: List[Dict]) -> List[Dict]:
        """Normalize document information"""
        normalized = []
        for doc in documents:
            normalized.append({
                'document_name': doc.get('name', doc.get('title', '')),
                'document_type': doc.get('type', doc.get('category', '')),
                'filed_date': self._parse_date(doc.get('filed_date', doc.get('date'))),
                'filed_by': doc.get('filed_by', doc.get('filer', '')),
            })
        return normalized
    
    def _apply_transformations(self, data: Dict) -> Dict:
        """Apply data transformations and cleaning"""
        # Clean case number
        if 'case_number' in data:
            data['case_number'] = self._clean_case_number(data['case_number'])
        
        # Standardize case status
        if 'case_status' in data:
            data['case_status'] = self._standardize_status(data['case_status'])
        
        # Clean judge name
        if 'judge' in data:
            data['judge'] = self._clean_name(data['judge'])
        
        # Parse filing date
        if 'filing_date' in data:
            data['filing_date'] = self._parse_date(data['filing_date'])
        
        return data
    
    def _clean_case_number(self, case_number: str) -> str:
        """Clean and standardize case number"""
        if not case_number:
            return ''
        # Remove extra whitespace and standardize format
        cleaned = re.sub(r'\s+', ' ', case_number.strip())
        # Convert to uppercase
        return cleaned.upper()
    
    def _clean_name(self, name: str) -> str:
        """Clean person/entity name"""
        if not name:
            return ''
        # Remove extra whitespace
        cleaned = re.sub(r'\s+', ' ', name.strip())
        # Remove common prefixes/suffixes
        cleaned = re.sub(r'^(Hon\.|Judge|Commissioner)\s+', '', cleaned, flags=re.IGNORECASE)
        return cleaned
    
    def _standardize_party_type(self, party_type: str) -> str:
        """Standardize party type"""
        if not party_type:
            return ''
        
        party_type = party_type.upper()
        
        # Map common variations
        mappings = {
            'DEF': 'Defendant',
            'DEFENDANT': 'Defendant',
            'PLT': 'Plaintiff',
            'PLAINTIFF': 'Plaintiff',
            'STATE': 'State',
            'PROSECUTOR': 'State',
            'VICTIM': 'Victim',
            'WITNESS': 'Witness',
        }
        
        for key, value in mappings.items():
            if key in party_type:
                return value
        
        return party_type.title()
    
    def _standardize_severity(self, severity: str) -> str:
        """Standardize charge severity"""
        if not severity:
            return ''
        
        severity = severity.upper()
        
        # Map to standard categories
        if 'FELONY' in severity or severity.startswith('F'):
            return 'F'  # Felony
        elif 'MISDEMEANOR' in severity or severity.startswith('M'):
            return 'M'  # Misdemeanor
        elif 'INFRACTION' in severity or 'CIVIL' in severity:
            return 'I'  # Infraction
        
        return severity[:10]  # Truncate to fit database constraint
    
    def _standardize_status(self, status: str) -> str:
        """Standardize case status"""
        if not status:
            return ''
        
        status = status.upper()
        
        # Map common variations
        if 'CLOSED' in status or 'DISPOSED' in status:
            return 'Closed'
        elif 'ACTIVE' in status or 'OPEN' in status or 'PENDING' in status:
            return 'Active'
        elif 'WARRANT' in status:
            return 'Warrant'
        elif 'DISMISSED' in status:
            return 'Dismissed'
        
        return status.title()
    
    def _extract_statute_code(self, charge: Dict) -> str:
        """Extract statute/ARS code from charge"""
        # Try different field names
        code = charge.get('statute', charge.get('ars_code', charge.get('code', '')))
        
        if not code:
            # Try to extract from description
            description = charge.get('description', '')
            match = re.search(r'(\d+[-\.]\d+[-\.]\d+)', description)
            if match:
                code = match.group(1)
        
        return code
    
    def _parse_date(self, date_value: Any) -> Optional[str]:
        """Parse various date formats to ISO format"""
        if not date_value:
            return None
        
        if isinstance(date_value, datetime):
            return date_value.date().isoformat()
        
        if not isinstance(date_value, str):
            return None
        
        # Try different date formats
        formats = [
            '%m/%d/%Y',
            '%Y-%m-%d',
            '%m-%d-%Y',
            '%B %d, %Y',
            '%b %d, %Y',
            '%Y/%m/%d',
            '%d-%b-%Y',
        ]
        
        for fmt in formats:
            try:
                parsed = datetime.strptime(date_value.strip(), fmt)
                return parsed.date().isoformat()
            except ValueError:
                continue
        
        # Try dateutil parser as fallback
        try:
            from dateutil import parser
            parsed = parser.parse(date_value)
            return parsed.date().isoformat()
        except:
            self.logger.warning(f"Could not parse date: {date_value}")
            return None