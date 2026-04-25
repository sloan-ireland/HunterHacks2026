# CUNYPath

Scraper-first workspace for building the Hunter College Computer Science catalog data that powers the CUNYPath planner.

## Stack

- Python
- Playwright
- Hunter's live Coursedog catalog

## Setup

Create the local virtual environment:

```powershell
python -m venv .venv
```

If the venv comes up without `pip`, install into it with:

```powershell
python -m pip --python .venv\Scripts\python.exe install -r requirements.txt
```

Then install Chromium for Playwright:

```powershell
.venv\Scripts\python -m playwright install chromium
```

## Run

```powershell
.venv\Scripts\python .\scripts\scrape_hunter_cs.py
```

The scraper now:

- loads the official Hunter `COMPSCI-BA` program page with Playwright
- reads the required-course structure from the client-side program payload
- opens each course page in Playwright and extracts the rendered `Requisites` block
- writes prerequisite and corequisite course codes directly into `generated/hunter-cs-catalog.json`

## Config

Edit [hunter_cs_config.py](/C:/Users/phalc/Documents/Codex/2026-04-25/cunypath-build-plan-the-pitch-one/config/hunter_cs_config.py) to:

- add or swap elective course URLs
- add course-level overrides for labels, categories, or difficulty
