"""Captcha solver interface for the enrichment layer.

TwoCaptchaSolver uses the 2captcha "normal captcha" (image) API:
  POST http://2captcha.com/in.php   (key, method=base64, body=<b64 png>)
  GET  http://2captcha.com/res.php  (key, action=get, id=<task_id>)
Cost ~$2.99 / 1000 solves. BotDetect on apps.azcourts.gov is a plain
distorted-text image, squarely in this category.

Env:
  TWOCAPTCHA_API_KEY  — required for TwoCaptchaSolver (absent => enrichment off)

MockSolver exists for local dev / CI: never calls the network.
"""

import base64
import logging
import os
import time

import requests

logger = logging.getLogger(__name__)


class SolverUnavailable(RuntimeError):
    """Raised when no usable solver is configured."""


class BaseSolver:
    def solve_image(self, png_bytes: bytes) -> str:
        raise NotImplementedError


class TwoCaptchaSolver(BaseSolver):
    IN_URL = "http://2captcha.com/in.php"
    RES_URL = "http://2captcha.com/res.php"

    def __init__(self, api_key: str | None = None, poll_interval: int = 5, timeout: int = 120,
                 case_sensitive: bool = False):
        self.api_key = api_key or os.environ.get("TWOCAPTCHA_API_KEY")
        if not self.api_key:
            raise SolverUnavailable("TWOCAPTCHA_API_KEY not set")
        self.poll_interval = poll_interval
        self.timeout = timeout
        # regsense=1 tells 2captcha workers the answer is case-sensitive
        # (JailTracker's 4-char code is; BotDetect on AZPA is not).
        self.case_sensitive = case_sensitive

    def solve_image(self, png_bytes: bytes) -> str:
        b64 = base64.b64encode(png_bytes).decode()
        payload = {"key": self.api_key, "method": "base64", "body": b64, "json": 1}
        if self.case_sensitive:
            payload["regsense"] = 1
        r = requests.post(self.IN_URL, data=payload, timeout=30)
        data = r.json()
        if data.get("status") != 1:
            raise RuntimeError(f"2captcha submit failed: {data}")
        task_id = data["request"]
        deadline = time.time() + self.timeout
        while time.time() < deadline:
            time.sleep(self.poll_interval)
            res = requests.get(
                self.RES_URL,
                params={"key": self.api_key, "action": "get", "id": task_id, "json": 1},
                timeout=30,
            ).json()
            if res.get("status") == 1:
                logger.info("2captcha solved task %s", task_id)
                return res["request"]
            if res.get("request") != "CAPCHA_NOT_READY":
                raise RuntimeError(f"2captcha solve failed: {res}")
        raise TimeoutError(f"2captcha task {task_id} not solved in {self.timeout}s")


class MockSolver(BaseSolver):
    """Dev/CI stand-in. Returns a fixed string; enrichment will succeed
    structurally but the captcha answer will be wrong upstream, so the
    caller must tolerate 'wrong captcha' responses in mock mode."""

    def solve_image(self, png_bytes: bytes) -> str:
        logger.warning("MockSolver: returning canned captcha answer (will not pass)")
        return "MOCK1"


def get_solver() -> BaseSolver:
    """Factory: real solver if key present, else MockSolver when explicitly
    allowed (ENRICH_MOCK_SOLVER=1), else raise."""
    if os.environ.get("TWOCAPTCHA_API_KEY"):
        return TwoCaptchaSolver()
    if os.environ.get("ENRICH_MOCK_SOLVER") == "1":
        return MockSolver()
    raise SolverUnavailable(
        "No captcha solver configured. Set TWOCAPTCHA_API_KEY "
        "(or ENRICH_MOCK_SOLVER=1 for structural dev testing)."
    )
