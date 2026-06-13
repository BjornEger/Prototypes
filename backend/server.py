"""Tidsregistrering – Full backend API.

Endpoints prefixed with /api. MongoDB-backed.
Designed for speed of entry: minimal validation, fast CRUD.
"""

from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, date, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Tidsregistrering API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Models ----------

def _uid() -> str:
    return str(uuid.uuid4())


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    name: str
    email: str
    role: Literal["medarbejder", "projektleder", "pmo"] = "medarbejder"
    weekly_hours_norm: float = 37.0
    favorite_activity_ids: List[str] = Field(default_factory=list)
    my_activity_ids: List[str] = Field(default_factory=list)


class UserCreate(BaseModel):
    name: str
    email: str
    role: Literal["medarbejder", "projektleder", "pmo"] = "medarbejder"
    weekly_hours_norm: float = 37.0


class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    name: str
    code: str
    status: Literal["active", "closed"] = "active"


class ProjectCreate(BaseModel):
    name: str
    code: str
    status: Literal["active", "closed"] = "active"


class Activity(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    name: str
    project_id: Optional[str] = None  # null = program level
    level: Literal["project", "program"] = "project"
    owner_user_id: Optional[str] = None
    status: Literal["upcoming", "open", "closed"] = "open"
    requires_note: bool = False


class ActivityCreate(BaseModel):
    name: str
    project_id: Optional[str] = None
    level: Literal["project", "program"] = "project"
    owner_user_id: Optional[str] = None
    status: Literal["upcoming", "open", "closed"] = "open"
    requires_note: bool = False


class ActivityUpdate(BaseModel):
    name: Optional[str] = None
    project_id: Optional[str] = None
    level: Optional[Literal["project", "program"]] = None
    owner_user_id: Optional[str] = None
    status: Optional[Literal["upcoming", "open", "closed"]] = None
    requires_note: Optional[bool] = None


class TimeEntry(BaseModel):
    """One row = one user, one activity, one week.
    entries is a dict mapping ISO date (YYYY-MM-DD) -> hours (float).
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    user_id: str
    activity_id: str
    week_start_date: str  # ISO YYYY-MM-DD (Monday)
    entries: dict = Field(default_factory=dict)
    note: str = ""
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    saved: bool = False  # false = kladde, true = gemt


class TimeEntryUpsert(BaseModel):
    user_id: str
    activity_id: str
    week_start_date: str
    entries: dict = Field(default_factory=dict)
    note: str = ""
    saved: bool = False


# ---------- Helpers ----------

def _strip_id(doc):
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


def _monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


# ---------- Users ----------

@api_router.get("/users", response_model=List[User])
async def list_users():
    docs = await db.users.find({}, {"_id": 0}).to_list(500)
    return docs


@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "User not found")
    return doc


@api_router.post("/users", response_model=User)
async def create_user(payload: UserCreate):
    user = User(**payload.model_dump())
    await db.users.insert_one(user.model_dump())
    return user


@api_router.patch("/users/{user_id}", response_model=User)
async def update_user(user_id: str, payload: dict):
    doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "User not found")
    doc.update({k: v for k, v in payload.items() if v is not None})
    await db.users.update_one({"id": user_id}, {"$set": doc})
    return doc


# ---------- Projects ----------

@api_router.get("/projects", response_model=List[Project])
async def list_projects():
    docs = await db.projects.find({}, {"_id": 0}).to_list(500)
    return docs


@api_router.post("/projects", response_model=Project)
async def create_project(payload: ProjectCreate):
    p = Project(**payload.model_dump())
    await db.projects.insert_one(p.model_dump())
    return p


# ---------- Activities ----------

@api_router.get("/activities", response_model=List[Activity])
async def list_activities(
    status: Optional[str] = None,
    level: Optional[str] = None,
    q: Optional[str] = None,
):
    query = {}
    if status:
        query["status"] = status
    if level:
        query["level"] = level
    docs = await db.activities.find(query, {"_id": 0}).to_list(1000)
    if q:
        ql = q.lower()
        docs = [d for d in docs if ql in d["name"].lower()]
    return docs


@api_router.post("/activities", response_model=Activity)
async def create_activity(payload: ActivityCreate):
    a = Activity(**payload.model_dump())
    await db.activities.insert_one(a.model_dump())
    return a


@api_router.patch("/activities/{activity_id}", response_model=Activity)
async def update_activity(activity_id: str, payload: ActivityUpdate):
    doc = await db.activities.find_one({"id": activity_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Activity not found")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    doc.update(updates)
    await db.activities.update_one({"id": activity_id}, {"$set": doc})
    return doc


@api_router.delete("/activities/{activity_id}")
async def delete_activity(activity_id: str):
    res = await db.activities.delete_one({"id": activity_id})
    return {"deleted": res.deleted_count}


# ---------- User activity-list (mine aktiviteter) ----------

@api_router.post("/users/{user_id}/my-activities/{activity_id}")
async def add_my_activity(user_id: str, activity_id: str):
    doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "User not found")
    my = set(doc.get("my_activity_ids", []))
    my.add(activity_id)
    await db.users.update_one({"id": user_id}, {"$set": {"my_activity_ids": list(my)}})
    return {"ok": True}


@api_router.delete("/users/{user_id}/my-activities/{activity_id}")
async def remove_my_activity(user_id: str, activity_id: str):
    doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "User not found")
    my = [a for a in doc.get("my_activity_ids", []) if a != activity_id]
    favs = [a for a in doc.get("favorite_activity_ids", []) if a != activity_id]
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"my_activity_ids": my, "favorite_activity_ids": favs}},
    )
    return {"ok": True}


@api_router.post("/users/{user_id}/favorites/{activity_id}")
async def toggle_favorite(user_id: str, activity_id: str):
    doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "User not found")
    favs = set(doc.get("favorite_activity_ids", []))
    if activity_id in favs:
        favs.remove(activity_id)
    else:
        favs.add(activity_id)
    await db.users.update_one({"id": user_id}, {"$set": {"favorite_activity_ids": list(favs)}})
    return {"favorites": list(favs)}


# ---------- Time entries ----------

@api_router.get("/time-entries")
async def list_time_entries(
    user_id: Optional[str] = None,
    week_start_date: Optional[str] = None,
):
    query = {}
    if user_id:
        query["user_id"] = user_id
    if week_start_date:
        query["week_start_date"] = week_start_date
    docs = await db.time_entries.find(query, {"_id": 0}).to_list(2000)
    return docs


@api_router.post("/time-entries/upsert")
async def upsert_time_entry(payload: TimeEntryUpsert):
    """Upsert by (user_id, activity_id, week_start_date)."""
    key = {
        "user_id": payload.user_id,
        "activity_id": payload.activity_id,
        "week_start_date": payload.week_start_date,
    }
    existing = await db.time_entries.find_one(key, {"_id": 0})
    now_iso = datetime.now(timezone.utc).isoformat()
    if existing:
        existing.update({
            "entries": payload.entries,
            "note": payload.note,
            "saved": payload.saved,
            "updated_at": now_iso,
        })
        await db.time_entries.update_one(key, {"$set": existing})
        return existing
    entry = TimeEntry(**payload.model_dump(), )
    entry.updated_at = now_iso
    await db.time_entries.insert_one(entry.model_dump())
    return entry.model_dump()


@api_router.post("/time-entries/save-week")
async def save_week(user_id: str, week_start_date: str):
    """Mark all entries for this week as saved (gemt)."""
    res = await db.time_entries.update_many(
        {"user_id": user_id, "week_start_date": week_start_date},
        {"$set": {"saved": True, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"updated": res.modified_count}


@api_router.post("/time-entries/copy-previous")
async def copy_previous_week(user_id: str, week_start_date: str):
    """Copy hours from previous week into this week (per activity)."""
    cur_monday = date.fromisoformat(week_start_date)
    prev_monday = cur_monday - timedelta(days=7)
    prev_iso = prev_monday.isoformat()

    prev_entries = await db.time_entries.find(
        {"user_id": user_id, "week_start_date": prev_iso}, {"_id": 0}
    ).to_list(500)

    # Map day-offset (0..6) -> hours, then translate to new week's dates
    created = 0
    for pe in prev_entries:
        new_entries = {}
        for d_str, hours in (pe.get("entries") or {}).items():
            try:
                d_obj = date.fromisoformat(d_str)
            except Exception:
                continue
            offset = (d_obj - prev_monday).days
            if 0 <= offset <= 6:
                new_day = (cur_monday + timedelta(days=offset)).isoformat()
                new_entries[new_day] = hours

        key = {
            "user_id": user_id,
            "activity_id": pe["activity_id"],
            "week_start_date": week_start_date,
        }
        now_iso = datetime.now(timezone.utc).isoformat()
        existing = await db.time_entries.find_one(key, {"_id": 0})
        if existing:
            merged = {**existing.get("entries", {}), **new_entries}
            await db.time_entries.update_one(
                key, {"$set": {"entries": merged, "saved": False, "updated_at": now_iso}}
            )
        else:
            te = TimeEntry(
                user_id=user_id,
                activity_id=pe["activity_id"],
                week_start_date=week_start_date,
                entries=new_entries,
                note=pe.get("note", ""),
                saved=False,
                updated_at=now_iso,
            )
            await db.time_entries.insert_one(te.model_dump())
            created += 1

    return {"copied": len(prev_entries), "created_new": created}


@api_router.delete("/time-entries/{entry_id}")
async def delete_time_entry(entry_id: str):
    res = await db.time_entries.delete_one({"id": entry_id})
    return {"deleted": res.deleted_count}


# ---------- Program overblik ----------

def _empty_project_total(p):
    return {
        "id": p["id"], "name": p["name"], "code": p["code"],
        "hours": 0.0, "users": set(),
    }


def _accumulate_entries(entries, act_by_id, project_totals, program_total):
    """Walk time-entries once and accumulate into project/program buckets.

    Returns (total_hours, users_with_entries, users_saved).
    """
    total_hours = 0.0
    users_with_entries = set()
    users_saved = set()
    for e in entries:
        activity = act_by_id.get(e["activity_id"])
        if not activity:
            continue
        hours = sum(float(v) for v in (e.get("entries") or {}).values())
        total_hours += hours
        users_with_entries.add(e["user_id"])
        if e.get("saved"):
            users_saved.add(e["user_id"])

        is_program_level = activity.get("level") == "program" or not activity.get("project_id")
        if is_program_level:
            program_total["hours"] += hours
            program_total["users"].add(e["user_id"])
            continue
        pid = activity.get("project_id")
        if pid in project_totals:
            project_totals[pid]["hours"] += hours
            project_totals[pid]["users"].add(e["user_id"])
    return total_hours, users_with_entries, users_saved


def _build_breakdown(project_totals, program_total):
    rows = [
        {
            "id": p["id"], "name": p["name"], "code": p["code"],
            "hours": round(p["hours"], 2), "people": len(p["users"]),
            "level": "project",
        }
        for p in project_totals.values()
    ]
    rows.append({
        "id": program_total["id"], "name": program_total["name"], "code": program_total["code"],
        "hours": round(program_total["hours"], 2), "people": len(program_total["users"]),
        "level": "program",
    })
    return rows


@api_router.get("/overview")
async def program_overview(week_start_date: str):
    """Aggregate hours per project & program for a given week, plus missing reports."""
    users = await db.users.find({}, {"_id": 0}).to_list(500)
    projects = await db.projects.find({}, {"_id": 0}).to_list(500)
    activities = await db.activities.find({}, {"_id": 0}).to_list(1000)
    entries = await db.time_entries.find(
        {"week_start_date": week_start_date}, {"_id": 0}
    ).to_list(5000)

    act_by_id = {a["id"]: a for a in activities}
    project_totals = {p["id"]: _empty_project_total(p) for p in projects}
    program_total = {
        "id": "program", "name": "Programniveau / PMO", "code": "PRG",
        "hours": 0.0, "users": set(),
    }

    total_hours, users_with_entries, users_saved = _accumulate_entries(
        entries, act_by_id, project_totals, program_total,
    )

    missing = [
        {"id": u["id"], "name": u["name"], "email": u["email"]}
        for u in users
        if u["id"] not in users_saved
    ]
    total_users = len(users)
    saved_percent = round(100.0 * len(users_saved) / total_users, 1) if total_users else 0.0

    return {
        "week_start_date": week_start_date,
        "total_hours": round(total_hours, 2),
        "total_users": total_users,
        "users_saved": len(users_saved),
        "users_with_entries": len(users_with_entries),
        "missing_users": missing,
        "saved_percent": saved_percent,
        "breakdown": _build_breakdown(project_totals, program_total),
    }


# ---------- Seed ----------

DANISH_FIRST = [
    "Anders", "Mette", "Lars", "Camilla", "Peter", "Sofie", "Mikkel", "Anne",
    "Jens", "Line", "Henrik", "Maria", "Thomas", "Kirsten", "Søren", "Louise",
    "Morten", "Hanne", "Rasmus", "Pernille", "Frederik", "Ida", "Kasper",
    "Julie", "Christian",
]
DANISH_LAST = [
    "Nielsen", "Jensen", "Hansen", "Pedersen", "Andersen", "Christensen",
    "Larsen", "Sørensen", "Rasmussen", "Jørgensen", "Petersen", "Madsen",
    "Kristensen", "Olsen", "Thomsen", "Christiansen", "Poulsen", "Johansen",
    "Møller", "Mortensen",
]


def _build_demo_projects() -> List[Project]:
    return [
        Project(name="Projekt Alfa", code="ALF", status="active"),
        Project(name="Projekt Beta", code="BET", status="active"),
        Project(name="Projekt Gamma", code="GAM", status="active"),
        Project(name="Projekt Delta", code="DEL", status="active"),
    ]


def _build_demo_users() -> List[User]:
    users: List[User] = [
        User(name="Mette Hansen", email="mette.hansen@program.dk", role="pmo", weekly_hours_norm=37.0),
        User(name="Lars Pedersen", email="lars.pedersen@program.dk", role="projektleder", weekly_hours_norm=37.0),
        User(name="Anne Larsen", email="anne.larsen@program.dk", role="projektleder", weekly_hours_norm=37.0),
    ]
    for i in range(22):
        first = DANISH_FIRST[(i + 3) % len(DANISH_FIRST)]
        last = DANISH_LAST[(i * 3 + 1) % len(DANISH_LAST)]
        users.append(User(
            name=f"{first} {last}",
            email=f"{first.lower()}.{last.lower()}@program.dk",
            role="medarbejder",
            weekly_hours_norm=37.0,
        ))
    return users


def _build_demo_activities(projects: List[Project], pmo: User, pl_lars: User, pl_anne: User) -> List[Activity]:
    alfa, beta, gamma, delta = projects
    return [
        Activity(name="Analyse af proceslandskab", project_id=alfa.id, level="project", owner_user_id=pl_lars.id, status="open"),
        Activity(name="Workshopforberedelse", project_id=alfa.id, level="project", owner_user_id=pl_lars.id, status="open"),
        Activity(name="Analyseaktivitet uden ejer", project_id=alfa.id, level="project", owner_user_id=None, status="open"),

        Activity(name="Leveranceplan og koordinering", project_id=beta.id, level="project", owner_user_id=pl_anne.id, status="open"),
        Activity(name="Arkitekturafklaring", project_id=beta.id, level="project", owner_user_id=pl_anne.id, status="open", requires_note=True),
        Activity(name="Opstart og scope", project_id=beta.id, level="project", owner_user_id=pl_anne.id, status="closed"),
        Activity(name="Dataafstemning", project_id=beta.id, level="project", owner_user_id=pl_anne.id, status="upcoming"),

        Activity(name="Faglig ekspertbistand", project_id=gamma.id, level="project", owner_user_id=pl_lars.id, status="open"),
        Activity(name="Første baseline", project_id=gamma.id, level="project", owner_user_id=pl_lars.id, status="closed"),

        Activity(name="Testforberedelse og datagrundlag", project_id=delta.id, level="project", owner_user_id=pl_anne.id, status="upcoming"),
        Activity(name="Implementering modul 1", project_id=delta.id, level="project", owner_user_id=pl_anne.id, status="open"),

        # Program-level
        Activity(name="PMO status og rapportering", project_id=None, level="program", owner_user_id=pmo.id, status="open"),
        Activity(name="Styregruppemateriale", project_id=None, level="program", owner_user_id=pmo.id, status="open", requires_note=True),
        Activity(name="Programledelse - koordinering", project_id=None, level="program", owner_user_id=pmo.id, status="open"),
        Activity(name="Gammel fællesaktivitet", project_id=None, level="program", owner_user_id=pmo.id, status="open"),
        Activity(name="Programopstart", project_id=None, level="program", owner_user_id=pmo.id, status="closed"),
    ]


# `random` is used here only to generate non-security demo data (sample hours, name
# pairing in the seed). It is seeded deterministically (`random.seed(7)`) and is
# never used for tokens, passwords or anything security sensitive.
import random  # noqa: E402


def _assign_my_activities(users: List[User], open_activity_ids: List[str]) -> None:
    random.seed(7)
    for u in users:
        n = random.randint(3, 5)
        my = random.sample(open_activity_ids, min(n, len(open_activity_ids)))
        u.my_activity_ids = my
        u.favorite_activity_ids = my[: min(2, len(my))]


def _build_week_hours_for(activity_ids: List[str], week_monday: date, saved: bool, user_id: str) -> List[dict]:
    out: List[dict] = []
    for aid in activity_ids:
        entries_for_act = {}
        total = 0.0
        for d in range(5):
            h = random.choice([0, 0, 1, 1.5, 2, 2.5, 3])
            if h:
                entries_for_act[(week_monday + timedelta(days=d)).isoformat()] = h
                total += h
        if total == 0:
            continue
        out.append(TimeEntry(
            user_id=user_id,
            activity_id=aid,
            week_start_date=week_monday.isoformat(),
            entries=entries_for_act,
            saved=saved,
        ).model_dump())
    return out


def _build_demo_time_entries(users: List[User]) -> List[dict]:
    cur_monday = _monday_of(date.today())
    prev_monday = cur_monday - timedelta(days=7)
    sample_users = users[:20]
    rows: List[dict] = []
    for u in sample_users:
        for week_monday, saved in [(prev_monday, True), (cur_monday, False)]:
            rows.extend(_build_week_hours_for(u.my_activity_ids, week_monday, saved, u.id))
    return rows


@api_router.post("/seed")
async def seed_data():
    """Wipe and seed demo data (25 users, 4 projects, ~16 activities, sample entries)."""
    await db.users.delete_many({})
    await db.projects.delete_many({})
    await db.activities.delete_many({})
    await db.time_entries.delete_many({})

    projects = _build_demo_projects()
    await db.projects.insert_many([p.model_dump() for p in projects])

    users = _build_demo_users()
    pmo, pl_lars, pl_anne = users[0], users[1], users[2]

    activities = _build_demo_activities(projects, pmo, pl_lars, pl_anne)
    await db.activities.insert_many([a.model_dump() for a in activities])

    open_activity_ids = [a.id for a in activities if a.status == "open"]
    _assign_my_activities(users, open_activity_ids)
    await db.users.insert_many([u.model_dump() for u in users])

    entries_to_insert = _build_demo_time_entries(users)
    if entries_to_insert:
        await db.time_entries.insert_many(entries_to_insert)

    return {
        "users": len(users),
        "projects": len(projects),
        "activities": len(activities),
        "time_entries": len(entries_to_insert),
    }


@api_router.get("/")
async def root():
    return {"message": "Tidsregistrering API"}


# ---------- App wiring ----------

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def auto_seed_if_empty():
    count = await db.users.count_documents({})
    if count == 0:
        logger.info("Empty database – seeding demo data...")
        try:
            await seed_data()
        except Exception as e:
            logger.error(f"Seeding failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
