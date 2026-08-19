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
    def lookup_case(self, case_number: str) -> CaseCharges:
        """Fetch charges for one case number. Caller must unlock() first."""
        result = CaseCharges(case_number=case_number)
        if not self._unlocked and not self.unlock():
            result.error = "captcha gate not unlocked"
            return result
        try:
            r = self.session.get(LOOKUP_URL, timeout=30)
            soup = BeautifulSoup(r.text, "html.parser")
            data = _viewstate_fields(soup)
            # Case-number search fields (ASP.NET naming; resolved dynamically
            # so minor page edits don't break us).
            filled = False
            for inp in soup.find_all("input"):
                nm = inp.get("name") or ""
                if re.search(r"(case.*number|txtcase)", nm, re.I) and inp.get("type", "text") == "text":
                    data[nm] = case_number
                    filled = True
            if not filled:
                result.error = "case-number input not found"
                return result
            btn = soup.find("input", {"type": "submit", "value": re.compile(r"search|submit|find", re.I)})
            if btn and btn.get("name"):
                data[btn["name"]] = btn.get("value", "Search")
            r2 = self.session.post(LOOKUP_URL, data=data, timeout=30)
            self._parse_result(r2.text, result)
        except Exception as e:  # noqa: BLE001 — enrichment must never crash a scrape run
            result.error = f"{type(e).__name__}: {e}"
        return result

    def _parse_result(self, html: str, result: CaseCharges) -> None:
        soup = BeautifulSoup(html, "html.parser")
        text = soup.get_text(" ", strip=True)
        if re.search(r"no (record|case|results?) found", text, re.I):
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
        result.found = bool(uniq) or result.case_number.replace("-", "").lower() in text.replace("-", "").lower()
        blob = text
        result.is_dui = bool(DUI_ARS_RE.search(blob) or DUI_WORD_RE.search(blob))


def is_dui_charges(charges: list) -> bool:
    for c in charges:
        if DUI_ARS_RE.search(c.get("code", "")) or DUI_WORD_RE.search(c.get("description", "")):
            return True
    return False
