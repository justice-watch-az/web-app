"""Shared types for statewide source adapters."""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Protocol


@dataclass
class CaseLead:
    """Normalized case row prior to Supabase write."""

    case_number: str
    county: str
    source: str
    court_name: str
    case_title: Optional[str] = None
    case_type: Optional[str] = None
    status: Optional[str] = None
    next_hearing: Optional[str] = None  # ISO datetime if known
    location: Optional[str] = None
    case_url: Optional[str] = None
    party_name: Optional[str] = None
    charges_raw: Optional[str] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def to_case_row(self) -> Dict[str, Any]:
        """Map to public.cases insert/upsert payload (parties/charges optional)."""
        title = self.case_title
        if not title and self.party_name:
            title = f"State vs {self.party_name}"
        return {
            "case_number": self.case_number,
            "county": self.county,
            "source": self.source,
            "court_name": self.court_name,
            "case_title": title,
            "case_type": self.case_type,
            "status": self.status,
            "next_hearing": self.next_hearing,
            "location": self.location or self.court_name,
            "case_url": self.case_url,
            "raw_data": self.raw_data or asdict(self),
        }


class SourceAdapter(Protocol):
    """One portal family (Maricopa JC, Yavapai PCC calendar, etc.)."""

    source_id: str
    county: str

    def run(self, config: Optional[Dict[str, Any]] = None) -> List[CaseLead]:
        """Fetch + parse; return normalized leads (no DB writes)."""
        ...
