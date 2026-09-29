"""Reference list of Russian regions and cities (app/data/geo.json, derived
from hflabs/city, CC BY-SA 4.0). Region and city fields are chosen from this
list in every form, so "Ставропольский край" and "ставропольский кр." never
become two different regions in matching and analytics."""

import json
from functools import lru_cache
from pathlib import Path

from fastapi import HTTPException

_PATH = Path(__file__).resolve().parent / "data" / "geo.json"


@lru_cache
def geo() -> dict:
    return json.loads(_PATH.read_text(encoding="utf-8"))


@lru_cache
def _index() -> tuple[dict[str, str], dict[str, dict[str, str]]]:
    regions = {r["region"].casefold(): r["region"] for r in geo()["regions"]}
    cities = {r["region"]: {c.casefold(): c for c in r["cities"]} for r in geo()["regions"]}
    return regions, cities


def canonical_region(value: str) -> str | None:
    return _index()[0].get((value or "").strip().casefold())


def canonical_city(region: str, value: str) -> str | None:
    return _index()[1].get(region, {}).get((value or "").strip().casefold())


def clean_place(region: str, city: str, previous: tuple[str, str] = ("", "")) -> tuple[str, str]:
    """Validates a (region, city) pair against the reference list and returns
    canonical spellings. Values equal to what is already stored are kept as
    is, so profiles created before the list existed can still be saved."""
    region, city = (region or "").strip(), (city or "").strip()
    if (region, city) == previous:
        return region, city
    out_region = ""
    if region:
        out_region = canonical_region(region) or ""
        if not out_region:
            if region == previous[0]:
                out_region = region
            else:
                raise HTTPException(status_code=422, detail="Choose the region from the list")
    out_city = ""
    if city:
        out_city = canonical_city(out_region, city) if out_region else None
        if not out_city:
            if city == previous[1]:
                out_city = city
            else:
                raise HTTPException(status_code=422, detail="Choose the city from the list for the selected region")
    return out_region, out_city
