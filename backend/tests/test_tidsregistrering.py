"""Backend tests for Tidsregistrering API."""
import os
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Read from frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = (BASE_URL or "").rstrip("/")
API = f"{BASE_URL}/api"


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def seeded(session):
    # Ensure users exist – if not, seed
    r = session.get(f"{API}/users")
    assert r.status_code == 200
    if len(r.json()) < 25:
        session.post(f"{API}/seed")
    return True


# ---------- Users / Projects / Activities (seed validation) ----------

def test_users_list(session, seeded):
    r = session.get(f"{API}/users")
    assert r.status_code == 200
    users = r.json()
    assert len(users) == 25, f"Expected 25 users, got {len(users)}"
    u = users[0]
    for key in ["id", "name", "email", "role", "weekly_hours_norm",
                "my_activity_ids", "favorite_activity_ids"]:
        assert key in u, f"Missing field {key}"
    assert isinstance(u["my_activity_ids"], list)


def test_projects_list(session, seeded):
    r = session.get(f"{API}/projects")
    assert r.status_code == 200
    projects = r.json()
    assert len(projects) == 4
    names = sorted(p["name"] for p in projects)
    assert names == ["Projekt Alfa", "Projekt Beta", "Projekt Delta", "Projekt Gamma"]


def test_activities_list(session, seeded):
    r = session.get(f"{API}/activities")
    assert r.status_code == 200
    acts = r.json()
    assert len(acts) >= 15
    statuses = {a["status"] for a in acts}
    assert {"upcoming", "open", "closed"}.issubset(statuses)
    levels = {a["level"] for a in acts}
    assert {"project", "program"}.issubset(levels)


def test_activities_filter_status(session, seeded):
    r = session.get(f"{API}/activities", params={"status": "open"})
    assert r.status_code == 200
    assert all(a["status"] == "open" for a in r.json())


# ---------- Time entry upsert ----------

def test_time_entry_upsert_creates_and_updates(session, seeded):
    users = session.get(f"{API}/users").json()
    acts = session.get(f"{API}/activities", params={"status": "open"}).json()
    uid = users[0]["id"]
    aid = acts[0]["id"]
    week = monday_of(date.today() + timedelta(days=14)).isoformat()  # use a future week

    # cleanup if exists
    existing = session.get(f"{API}/time-entries",
                           params={"user_id": uid, "week_start_date": week}).json()
    for e in existing:
        if e["activity_id"] == aid:
            session.delete(f"{API}/time-entries/{e['id']}")

    day = week  # Monday
    payload = {
        "user_id": uid,
        "activity_id": aid,
        "week_start_date": week,
        "entries": {day: 2.5},
        "saved": False,
    }
    r1 = session.post(f"{API}/time-entries/upsert", json=payload)
    assert r1.status_code == 200
    e1 = r1.json()
    assert e1["entries"][day] == 2.5
    eid1 = e1["id"]

    # Update same key
    payload["entries"] = {day: 4.0}
    r2 = session.post(f"{API}/time-entries/upsert", json=payload)
    assert r2.status_code == 200
    e2 = r2.json()
    assert e2["entries"][day] == 4.0

    # GET to verify only one entry exists
    listed = session.get(f"{API}/time-entries",
                         params={"user_id": uid, "week_start_date": week}).json()
    same = [x for x in listed if x["activity_id"] == aid]
    assert len(same) == 1
    assert same[0]["entries"][day] == 4.0
    # Cleanup
    session.delete(f"{API}/time-entries/{eid1}")


# ---------- Save week ----------

def test_save_week(session, seeded):
    users = session.get(f"{API}/users").json()
    acts = session.get(f"{API}/activities", params={"status": "open"}).json()
    uid = users[1]["id"]
    aid = acts[0]["id"]
    week = monday_of(date.today() + timedelta(days=21)).isoformat()

    payload = {"user_id": uid, "activity_id": aid, "week_start_date": week,
               "entries": {week: 1.0}, "saved": False}
    session.post(f"{API}/time-entries/upsert", json=payload)

    r = session.post(f"{API}/time-entries/save-week",
                     params={"user_id": uid, "week_start_date": week})
    assert r.status_code == 200
    assert r.json()["updated"] >= 1

    listed = session.get(f"{API}/time-entries",
                         params={"user_id": uid, "week_start_date": week}).json()
    assert all(e["saved"] for e in listed if e["activity_id"] == aid)
    # cleanup
    for e in listed:
        if e["activity_id"] == aid:
            session.delete(f"{API}/time-entries/{e['id']}")


# ---------- Copy previous week ----------

def test_copy_previous_week(session, seeded):
    users = session.get(f"{API}/users").json()
    acts = session.get(f"{API}/activities", params={"status": "open"}).json()
    uid = users[2]["id"]
    aid = acts[0]["id"]

    cur = monday_of(date.today() + timedelta(days=28))
    prev = cur - timedelta(days=7)
    cur_iso = cur.isoformat()
    prev_iso = prev.isoformat()

    # seed previous week
    payload = {"user_id": uid, "activity_id": aid, "week_start_date": prev_iso,
               "entries": {prev_iso: 2.0, (prev + timedelta(days=1)).isoformat(): 3.0},
               "saved": True}
    session.post(f"{API}/time-entries/upsert", json=payload)

    r = session.post(f"{API}/time-entries/copy-previous",
                     params={"user_id": uid, "week_start_date": cur_iso})
    assert r.status_code == 200
    body = r.json()
    assert body["copied"] >= 1

    listed = session.get(f"{API}/time-entries",
                         params={"user_id": uid, "week_start_date": cur_iso}).json()
    found = [e for e in listed if e["activity_id"] == aid]
    assert len(found) == 1
    e = found[0]
    assert e["entries"].get(cur_iso) == 2.0
    assert e["entries"].get((cur + timedelta(days=1)).isoformat()) == 3.0
    assert e["saved"] is False  # copy should set saved=false

    # cleanup
    for ent in listed:
        if ent["activity_id"] == aid:
            session.delete(f"{API}/time-entries/{ent['id']}")
    prev_list = session.get(f"{API}/time-entries",
                            params={"user_id": uid, "week_start_date": prev_iso}).json()
    for ent in prev_list:
        if ent["activity_id"] == aid:
            session.delete(f"{API}/time-entries/{ent['id']}")


# ---------- My activities / favorites ----------

def test_my_activity_add_remove(session, seeded):
    users = session.get(f"{API}/users").json()
    acts = session.get(f"{API}/activities").json()
    uid = users[5]["id"]
    aid = acts[-1]["id"]  # pick last

    # remove first to ensure clean
    session.delete(f"{API}/users/{uid}/my-activities/{aid}")

    r = session.post(f"{API}/users/{uid}/my-activities/{aid}")
    assert r.status_code == 200
    u = session.get(f"{API}/users/{uid}").json()
    assert aid in u["my_activity_ids"]

    r = session.delete(f"{API}/users/{uid}/my-activities/{aid}")
    assert r.status_code == 200
    u = session.get(f"{API}/users/{uid}").json()
    assert aid not in u["my_activity_ids"]


def test_toggle_favorite(session, seeded):
    users = session.get(f"{API}/users").json()
    acts = session.get(f"{API}/activities").json()
    uid = users[6]["id"]
    aid = acts[0]["id"]

    initial = session.get(f"{API}/users/{uid}").json()["favorite_activity_ids"]
    was_fav = aid in initial

    r = session.post(f"{API}/users/{uid}/favorites/{aid}")
    assert r.status_code == 200
    favs = r.json()["favorites"]
    if was_fav:
        assert aid not in favs
    else:
        assert aid in favs

    # toggle back
    r = session.post(f"{API}/users/{uid}/favorites/{aid}")
    favs2 = r.json()["favorites"]
    assert (aid in favs2) == was_fav


# ---------- Activity CRUD ----------

def test_activity_crud(session, seeded):
    projects = session.get(f"{API}/projects").json()
    pid = projects[0]["id"]

    # Create project-level
    payload = {"name": "TEST_Activity_pytest", "project_id": pid, "level": "project",
               "status": "upcoming", "requires_note": True}
    r = session.post(f"{API}/activities", json=payload)
    assert r.status_code == 200
    a = r.json()
    assert a["name"] == "TEST_Activity_pytest"
    assert a["project_id"] == pid
    assert a["requires_note"] is True
    aid = a["id"]

    # Update
    r = session.patch(f"{API}/activities/{aid}", json={"status": "open", "name": "TEST_Updated"})
    assert r.status_code == 200
    assert r.json()["status"] == "open"
    assert r.json()["name"] == "TEST_Updated"

    # Verify via list
    listed = session.get(f"{API}/activities").json()
    assert any(x["id"] == aid and x["name"] == "TEST_Updated" for x in listed)

    # Create program-level
    p_payload = {"name": "TEST_ProgramAct", "level": "program", "status": "open"}
    r = session.post(f"{API}/activities", json=p_payload)
    assert r.status_code == 200
    pa = r.json()
    assert pa["project_id"] is None
    assert pa["level"] == "program"

    # Delete
    r = session.delete(f"{API}/activities/{aid}")
    assert r.status_code == 200
    assert r.json()["deleted"] == 1
    r = session.delete(f"{API}/activities/{pa['id']}")
    assert r.status_code == 200


# ---------- Overview ----------

def test_overview(session, seeded):
    today_monday = monday_of(date.today()).isoformat()
    r = session.get(f"{API}/overview", params={"week_start_date": today_monday})
    assert r.status_code == 200
    body = r.json()
    for key in ["week_start_date", "total_hours", "total_users",
                "users_saved", "missing_users", "saved_percent", "breakdown"]:
        assert key in body, f"missing key {key}"
    assert body["total_users"] == 25
    # Breakdown: 4 projects + 1 program = 5
    assert len(body["breakdown"]) == 5
    assert any(b["level"] == "program" for b in body["breakdown"])
    assert sum(1 for b in body["breakdown"] if b["level"] == "project") == 4
    assert isinstance(body["missing_users"], list)
