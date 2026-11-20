"""
settings.py — User profile and application preferences endpoints.
Persists settings to data/settings.json with fallback defaults.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.utils import get_logger, project_path, ensure_dir

log = get_logger(__name__)

router = APIRouter()

SETTINGS_FILE = project_path("data", "settings.json")


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserProfile(BaseModel):
    name: str = "Trupti G. C."
    role: str = "Lab Researcher"
    email: str = "researcher@hemavision.ai"
    institution: str = "AI Blood Report Analyzer"


class AppSettings(BaseModel):
    profile: UserProfile = Field(default_factory=UserProfile)
    compact_tables: bool = False
    auto_report: bool = True
    units: str = "si"
    confidence_threshold: float = 0.70
    show_overlay_labels: bool = True
    run_morphology: bool = True
    notifications: Dict[str, bool] = Field(default_factory=lambda: {
        "complete": True,
        "review": True,
        "failed": False,
    })


# ── File I/O Helpers ──────────────────────────────────────────────────────────

def _load_settings_from_disk() -> AppSettings:
    try:
        if SETTINGS_FILE.is_file():
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return AppSettings.model_validate(data)
    except Exception as e:
        log.warning("Could not read settings from %s (%s); using defaults", SETTINGS_FILE, e)
    return AppSettings()


def _save_settings_to_disk(settings: AppSettings) -> bool:
    try:
        ensure_dir(SETTINGS_FILE.parent)
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings.model_dump(), f, indent=2)
        log.info("Settings saved successfully -> %s", SETTINGS_FILE)
        return True
    except Exception as e:
        log.error("Failed to write settings to %s: %s", SETTINGS_FILE, e)
        return False


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/settings", response_model=AppSettings)
async def get_settings() -> AppSettings:
    """Retrieve application settings and user profile."""
    return _load_settings_from_disk()


@router.post("/settings", response_model=AppSettings)
async def update_settings(settings: AppSettings) -> AppSettings:
    """Update and persist application settings and profile."""
    _save_settings_to_disk(settings)
    return settings


@router.get("/profile", response_model=UserProfile)
async def get_profile() -> UserProfile:
    """Retrieve user profile."""
    settings = _load_settings_from_disk()
    return settings.profile


@router.post("/profile", response_model=UserProfile)
@router.put("/profile", response_model=UserProfile)
async def update_profile(profile: UserProfile) -> UserProfile:
    """Update and persist user profile."""
    settings = _load_settings_from_disk()
    settings.profile = profile
    _save_settings_to_disk(settings)
    return settings.profile
