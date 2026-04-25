from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config.hunter_cs_config import BASE_URL, COURSE_OVERRIDES, ELECTIVE_COURSE_URLS, PROGRAM, REQUIREMENT_NAMES

COURSE_CODE_RE = re.compile(r"\b([A-Z]{2,6})\s?(\d{5})\b")

REQUISITE_LABEL_RE = re.compile(
    r"(?P<prerequisite>\bprerequisites?\b|\bprereq\b|\bprerequsite\b)"
    r"|(?P<corequisite>\bcorequisites?\b|\bcorequisite\b|\bcoreq\b|\bco-?req(?:uisites?)?\b)",
    re.IGNORECASE,
)

COURSE_PAGE_SCRIPT = """
() => {
  const course = window.__NUXT__?.data?.[0]?.course ?? null;
  const sections = {};
  for (const heading of document.querySelectorAll('h2')) {
    const title = heading.textContent.trim();
    if (!title) continue;
    sections[title] = heading.parentElement ? heading.parentElement.innerText : heading.innerText;
  }
  return { course, sections };
}
"""

PROGRAM_PAGE_SCRIPT = """
() => window.__NUXT__?.data?.[0]?.program ?? null
"""


def uniq(values: list[str]) -> list[str]:
    return list(dict.fromkeys(values))


def normalize_text(value: str | None) -> str:
    if not value:
        return ""

    text = (
        value.replace("\u00a0", " ")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )

    return " ".join(text.split())


def normalize_code(subject: str, course_number: str) -> str:
    return f"{subject} {course_number}"


def normalize_semesters(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [chunk.strip().lower() for chunk in raw.split(",") if chunk.strip()]


def infer_difficulty(course_number: str) -> str:
    if not course_number:
        return "unknown"

    level = course_number[0]
    if level == "1":
        return "introductory"
    if level == "2":
        return "foundational"
    if level == "3":
        return "intermediate"
    if level == "4":
        return "advanced"
    return "unknown"


def get_course_group_id_from_url(url: str) -> str:
    match = re.search(r"/courses/([^/?#]+)", url)
    if not match:
        raise ValueError(f"Could not parse course group ID from {url}")
    return match.group(1)


def extract_course_codes(text: str) -> list[str]:
    codes = [normalize_code(subject, number) for subject, number in COURSE_CODE_RE.findall(text)]
    return uniq(codes)


def parse_requisites(text: str) -> dict[str, Any]:
    clean = normalize_text(text)
    if clean.lower().startswith("requisites"):
        clean = clean[len("Requisites") :].strip(" :-")

    matches = list(REQUISITE_LABEL_RE.finditer(clean))
    sections: dict[str, str] = {
        "prerequisite_text": "",
        "corequisite_text": "",
    }

    if not matches:
        return {
            "requisites_text": clean,
            "prerequisite_text": "",
            "corequisite_text": "",
            "prerequisites": [],
            "corequisites": [],
        }

    for index, match in enumerate(matches):
        section_type = "prerequisite_text" if match.lastgroup == "prerequisite" else "corequisite_text"
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(clean)
        snippet = clean[start:end].strip(" :;,-")
        snippet = re.sub(r"\b(?:and|or)\s*$", "", snippet, flags=re.IGNORECASE).strip(" :;,-")
        sections[section_type] = normalize_text(snippet)

    return {
        "requisites_text": clean,
        "prerequisite_text": sections["prerequisite_text"],
        "corequisite_text": sections["corequisite_text"],
        "prerequisites": extract_course_codes(sections["prerequisite_text"]),
        "corequisites": extract_course_codes(sections["corequisite_text"]),
    }


def extract_course_groups(rule_value: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not isinstance(rule_value, dict):
        return []

    groups = []
    for entry in rule_value.get("values", []):
        course_ids = [course_id for course_id in entry.get("value", []) if course_id]
        if not course_ids:
            continue

        groups.append(
            {
                "logic": entry.get("logic", "or"),
                "courseGroupIds": course_ids,
            }
        )
    return groups


def build_requirement_blocks(program: dict[str, Any]) -> list[dict[str, Any]]:
    requisites = (((program or {}).get("requisites") or {}).get("requisitesSimple")) or []
    blocks = []

    for requirement in requisites:
        if requirement.get("name") not in REQUIREMENT_NAMES.values():
            continue

        groups = []
        notes = []
        for rule in requirement.get("rules", []):
            groups.extend(extract_course_groups(rule.get("value")))
            if rule.get("notes"):
                notes.append(rule["notes"])

        blocks.append(
            {
                "id": requirement.get("id"),
                "name": requirement.get("name"),
                "type": requirement.get("type"),
                "credits": next(
                    (rule.get("credits") for rule in requirement.get("rules", []) if isinstance(rule.get("credits"), int)),
                    None,
                ),
                "notes": notes,
                "groups": groups,
            }
        )

    return blocks


def build_category_lookup(required_ids: list[str], elective_ids: list[str]):
    required_set = set(required_ids)
    elective_set = set(elective_ids)

    def categorize(course: dict[str, Any]) -> str:
        if course.get("courseGroupId") in elective_set:
            return "elective"
        if course.get("subjectCode") in {"MATH", "STAT"}:
            return "math"
        if course.get("courseGroupId") in required_set:
            return "core"
        return "other"

    return categorize


def course_payload_to_record(course: dict[str, Any], url: str, category: str, requisites: dict[str, Any]) -> dict[str, Any]:
    code = normalize_code(course["subjectCode"], course["courseNumber"])
    override = COURSE_OVERRIDES.get(code, {})

    return {
        "code": code,
        "name": normalize_text(override.get("name", course.get("longName") or course.get("name"))),
        "credits": override.get("credits", (((course.get("credits") or {}).get("numberOfCredits")))),
        "prerequisites": override.get("prerequisites", requisites["prerequisites"]),
        "corequisites": override.get("corequisites", requisites["corequisites"]),
        "prerequisiteText": override.get("prerequisiteText", requisites["prerequisite_text"]),
        "corequisiteText": override.get("corequisiteText", requisites["corequisite_text"]),
        "requisitesText": override.get("requisitesText", requisites["requisites_text"]),
        "semestersOffered": override.get("semestersOffered", normalize_semesters(course.get("courseTypicallyOffered"))),
        "category": override.get("category", category),
        "description": normalize_text(override.get("description", course.get("description"))),
        "difficulty": override.get("difficulty", infer_difficulty(course.get("courseNumber", ""))),
        "subject": course.get("subjectCode"),
        "courseNumber": course.get("courseNumber"),
        "sourceUrl": url,
        "courseGroupId": course.get("courseGroupId"),
        "requirementGroupId": course.get("requirementGroup"),
        "consent": normalize_text(course.get("consent")),
    }


def wait_for_program_payload(page: Page) -> None:
    page.wait_for_function(
        "() => !!(window.__NUXT__ && window.__NUXT__.data && window.__NUXT__.data[0] && window.__NUXT__.data[0].program)",
        timeout=60_000,
    )


def wait_for_course_payload(page: Page) -> None:
    page.wait_for_function(
        "() => !!(window.__NUXT__ && window.__NUXT__.data && window.__NUXT__.data[0] && window.__NUXT__.data[0].course)",
        timeout=60_000,
    )


def wait_for_rendered_requisites(page: Page) -> None:
    page.wait_for_function(
        """() => {
            const heading = Array.from(document.querySelectorAll('h2')).find(
              (el) => el.textContent.trim() === 'Requisites'
            );
            if (!heading || !heading.parentElement) return true;
            const text = (heading.parentElement.innerText || '').trim();
            if (!text || text === 'Requisites') return false;
            if (/^Requisites\\s+\\d+$/.test(text)) return false;
            return true;
        }""",
        timeout=60_000,
    )


def fetch_program(page: Page, url: str) -> dict[str, Any]:
    page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    wait_for_program_payload(page)
    return page.evaluate(PROGRAM_PAGE_SCRIPT)


def fetch_course(page: Page, url: str) -> dict[str, Any]:
    page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    wait_for_course_payload(page)
    wait_for_rendered_requisites(page)
    snapshot = page.evaluate(COURSE_PAGE_SCRIPT)
    sections = snapshot.get("sections", {})
    requisites_text = normalize_text(sections.get("Requisites", ""))
    return {
        "course": snapshot.get("course"),
        "requisites": parse_requisites(requisites_text),
    }


def enrich_requirement_blocks(blocks: list[dict[str, Any]], courses_by_id: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    enriched = []
    for block in blocks:
        groups = []
        for group in block["groups"]:
            groups.append(
                {
                    **group,
                    "courseCodes": [
                        courses_by_id[course_group_id]["code"]
                        for course_group_id in group["courseGroupIds"]
                        if course_group_id in courses_by_id
                    ],
                }
            )
        enriched.append({**block, "groups": groups})
    return enriched


def main() -> None:
    output_path = Path(PROGRAM["output_path"]).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()

        program = fetch_program(page, PROGRAM["program_url"])
        blocks = build_requirement_blocks(program)
        required_course_group_ids = uniq(
            [
                course_group_id
                for block in blocks
                for group in block["groups"]
                for course_group_id in group["courseGroupIds"]
            ]
        )
        elective_course_group_ids = uniq([get_course_group_id_from_url(url) for url in ELECTIVE_COURSE_URLS])
        course_urls = uniq(
            [f"{BASE_URL}/courses/{course_group_id}" for course_group_id in required_course_group_ids] + ELECTIVE_COURSE_URLS
        )

        fetched_courses = []
        for url in course_urls:
            fetched_courses.append((url, fetch_course(page, url)))

        browser.close()

    categorize = build_category_lookup(required_course_group_ids, elective_course_group_ids)

    normalized_courses = []
    for url, snapshot in fetched_courses:
        course = snapshot["course"]
        requisites = snapshot["requisites"]
        normalized_courses.append(
            course_payload_to_record(
                course=course,
                url=url,
                category=categorize(course),
                requisites=requisites,
            )
        )

    normalized_courses.sort(key=lambda item: item["code"])
    courses_by_id = {course["courseGroupId"]: course for course in normalized_courses}

    output = {
        "scrapedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "college": PROGRAM["college"],
            "major": PROGRAM["major"],
            "programUrl": PROGRAM["program_url"],
            "implementation": "Python + Playwright",
        },
        "program": {
            "planCode": program.get("code"),
            "longName": program.get("longName"),
            "degreeDesignation": program.get("degreeDesignation"),
            "creditsRequired": next(
                (block["credits"] for block in blocks if block["name"] == REQUIREMENT_NAMES["overall"]),
                None,
            ),
        },
        "requirementBlocks": enrich_requirement_blocks(blocks, courses_by_id),
        "courses": normalized_courses,
    }

    output_path.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(normalized_courses)} courses to {output_path}")


if __name__ == "__main__":
    main()
