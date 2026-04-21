from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, date as date_cls

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ============ Models ============
PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"]
ADHKAR_TYPES = ["morning", "evening", "after_prayer", "sleep"]


class PrayerToggle(BaseModel):
    device_id: str
    date: str  # YYYY-MM-DD
    prayer: str  # fajr/dhuhr/asr/maghrib/isha
    completed: bool


class AdhkarLog(BaseModel):
    device_id: str
    date: str
    adhkar_type: str  # morning/evening/after_prayer/sleep
    completed: bool = True


class TasbihLog(BaseModel):
    device_id: str
    date: str
    count: int  # total count added


class QuranLog(BaseModel):
    device_id: str
    date: str
    pages: int


class CustomWird(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    title: str
    target: int = 1  # target count per day
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CustomWirdCreate(BaseModel):
    device_id: str
    title: str
    target: int = 1


class CustomWirdLog(BaseModel):
    device_id: str
    date: str
    wird_id: str
    count: int  # count to add


# ============ Helpers ============
async def get_day_doc(device_id: str, date: str) -> Dict[str, Any]:
    doc = await db.activities.find_one(
        {"device_id": device_id, "date": date}, {"_id": 0}
    )
    if not doc:
        doc = {
            "device_id": device_id,
            "date": date,
            "prayers": {p: False for p in PRAYERS},
            "adhkar": {a: False for a in ADHKAR_TYPES},
            "sunnah": {p: {"before": False, "after": False} for p in PRAYERS},
            "tasbih_count": 0,
            "quran_pages": 0,
            "custom_wirds": {},  # wird_id -> count
        }
    # Ensure structure for older docs
    doc.setdefault("prayers", {p: False for p in PRAYERS})
    doc.setdefault("adhkar", {a: False for a in ADHKAR_TYPES})
    doc.setdefault("sunnah", {p: {"before": False, "after": False} for p in PRAYERS})
    for p in PRAYERS:
        doc["sunnah"].setdefault(p, {"before": False, "after": False})
    doc.setdefault("tasbih_count", 0)
    doc.setdefault("quran_pages", 0)
    doc.setdefault("custom_wirds", {})
    return doc


async def save_day_doc(doc: Dict[str, Any]):
    await db.activities.update_one(
        {"device_id": doc["device_id"], "date": doc["date"]},
        {"$set": doc},
        upsert=True,
    )


# ============ Routes ============
@api_router.get("/")
async def root():
    return {"message": "Salah & Wird Tracker API"}


@api_router.get("/prayer-times")
async def prayer_times(
    lat: float = Query(...),
    lng: float = Query(...),
    date: Optional[str] = None,  # DD-MM-YYYY
    method: int = 4,  # Umm al-Qura (Makkah)
):
    """Fetch prayer times from Aladhan API."""
    try:
        if not date:
            today = datetime.now(timezone.utc).date()
            date = today.strftime("%d-%m-%Y")
        url = f"https://api.aladhan.com/v1/timings/{date}"
        params = {"latitude": lat, "longitude": lng, "method": method}
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        data = r.json().get("data", {})
        timings = data.get("timings", {})
        hijri = data.get("date", {}).get("hijri", {})
        gregorian = data.get("date", {}).get("gregorian", {})
        meta = data.get("meta", {})
        return {
            "timings": {
                "fajr": timings.get("Fajr"),
                "sunrise": timings.get("Sunrise"),
                "dhuhr": timings.get("Dhuhr"),
                "asr": timings.get("Asr"),
                "maghrib": timings.get("Maghrib"),
                "isha": timings.get("Isha"),
            },
            "hijri": {
                "day": hijri.get("day"),
                "month_ar": hijri.get("month", {}).get("ar"),
                "month_en": hijri.get("month", {}).get("en"),
                "year": hijri.get("year"),
                "weekday_ar": hijri.get("weekday", {}).get("ar"),
            },
            "gregorian": {
                "day": gregorian.get("day"),
                "month_en": gregorian.get("month", {}).get("en"),
                "year": gregorian.get("year"),
                "weekday_en": gregorian.get("weekday", {}).get("en"),
            },
            "timezone": meta.get("timezone"),
        }
    except Exception as e:
        logger.exception("prayer-times error")
        raise HTTPException(status_code=502, detail=f"Aladhan API error: {str(e)}")


@api_router.post("/prayers/toggle")
async def toggle_prayer(body: PrayerToggle):
    if body.prayer not in PRAYERS:
        raise HTTPException(400, "Invalid prayer")
    doc = await get_day_doc(body.device_id, body.date)
    doc["prayers"][body.prayer] = body.completed
    await save_day_doc(doc)
    return {"ok": True, "prayers": doc["prayers"]}


@api_router.post("/adhkar/toggle")
async def toggle_adhkar(body: AdhkarLog):
    if body.adhkar_type not in ADHKAR_TYPES:
        raise HTTPException(400, "Invalid adhkar type")
    doc = await get_day_doc(body.device_id, body.date)
    doc["adhkar"][body.adhkar_type] = body.completed
    await save_day_doc(doc)
    return {"ok": True, "adhkar": doc["adhkar"]}


class SunnahToggle(BaseModel):
    device_id: str
    date: str
    prayer: str  # fajr/dhuhr/asr/maghrib/isha
    kind: str  # before or after
    completed: bool


@api_router.post("/sunnah/toggle")
async def toggle_sunnah(body: SunnahToggle):
    if body.prayer not in PRAYERS or body.kind not in ("before", "after"):
        raise HTTPException(400, "Invalid prayer or kind")
    doc = await get_day_doc(body.device_id, body.date)
    doc["sunnah"].setdefault(body.prayer, {"before": False, "after": False})
    doc["sunnah"][body.prayer][body.kind] = body.completed
    await save_day_doc(doc)
    return {"ok": True, "sunnah": doc["sunnah"]}


class QuranBookmark(BaseModel):
    device_id: str
    page: int


@api_router.post("/quran/bookmark")
async def set_bookmark(body: QuranBookmark):
    await db.quran_bookmarks.update_one(
        {"device_id": body.device_id},
        {"$set": {"device_id": body.device_id, "page": int(body.page),
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "page": int(body.page)}


@api_router.get("/quran/bookmark")
async def get_bookmark(device_id: str):
    doc = await db.quran_bookmarks.find_one({"device_id": device_id}, {"_id": 0})
    return doc or {"device_id": device_id, "page": 1}


@api_router.post("/tasbih/add")
async def add_tasbih(body: TasbihLog):
    doc = await get_day_doc(body.device_id, body.date)
    doc["tasbih_count"] = int(doc.get("tasbih_count", 0)) + int(body.count)
    await save_day_doc(doc)
    return {"ok": True, "tasbih_count": doc["tasbih_count"]}


@api_router.post("/tasbih/reset")
async def reset_tasbih(body: TasbihLog):
    doc = await get_day_doc(body.device_id, body.date)
    doc["tasbih_count"] = 0
    await save_day_doc(doc)
    return {"ok": True, "tasbih_count": 0}


@api_router.post("/quran/set")
async def set_quran(body: QuranLog):
    doc = await get_day_doc(body.device_id, body.date)
    doc["quran_pages"] = int(body.pages)
    await save_day_doc(doc)
    return {"ok": True, "quran_pages": doc["quran_pages"]}


@api_router.get("/day")
async def get_day(device_id: str, date: str):
    doc = await get_day_doc(device_id, date)
    return doc


# ---- Custom wirds ----
@api_router.post("/wirds", response_model=CustomWird)
async def create_wird(body: CustomWirdCreate):
    w = CustomWird(device_id=body.device_id, title=body.title, target=body.target)
    await db.custom_wirds.insert_one(w.dict())
    return w


@api_router.get("/wirds")
async def list_wirds(device_id: str):
    wirds = await db.custom_wirds.find(
        {"device_id": device_id}, {"_id": 0}
    ).to_list(500)
    return wirds


@api_router.delete("/wirds/{wird_id}")
async def delete_wird(wird_id: str, device_id: str):
    await db.custom_wirds.delete_one({"id": wird_id, "device_id": device_id})
    return {"ok": True}


@api_router.post("/wirds/log")
async def log_wird(body: CustomWirdLog):
    doc = await get_day_doc(body.device_id, body.date)
    current = int(doc["custom_wirds"].get(body.wird_id, 0))
    doc["custom_wirds"][body.wird_id] = current + int(body.count)
    await save_day_doc(doc)
    return {"ok": True, "custom_wirds": doc["custom_wirds"]}


# ---- Stats ----
def _score_doc(doc: Dict[str, Any]) -> Dict[str, int]:
    prayers = doc.get("prayers", {})
    adhkar = doc.get("adhkar", {})
    return {
        "prayers_done": sum(1 for v in prayers.values() if v),
        "adhkar_done": sum(1 for v in adhkar.values() if v),
        "tasbih_count": int(doc.get("tasbih_count", 0)),
        "quran_pages": int(doc.get("quran_pages", 0)),
    }


@api_router.get("/stats/range")
async def stats_range(device_id: str, start: str, end: str):
    """Returns per-day breakdown and totals between start and end (YYYY-MM-DD inclusive)."""
    cursor = db.activities.find(
        {"device_id": device_id, "date": {"$gte": start, "$lte": end}}, {"_id": 0}
    )
    days = await cursor.to_list(1000)
    per_day = []
    totals = {
        "prayers_done": 0,
        "adhkar_done": 0,
        "tasbih_count": 0,
        "quran_pages": 0,
        "days_tracked": 0,
        "days_full_prayers": 0,
    }
    for d in days:
        score = _score_doc(d)
        per_day.append({"date": d["date"], **score})
        totals["prayers_done"] += score["prayers_done"]
        totals["adhkar_done"] += score["adhkar_done"]
        totals["tasbih_count"] += score["tasbih_count"]
        totals["quran_pages"] += score["quran_pages"]
        totals["days_tracked"] += 1
        if score["prayers_done"] == 5:
            totals["days_full_prayers"] += 1
    per_day.sort(key=lambda x: x["date"])
    return {"per_day": per_day, "totals": totals}


@api_router.get("/stats/summary")
async def stats_summary(device_id: str):
    """Quick summary: today, this month, this year, current streak."""
    today = datetime.now(timezone.utc).date()
    today_str = today.strftime("%Y-%m-%d")
    month_start = today.replace(day=1).strftime("%Y-%m-%d")
    year_start = today.replace(month=1, day=1).strftime("%Y-%m-%d")

    today_doc = await get_day_doc(device_id, today_str)
    today_score = _score_doc(today_doc)

    async def range_totals(start: str, end: str):
        cur = db.activities.find(
            {"device_id": device_id, "date": {"$gte": start, "$lte": end}}, {"_id": 0}
        )
        docs = await cur.to_list(2000)
        tot = {"prayers_done": 0, "adhkar_done": 0, "tasbih_count": 0, "quran_pages": 0}
        for d in docs:
            s = _score_doc(d)
            for k in tot:
                tot[k] += s[k]
        return tot

    month = await range_totals(month_start, today_str)
    year = await range_totals(year_start, today_str)

    # Current streak: consecutive days (ending today or yesterday) with prayers_done >= 1
    from datetime import timedelta
    streak = 0
    cur_date = today
    for _ in range(400):
        ds = cur_date.strftime("%Y-%m-%d")
        doc = await db.activities.find_one(
            {"device_id": device_id, "date": ds}, {"_id": 0}
        )
        if doc and _score_doc(doc)["prayers_done"] >= 1:
            streak += 1
            cur_date = cur_date - timedelta(days=1)
        else:
            break

    return {
        "today": today_score,
        "month": month,
        "year": year,
        "streak_days": streak,
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
