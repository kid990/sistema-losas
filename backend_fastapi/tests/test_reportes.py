from datetime import datetime

from app.modules.reportes.service import period_bounds


def test_monthly_period_bounds_include_leap_day() -> None:
    start, end = period_bounds("mensual", 2028, 2)
    assert start == datetime(2028, 2, 1)
    assert end.date().isoformat() == "2028-02-29"


def test_annual_period_bounds_cover_full_year() -> None:
    start, end = period_bounds("anual", 2026, 9)
    assert start.date().isoformat() == "2026-01-01"
    assert end.date().isoformat() == "2026-12-31"
