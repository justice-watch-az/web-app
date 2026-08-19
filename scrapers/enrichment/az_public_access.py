"""AZ Public Access charge enrichment client (JWAZ-16 / JWAZ-17).

https://apps.azcourts.gov/publicaccess/caselookup.aspx

Flow (verified 2026-08-19):
  1. GET caselookup.aspx — new sessions are gated by a BotDetect captcha:
       hidden input  LBD_VCID_caselookup_ctl00_contentplaceholder1_samplecaptcha
       text input    ctl00$ContentPlaceHolder1$CaptchaCodeTextBox
       submit        ctl00$ContentPlaceHolder1$btnCaptcha
       image         BotDetectCaptcha.ashx?get=image&c=<id>&t=<token>&s=<salt>
  2. POST the captcha answer (+ viewstate) -> session unlocks the lookup form.
  3. POST case-number search -> case detail page containing charges.

One captcha solve unlocks the SESSION, so a batch of lookups costs one solve,
not one per case. Results are additionally cached in the `charge_enrichment`
Supabase table keyed by case_number (cases never change charges retroactively
for our purposes), so across runs each case is solved at most once.

DUI classification: charge text / ARS codes matching 28-1381, 28-1382,
28-1383 (incl. subsections like 28-1381A1) or the literal string "DUI".
"""

import logging
import re
from dataclasses import dataclass, field

import requests
from bs4 import BeautifulSoup

from .solver import BaseSolver, get_solver

logger = logging.getLogger(__name__)

BASE = "https://apps.azcourts.gov/publicaccess/"
LOOKUP_URL = BASE + "caselookup.aspx"
CAPTCHA_IMG_RE = re.compile(r"BotDetectCaptcha\.ashx\?get=image&[^\"']+")

DUI_ARS_RE = re.compile(r"28-?138[123]", re.I)
DUI_WORD_RE = re.compile(r"\bDUI\b|driving under the influence", re.I)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


@dataclass
class CaseCharges:
    case_number: str
    found: bool = False
    is_dui: bool = False
    charges: list = field(default_factory=list)   # [{"code":..., "description":...}]
    court: str | None = None
    error: str | None = None


def _viewstate_fields(soup: BeautifulSoup) -> dict:
    return {
        i.get("name"): i.get("value", "")
        for i in soup.find_all("input")
        if (i.get("name") or "").startswith("__")
    }


class AZPublicAccessClient:
    def __init__(self, solver: BaseSolver | None = None, max_gate_retries: int = 3):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": UA})
        self.solver = solver or get_solver()
        self.max_gate_retries = max_gate_retries
        self._unlocked = False

    # -- captcha gate ------------------------------------------------------
    def _fetch_captcha_image(self, soup: BeautifulSoup) -> bytes:
        img = soup.find("img", src=CAPTCHA_IMG_RE)
        if not img:
            raise RuntimeError("BotDetect image not found on gate page")
        src = img["src"].replace("&amp;", "&")
        r = self.session.get(BASE + src, timeout=30)
        r.raise_for_status()
        return r.content

    def unlock(self) -> bool:
        """Solve the session-level BotDetect gate. Idempotent."""
        if self._unlocked:
            return True
        for attempt in range(1, self.max_gate_retries + 1):
            r = self.session.get(LOOKUP_URL, timeout=30)
            soup = BeautifulSoup(r.text, "html.parser")
            code_box = soup.find("input", id=re.compile("CaptchaCodeTextBox"))
            if not code_box:
                # No gate on this session — already unlocked.
                self._unlocked = True
                return True
            png = self._fetch_captcha_image(soup)
            answer = self.solver.solve_image(png)
            data = _viewstate_fields(soup)
            vcid = soup.find("input", id=re.compile(r"LBD_VCID"))
            if vcid and vcid.get("name"):
                data[vcid["name"]] = vcid.get("value", "")
            data["ctl00$ContentPlaceHolder1$CaptchaCodeTextBox"] = answer
            data["ctl00$ContentPlaceHolder1$btnCaptcha"] = "Submit"
            r2 = self.session.post(LOOKUP_URL, data=data, timeout=30)
            if "CaptchaCodeTextBox" not in r2.text:
                self._unlocked = True
                logger.info("AZ Public Access gate unlocked (attempt %d)", attempt)
                return True
            logger.warning("Captcha gate attempt %d rejected", attempt)
        return False

    # -- case lookup -------------------------------------------------------
    CNUM1 = "ctl00$ContentPlaceHolder1$txtCNum1"
    CNUM2 = "ctl00$ContentPlaceHolder1$txtCNum2"
    COURT_NUM = "ctl00$ContentPlaceHolder1$ddlCourtByNum"
    BTN_NUM = "ctl00$ContentPlaceHolder1$btnGoNum"
    LNAME = "ctl00$ContentPlaceHolder1$txtLName"
    FNAME = "ctl00$ContentPlaceHolder1$txtFName"
    COURT_NAME = "ctl00$ContentPlaceHolder1$ddlCourtByName"
    BTN_NAME = "ctl00$ContentPlaceHolder1$btnGoName"

    def _get_search_form(self):
        """GET the lookup page; if the captcha gate re-locked (per-solve search
        cap), re-unlock. Returns BeautifulSoup of the search form or None."""
        for _ in range(2):
            r = self.session.get(LOOKUP_URL, timeout=30)
            soup = BeautifulSoup(r.text, "html.parser")
            if soup.find("input", {"name": self.CNUM1}) is not None:
                return soup
            self._unlocked = False
            if not self.unlock():
                return None
        return None

    @staticmethod
    def _split_candidates(case_number: str) -> list:
        """AZ Public Access canonical format is DASHED: J-1303-TR-2026000242.
        The two search boxes take the prefix (J-1303-TR) and the sequence
        (2026000242). Verified against live name-search results 2026-08-19."""
        m = re.match(r"^([A-Z])-?(\d{4})-?([A-Z]{2})-?(\d+)$", case_number)
        if not m:
            return [(case_number, "")]
        letter, court, ctype, seq = m.groups()
        return [
            (f"{letter}-{court}-{ctype}", seq),
            (f"{letter}{court}{ctype}", seq),
            (f"{letter}-{court}", f"{ctype}-{seq}"),
            (f"{letter}{court}", f"{ctype}{seq}"),
            (case_number, ""),
        ]

    RESULT_LINK_RE = re.compile(
        r"__doPostBack\('(ctl00\$ContentPlaceHolder1\$gvSearchResults\$ctl\d+\$lbCaseNum)',''\)"
    )

    @staticmethod
    def _canonical(case_number: str) -> str:
        """J1303TR2026000242 -> J-1303-TR-2026000242 (site display format)."""
        m = re.match(r"^([A-Z])-?(\d{4})-?([A-Z]{2})-?(\d+)$", case_number)
        if not m:
            return case_number
        return "-".join(m.groups())

    def _follow_result(self, results_html: str, case_number: str | None = None) -> str | None:
        """Search returns a GridView; case numbers are postback links. Follow
        the row matching case_number (or the first row) to the detail page."""
        soup = BeautifulSoup(results_html, "html.parser")
        target = None
        if case_number:
            want = self._canonical(case_number)
            for a in soup.find_all("a"):
                href = a.get("href", "")
                if "lbCaseNum" in href and a.get_text(strip=True) == want:
                    m = self.RESULT_LINK_RE.search(href)
                    if m:
                        target = m.group(1)
                        break
        if not target:
            m = self.RESULT_LINK_RE.search(results_html)
            if m:
                target = m.group(1)
        if not target:
            return None
        data = _viewstate_fields(soup)
        data["__EVENTTARGET"] = target
        data["__EVENTARGUMENT"] = ""
        r = self.session.post(LOOKUP_URL, data=data, timeout=30)
        return r.text

    def _court_value(self, soup: BeautifulSoup, select_name: str, want: str = "Prescott") -> str:
        sel = soup.find("select", {"name": select_name})
        if not sel:
            return "0"
        for opt in sel.find_all("option"):
            if want.lower() in opt.get_text(strip=True).lower() and "justice" in opt.get_text(strip=True).lower():
                return opt.get("value", "0")
        return "0"

    def lookup_case(self, case_number: str, party_name: str | None = None) -> CaseCharges:
        """Fetch charges for one case. Name search is the reliable path
        (verified live: case-number boxes returned 0 records even with the
        canonical dashed prefix); we then match the canonical case number in
        the results grid and follow its postback to the detail page."""
        result = CaseCharges(case_number=case_number)
        if not self._unlocked and not self.unlock():
            result.error = "captcha gate not unlocked"
            return result
        try:
            if party_name:
                grid = self._search_by_name(party_name)
                if grid:
                    result.found = self._canonical(case_number) in BeautifulSoup(
                        grid, "html.parser").get_text()
                    detail = self._follow_result(grid, case_number)
                    if detail:
                        self.last_html = detail
                        self._parse_result(detail, result)
                        result.found = True
                    elif result.found:
                        self.last_html = grid
                        self._parse_result(grid, result)
                    return result
            for cnum1, cnum2 in self._split_candidates(case_number):
                soup = self._get_search_form()
                if soup is None:
                    result.error = "search form not found (gate re-locked?)"
                    return result
                data = _viewstate_fields(soup)
                for inp in soup.find_all("input", {"type": "hidden"}):
                    nm = inp.get("name")
                    if nm and not nm.startswith("__") and nm not in data:
                        data[nm] = inp.get("value", "")
                data[self.CNUM1] = cnum1
                data[self.CNUM2] = cnum2
                data[self.COURT_NUM] = self._court_value(soup, self.COURT_NUM)
                data[self.BTN_NUM] = "Search"
                r2 = self.session.post(LOOKUP_URL, data=data, timeout=30)
                self.last_html = r2.text
                self._parse_result(r2.text, result)
                if result.found:
                    detail = self._follow_result(r2.text, case_number)
                    if detail:
                        self.last_html = detail
                        self._parse_result(detail, result)
                    return result
                result.error = None
            if not result.found:
                result.error = "no record found"
        except Exception as e:  # noqa: BLE001 — enrichment must never crash a scrape run
            result.error = f"{type(e).__name__}: {e}"
        return result

    def _search_by_name(self, party_name: str) -> str | None:
        """POST the name search; return the results-grid HTML (or None)."""
        parts = (party_name or "").split(",")
        lname = parts[0].strip()
        fname = parts[1].strip().split()[0] if len(parts) > 1 and parts[1].strip() else ""
        if not lname:
            return None
        soup = self._get_search_form()
        if soup is None:
            return None
        data = _viewstate_fields(soup)
        for inp in soup.find_all("input", {"type": "hidden"}):
            nm = inp.get("name")
            if nm and not nm.startswith("__") and nm not in data:
                data[nm] = inp.get("value", "")
        data[self.LNAME] = lname
        data[self.FNAME] = fname
        data[self.COURT_NAME] = self._court_value(soup, self.COURT_NAME)
        data[self.BTN_NAME] = "Search"
        r = self.session.post(LOOKUP_URL, data=data, timeout=30)
        return r.text

    def lookup_by_name(self, last_name: str, first_name: str = "") -> CaseCharges:
        """Name-based lookup (for YCSO roster enrichment — no case number yet)."""
        result = CaseCharges(case_number="")
        if not self._unlocked and not self.unlock():
            result.error = "captcha gate not unlocked"
            return result
        try:
            soup = self._get_search_form()
            if soup is None:
                result.error = "search form not found (gate re-locked?)"
                return result
            data = _viewstate_fields(soup)
            for inp in soup.find_all("input", {"type": "hidden"}):
                nm = inp.get("name")
                if nm and not nm.startswith("__") and nm not in data:
                    data[nm] = inp.get("value", "")
            data[self.LNAME] = last_name
            data[self.FNAME] = first_name
            data[self.COURT_NAME] = self._court_value(soup, self.COURT_NAME)
            data[self.BTN_NAME] = "Search"
            r2 = self.session.post(LOOKUP_URL, data=data, timeout=30)
            self.last_html = r2.text  # debug aid
            self._parse_result(r2.text, result)
        except Exception as e:  # noqa: BLE001
            result.error = f"{type(e).__name__}: {e}"
        return result

    def _parse_result(self, html: str, result: CaseCharges) -> None:
        soup = BeautifulSoup(html, "html.parser")
        text = soup.get_text(" ", strip=True)
        if re.search(r"no (record|case|results?)|0 records found", text, re.I):
            return
        charges = []
        # Charge rows typically show an ARS code and/or a description string.
        for m in re.finditer(r"(A\.?R\.?S\.?\s*)?§?\s*(28-?138[123](?:\s*[A-Z]\d*)?)", text, re.I):
            charges.append({"code": m.group(2), "description": ""})
        for m in re.finditer(r"([A-Z][A-Za-z /-]*DUI[A-Za-z /-]*)", text):
            charges.append({"code": "", "description": m.group(1).strip()})
        # dedupe
        seen = set()
        uniq = []
        for c in charges:
            k = (c["code"], c["description"])
            if k not in seen:
                seen.add(k)
                uniq.append(c)
        result.charges = uniq
        cn = result.case_number.replace("-", "").lower()
        result.found = bool(uniq) or (bool(cn) and cn in text.replace("-", "").lower())
        blob = text
        result.is_dui = bool(DUI_ARS_RE.search(blob) or DUI_WORD_RE.search(blob))


def is_dui_charges(charges: list) -> bool:
    for c in charges:
        if DUI_ARS_RE.search(c.get("code", "")) or DUI_WORD_RE.search(c.get("description", "")):
            return True
    return False
