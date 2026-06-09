#!/usr/bin/env python3
"""
Fetch leading indicator data from FRED, Yahoo Finance, and Zillow.
Writes output to public/indicators.json for Vercel to serve statically.
Runs daily via GitHub Actions.

FIXES APPLIED:
- T10Y3M: Removed mul=100 (data already in percentage points)
- HY_SPREAD: Removed mul=100 (data already in percentage points)
- ISM_NEW_ORDERS: Fixed ticker INDPRO → NAPMNOI (ISM diffusion index)
- COPPER_GOLD: Returns % vs 3-month average instead of raw ratio
"""

import json
import math
import os
import time
from datetime import datetime, timezone

import requests
import yfinance as yf
from dotenv import load_dotenv

# Load .env.local for local development (GitHub Actions sets the env var directly)
load_dotenv(".env.local")

FRED_KEY       = os.environ.get("FRED_API_KEY", "").strip('"').strip("'")
FRED_BASE      = "https://api.stlouisfed.org/fred/series/observations"
FRED_META_BASE = "https://api.stlouisfed.org/fred/series"
OUT_PATH       = os.path.join(os.path.dirname(__file__), "public", "indicators.json")


# ── Helpers ────────────────────────────────────────────────────────────

def fred_get(series: str, limit: int = 20) -> dict:
    """Fetch FRED series (descending order), with up to 3 retries on 429.
    Returns observation values plus the series last_updated (publication) date."""
    for attempt in range(3):
        if attempt > 0:
            print(f"    429 on {series} — retrying in 1s...")
            time.sleep(1)
        r = requests.get(FRED_BASE, params={
            "series_id": series, "api_key": FRED_KEY,
            "file_type": "json", "sort_order": "desc", "limit": limit,
        }, timeout=30)
        if r.status_code == 429 and attempt < 2:
            continue
        r.raise_for_status()
        data = r.json()
        if "error_message" in data:
            raise ValueError(data["error_message"])
        obs = [o for o in data["observations"] if o["value"] != "."]
        obs_date = obs[0]["date"] if obs else ""

        # Fetch series metadata to get the actual publication date
        pub_date = obs_date
        try:
            meta_r = requests.get(FRED_META_BASE, params={
                "series_id": series, "api_key": FRED_KEY, "file_type": "json",
            }, timeout=30)
            if meta_r.ok:
                meta = meta_r.json()
                raw = meta.get("seriess", [{}])[0].get("last_updated", "")
                if raw:
                    pub_date = raw[:10]  # "2026-06-01 11:10:07-05" → "2026-06-01"
        except Exception:
            pass  # fall back to observation date

        return {"v": [float(o["value"]) for o in obs], "d": pub_date}
    raise RuntimeError(f"FRED {series}: rate limited after 3 attempts")


def yoy(arr: list, back: int) -> tuple:
    """YoY % change. arr[0] = most recent (descending)."""
    if len(arr) < back + 2:
        raise ValueError(f"need {back + 2} values, got {len(arr)}")
    c = (arr[0] / arr[back] - 1) * 100
    p = (arr[1] / arr[back + 1] - 1) * 100 if arr[1] and arr[back + 1] else c
    return c, p


def lv(current, prior, date: str) -> dict:
    return {"current": current, "prior": prior, "lastUpdated": date}


def safe(key: str, fn) -> dict:
    try:
        out = fn()
        print(f"  [OK] {key}")
        return out
    except Exception as e:
        print(f"  [!!] {key}: {e}")
        return {"current": None, "prior": None, "error": str(e)}


# ── Main ───────────────────────────────────────────────────────────────

def main():
    result = {}

    # ── FRED: sequential with 0.5s pauses to avoid HTTP 429 ───────────
    print("Fetching FRED series...")

    def fs(key, fn):
        result[key] = safe(key, fn)
        time.sleep(0.5)

    def direct(series, limit=5, mul=1, dec=None):
        r = fred_get(series, limit)
        v = r["v"]
        def rnd(x):
            if dec is None: return x
            if dec == 0:    return int(round(x, 0))
            return round(x, dec)
        return lv(rnd(v[0] * mul), rnd((v[1] if len(v) > 1 else v[0]) * mul), r["d"])

    def direct_yoy(series, back, dec=2):
        r = fred_get(series, 500)
        c, p = yoy(r["v"], back)
        return lv(round(c, dec), round(p, dec), r["d"])

    fs("GDPNOW",         lambda: direct("GDPNOW"))
    fs("WEI",            lambda: direct("WEI"))
    fs("T10Y3M",         lambda: direct("T10Y3M",       limit=10, mul=1, dec=2))
    fs("HY_SPREAD",      lambda: direct("BAMLH0A0HYM2", limit=10, mul=1, dec=2))
    fs("ISM_NEW_ORDERS", lambda: direct("NAPMNOI",       limit=10, dec=1))
    fs("ICSA",           lambda: direct("ICSA"))
    fs("PERMIT",         lambda: direct("PERMIT"))
    fs("T5YIFR",         lambda: direct("T5YIFR"))
    fs("MICH_1YR",       lambda: direct("MICH"))
    fs("LEI",            lambda: direct("USSLIND",       dec=2))
    fs("OIL_YOY",        lambda: direct_yoy("DCOILWTICO", 260, dec=1))
    fs("PPI_YOY",        lambda: direct_yoy("PPIACO",     12))
    fs("DOLLAR_YOY",     lambda: direct_yoy("DTWEXBGS",   260))
    fs("ATLANTA_WAGE",   lambda: direct_yoy("AHETPI",     12))

    # ── Yahoo Finance ──────────────────────────────────────────────────
    print("Fetching Yahoo Finance data...")

    def spx_200dma():
        h = yf.Ticker("^GSPC").history(period="2y")
        c = h["Close"].dropna().values
        if len(c) < 201:
            raise ValueError("insufficient data")
        return lv(
            round(((c[-1] / c[-200:].mean()) - 1) * 100, 2),
            round(((c[-2] / c[-201:-1].mean()) - 1) * 100, 2),
            h.index[-1].strftime("%Y-%m-%d"),
        )

    def copper_gold():
        cu = yf.Ticker("HG=F").history(period="2y")["Close"].dropna()
        au = yf.Ticker("GC=F").history(period="2y")["Close"].dropna()

        # Align dates (copper and gold trade on different calendars)
        merged = cu.to_frame(name="copper").join(au.to_frame(name="gold"), how="inner").dropna()
        if len(merged) < 130:
            raise ValueError("insufficient aligned data")

        merged["ratio"] = merged["copper"] / merged["gold"]
        current_ratio = merged["ratio"].iloc[-1]
        avg_3m = merged["ratio"].iloc[-63:].mean()
        pct_vs_3m = ((current_ratio - avg_3m) / avg_3m) * 100

        prior_ratio = merged["ratio"].iloc[-2]
        prior_avg_3m = merged["ratio"].iloc[-64:-1].mean()
        prior_pct_vs_3m = ((prior_ratio - prior_avg_3m) / prior_avg_3m) * 100

        return {
            "current": round(pct_vs_3m, 2),
            "prior": round(prior_pct_vs_3m, 2),
            "lastUpdated": merged.index[-1].strftime("%Y-%m-%d"),
            "raw_ratio": round(float(current_ratio), 6),
            "signal": "BULLISH" if pct_vs_3m > 0 else "BEARISH",
        }

    def bcom_yoy():
        for sym in ["^BCOM", "DJP"]:
            try:
                h = yf.Ticker(sym).history(period="2y")
                c = h["Close"].dropna().values
                if len(c) >= 254:
                    return lv(
                        round((c[-1] / c[-253] - 1) * 100, 2),
                        round((c[-2] / c[-254] - 1) * 100, 2),
                        h.index[-1].strftime("%Y-%m-%d"),
                    )
            except Exception:
                continue
        raise ValueError("insufficient data from ^BCOM and DJP")

    result["SPX_VS_200DMA"] = safe("SPX_VS_200DMA", spx_200dma)
    result["COPPER_GOLD"]   = safe("COPPER_GOLD",   copper_gold)
    result["BCOM_YOY"]      = safe("BCOM_YOY",      bcom_yoy)

    # ── Zillow ZORI (FRED rent CPI fallback) ──────────────────────────
    print("Fetching Zillow ZORI...")

    def zori():
        urls = [
            "https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondomfr_sm_sa_month.csv",
            "https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondomfr_tier_0.33_0.67_sm_sa_month.csv",
            "https://files.zillowstatic.com/research/public_v2/zori/Metro_zori_uc_sfrcondomfr_sm_sa_month.csv",
        ]
        text = None
        for url in urls:
            try:
                resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
                if resp.ok:
                    text = resp.text
                    break
            except Exception:
                continue
        if not text:
            raise ValueError("all Zillow URLs failed")

        lines  = text.strip().split("\n")
        header = [h.strip().strip('"') for h in lines[0].split(",")]
        us_row = None
        for line in lines[1:]:
            cols = line.split(",")
            if len(cols) > 2 and cols[2].strip().strip('"') == "United States":
                us_row = [c.strip().strip('"') for c in cols]
                break
        if not us_row:
            raise ValueError("United States row not found")

        start = next((i for i, h in enumerate(header) if len(h) >= 4 and h[:4].isdigit()), 5)
        data, date = [], ""
        for i in range(len(header) - 1, start - 1, -1):
            if i >= len(us_row):
                continue
            try:
                v = float(us_row[i])
                if not math.isnan(v):
                    if not data:
                        date = header[i]
                    data.append(v)
            except ValueError:
                continue
            if len(data) >= 15:
                break
        if len(data) < 13:
            raise ValueError("insufficient data")
        return lv(
            round((data[0] / data[12] - 1) * 100, 2),
            round((data[1] / data[13] - 1) * 100, 2) if len(data) >= 14 else round((data[0] / data[12] - 1) * 100, 2),
            date,
        )

    try:
        result["ZORI_YOY"] = zori()
        print("  [OK] ZORI_YOY")
    except Exception as e:
        print(f"  [!!] Zillow: {e} -- falling back to FRED rent CPI")
        result["ZORI_YOY"] = safe("ZORI_YOY (FRED fallback)", lambda: direct_yoy("CUSR0000SEHA", 12))

    # ── Write output ───────────────────────────────────────────────────
    output = {"values": result, "fetchedAt": datetime.now(timezone.utc).isoformat()}
    os.makedirs(os.path.dirname(os.path.abspath(OUT_PATH)), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    ok = sum(1 for v in result.values() if v.get("current") is not None)
    print(f"\n[DONE] {ok}/{len(result)} indicators written to {OUT_PATH}")


if __name__ == "__main__":
    main()
