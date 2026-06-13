# Tidsregistrering – PRD

## Original problem statement (verbatim)
Full-stack tidsregistreringsapplikation til hurtig og enkel tidsregistrering i et komplekst program med ca. 25 medarbejdere, 4 projekter, programledelse, PMO/programkontor og tilknyttede eksperter.

Speed of entry er det vigtigste designprincip. App'en har 4 hovedskærme:
1. Indtast timer (startside)
2. Mine aktiviteter
3. Programoverblik
4. Administration

## User personas
- **Medarbejder** (~22 stk): registrerer egne timer ugentligt, styrer egen aktivitetsliste, kan markere favoritter.
- **Projektleder**: administrerer projektets aktiviteter (åbn/luk/rediger), ansvarlig for aktiviteter.
- **PMO/Programkontor**: administrerer programniveau-aktiviteter og bruger programoverblikket.

## Core requirements (static)
- React + FastAPI + MongoDB stack
- Hele UI på dansk
- Speed of entry over alt andet (Tab/Enter/piletast-navigation, autosave debounced 500ms)
- Ingen marketing, ingen hero, ingen dekoration – Nordic Minimalist / Swiss
- Simpel user-switcher (ingen rigtig auth) – valgte bruger gemmes i localStorage
- /api-prefix på alle backend routes, MONGO_URL fra env, REACT_APP_BACKEND_URL i frontend

## What's been implemented (2026-02-13)
- Backend `server.py` med fulde CRUD-endpoints for users, projects, activities, time_entries
- `/api/time-entries/upsert`, `/save-week`, `/copy-previous`
- `/api/users/{id}/my-activities/{aid}` (add/remove) og `/favorites/{aid}` toggle
- `/api/overview` med projekt-breakdown, missing users, saved %
- Auto-seed ved tom DB: 25 brugere (Mette/Lars/Anne som PMO/PL + 22 medarbejdere), 4 projekter, 16 aktiviteter, prøve-timer for forrige+aktuelle uge
- Skærm 1 (Indtast timer): sticky-kolonne grid, KPI-tiles, ugenavigation, Kopiér sidste uge, Gem uge, søg+tilføj, Tab/Enter/pile-navigation, autosave
- Skærm 2 (Mine aktiviteter): filtre (alle/projekt/program), favoritter, tilføj/fjern fra åbne aktiviteter
- Skærm 3 (Programoverblik): KPIs, breakdown m. timer-bars, missing-users
- Skærm 4 (Administration): grupperet efter status, ny/rediger-dialog, quick åbn/luk, slet
- Design: Outfit-headings + IBM Plex Sans body + IBM Plex Mono numerals, zinc-palette
- 100% test pass (backend 11/11, frontend critical flows)

## Prioritized backlog
### P1 (small polish)
- Visning af aktivitets-ejer i Mine aktiviteter ("Ansvarlig: <navn>")
- Eksport CSV af programoverblik (knap er i wireframes men ikke implementeret)
- "Importér fra plan" og "Send påmindelser" i Administration / Programoverblik (kosmetisk i wireframes)

### P2 (nice-to-have)
- Rigtig autentificering (JWT email/password eller Google SSO)
- Rolle-baserede guards (kun PL/PMO ser Administration)
- Note-validering: aktivitet med requires_note=true må ikke gemmes uden note
- Historikvisning pr. aktivitet (forrige 4 uger)
- Forventet vs registreret timer pr. dag (advarsel ved 0/24)
- ISO-uger med uge-nummer-visning i datepicker
- Mobil-optimering (gridet er pt. desktop-first)

### P3 (later)
- Eksport til Excel / økonomisystem
- Budget pr. aktivitet og budget burndown
- Bulk-tildeling: PL kan tildele aktiviteter til hold af medarbejdere
- Excel-import af aktivitetspulje
