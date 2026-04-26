import argparse
import json
import re
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

START_URL = "https://globalsearch.cuny.edu/"

DEFAULT_SEARCH = {
    "institutionValue": "HTR01",
    "institutionLabel": "Hunter College",
    "termText": "2026 Fall Term",
    "subjectText": "Computer Science",
    "subjectValue": "CMSC",
    "courseCareerText": "Undergraduate",
    "courseCareerValue": "UGRD",
    "openClassesOnly": False,
    "headless": True,
    "outputPath": "courses.json",
    "stdout": False,
    "sessionText": "",
    "modesOfInstruction": [],
    "daysOfWeek": [],
    "instructorLastName": "",
}


def log(*args):
    print(*args, file=sys.stderr)


def clean_text(value):
    return re.sub(r"\s+", " ", str(value or "").replace("\u00a0", " ")).strip()


def read_args(argv):
    parser = argparse.ArgumentParser(
        description="Scrape CUNY Global Search and export database-friendly JSON."
    )
    parser.add_argument("--term", help='Term text or numeric value, for example "2026 Fall Term" or 1269')
    parser.add_argument("--subject", help='Subject text; "cs", "csci", or "cmsc" maps to Computer Science')
    parser.add_argument("--subject-value", help="Fallback subject option value")
    parser.add_argument("--career", help='Course career text, for example "Undergraduate"')
    parser.add_argument("--career-value", help="Fallback course career option value")
    parser.add_argument("--all-careers", action="store_true", help="Do not select a course career")
    parser.add_argument("--institution", help="Institution checkbox value, for example HTR01")
    parser.add_argument("--institution-label", help='Institution display label, for example "Hunter College"')
    parser.add_argument("--open-only", action="store_true", help="Only include open sections")
    parser.add_argument("--headed", action="store_true", help="Show the browser")
    parser.add_argument("--output", help="Write formatted JSON to this file")
    parser.add_argument("--stdout", action="store_true", help="Also print JSON to stdout")
    parser.add_argument("--no-file", action="store_true", help="Only print JSON to stdout")

    args = parser.parse_args(argv)
    search = deepcopy(DEFAULT_SEARCH)

    if args.term:
        search["termText"] = args.term
        if re.fullmatch(r"\d+", args.term):
            search["termValue"] = args.term

    if args.subject:
        if re.fullmatch(r"(cs|csci|cmsc)", args.subject, flags=re.IGNORECASE):
            search["subjectText"] = "Computer Science"
            search["subjectValue"] = "CMSC"
        else:
            search["subjectText"] = args.subject

    if args.subject_value:
        search["subjectValue"] = args.subject_value

    if args.career:
        search["courseCareerText"] = args.career
        search["courseCareerValue"] = ""

    if args.career_value:
        search["courseCareerValue"] = args.career_value

    if args.all_careers:
        search["courseCareerText"] = ""
        search["courseCareerValue"] = ""

    if args.institution:
        search["institutionValue"] = args.institution

    if args.institution_label:
        search["institutionLabel"] = args.institution_label

    if args.open_only:
        search["openClassesOnly"] = True

    if args.headed:
        search["headless"] = False

    if args.output:
        search["outputPath"] = args.output

    if args.stdout:
        search["stdout"] = True

    if args.no_file:
        search["outputPath"] = ""
        search["stdout"] = True

    return search


def select_by_text(page, selector, text, fallback_value=""):
    options = page.eval_on_selector_all(
        f"{selector} option",
        """options => options.map(option => ({
            value: option.value,
            text: option.textContent.trim().replace(/\\s+/g, ' '),
        }))""",
    )

    normalized_text = (text or "").lower()
    option = None

    for item in options:
        if item["value"] == text:
            option = item
            break

    if option is None:
        for item in options:
            if item["text"].lower() == normalized_text:
                option = item
                break

    if option is None:
        for item in options:
            if normalized_text and normalized_text in item["text"].lower():
                option = item
                break

    if option is None:
        for item in options:
            if item["value"] == fallback_value:
                option = item
                break

    if not option or not option["value"]:
        raise RuntimeError(f'Could not find option "{text}" in {selector}')

    page.select_option(selector, option["value"])
    return option


def submit_and_wait(page, button_selector):
    with page.expect_navigation(wait_until="networkidle"):
        page.locator(button_selector).click()


def set_checkbox(page, selector, checked=True):
    changed = page.locator(selector).evaluate(
        """(checkbox, nextChecked) => {
            checkbox.checked = nextChecked;
            checkbox.dispatchEvent(new Event('input', { bubbles: true }));
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            return checkbox.checked;
        }""",
        checked,
    )

    if changed != checked:
        raise RuntimeError(f"Could not set checkbox {selector}")


def choose_first_page_criteria(page, search):
    page.goto(START_URL, wait_until="domcontentloaded")
    page.wait_for_selector('form[name="searchform"]')

    term = select_by_text(page, "#t_pd", search["termText"], search.get("termValue", ""))
    search["selectedTermText"] = term["text"]
    search["selectedTermValue"] = term["value"]
    log(f"Selected term: {term['text']} ({term['value']})")

    selector = f'input[name="inst_selection"][value="{search["institutionValue"]}"]'
    if page.locator(selector).count():
        set_checkbox(page, selector)
    else:
        page.get_by_label(search["institutionLabel"]).check()

    log(f"Selected institution: {search['institutionLabel']}")
    submit_and_wait(page, 'input[name="next_btn"]')


def choose_criteria_page(page, search):
    page.wait_for_selector('form[name="class_search_form"]')

    subject = select_by_text(page, "#subject_ld", search["subjectText"], search["subjectValue"])
    search["selectedSubjectText"] = subject["text"]
    search["selectedSubjectValue"] = subject["value"]
    log(f"Selected subject: {subject['text']} ({subject['value']})")

    if search["courseCareerText"] or search["courseCareerValue"]:
        career = select_by_text(
            page,
            "#courseCareerId",
            search["courseCareerText"] or search["courseCareerValue"],
            search["courseCareerValue"],
        )
        search["selectedCourseCareerText"] = career["text"]
        search["selectedCourseCareerValue"] = career["value"]
        log(f"Selected course career: {career['text']} ({career['value']})")

    set_checkbox(page, "#open_class_id", search["openClassesOnly"])
    log(f"Open classes only: {'yes' if search['openClassesOnly'] else 'no'}")

    if search["sessionText"]:
        session = select_by_text(page, "#sessionId", search["sessionText"])
        log(f"Selected session: {session['text']} ({session['value']})")

    for mode in search["modesOfInstruction"]:
        selector = f'input[name="ModeOfIns"][value="{mode}"]'
        if page.locator(selector).count():
            set_checkbox(page, selector)

    for day in search["daysOfWeek"]:
        selector = f'input[name="daysOfWeekCheck"][value="{day}"]'
        if page.locator(selector).count():
            set_checkbox(page, selector)

    if search["instructorLastName"]:
        page.fill("#instructorNameId", search["instructorLastName"])

    submit_and_wait(page, 'input[name="search_btn_search"]')


def scrape_results(page):
    page.wait_for_load_state("domcontentloaded")

    return page.evaluate(
        """() => {
            const clean = value => String(value || '').replace(/\\u00a0/g, ' ').replace(/\\s+/g, ' ').trim();
            const courseSections = [];

            for (const span of document.querySelectorAll('.testing_msg span')) {
                const heading = clean(span.innerText);
                const courseMatch = heading.match(/\\b([A-Z]{2,5})\\s+([0-9]{3,5}[A-Z]?)\\s*-\\s*(.+)$/);

                if (!courseMatch) {
                    continue;
                }

                const toggleLink = span.querySelector('a[href*="subjectToggle"]');
                const contentId = toggleLink?.getAttribute('href')?.match(/subjectToggle\\('([^']+)'/)?.[1];
                const content = contentId
                    ? document.getElementById(contentId)
                    : span.closest('.testing_msg')?.nextElementSibling;

                for (const row of content?.querySelectorAll('table.classinfo tbody tr') || []) {
                    const cell = label => clean(row.querySelector(`td[data-label="${label}"]`)?.innerText || '');
                    const statusImage = row.querySelector('td[data-label="Status"] img');
                    const classLink = row.querySelector('td[data-label="Class"] a');

                    courseSections.push({
                        subject: courseMatch[1],
                        number: courseMatch[2],
                        title: clean(courseMatch[3]),
                        classNumber: cell('Class'),
                        section: cell('Section'),
                        daysAndTimes: cell('DaysAndTimes'),
                        room: cell('Room'),
                        instructor: cell('Instructor'),
                        meetingDates: cell('Meeting Dates'),
                        status: statusImage?.getAttribute('title') || statusImage?.getAttribute('alt') || cell('Status'),
                        courseTopic: cell('Course Topic'),
                        detailsUrl: classLink ? new URL(classLink.getAttribute('href'), location.href).href : '',
                    });
                }
            }

            return courseSections;
        }"""
    )


def get_requirements(enrollment_requirements):
    text = clean_text(enrollment_requirements)
    prereq = re.search(
        r"Prerequisites?:\s*(.*?)(?=\s+(?:Co-?requisites?|Corequisites?|Pre-?/?Co-?requisites?):|$)",
        text,
        flags=re.IGNORECASE,
    )
    coreq = re.search(
        r"(?:Co-?requisites?|Corequisites?):\s*(.*?)(?=\s+Prerequisites?:|$)",
        text,
        flags=re.IGNORECASE,
    )
    pre_or_coreq = re.search(
        r"(?:Pre-?/?Co-?requisites?|Prerequisites?\s+or\s+Corequisites?):\s*(.*)$",
        text,
        flags=re.IGNORECASE,
    )

    return {
        "prerequisites": clean_text(prereq.group(1) if prereq else ""),
        "corequisites": clean_text(coreq.group(1) if coreq else ""),
        "preOrCorequisites": clean_text(pre_or_coreq.group(1) if pre_or_coreq else ""),
    }


def split_list_field(value):
    text = clean_text(value)
    return [clean_text(item) for item in re.split(r"\s*;\s*|\s*\|\s*", text) if clean_text(item)] if text else []


def unique(values):
    result = []
    seen = set()

    for value in values:
        text = clean_text(value)
        if text and text not in seen:
            result.append(text)
            seen.add(text)

    return result


def slug(value):
    return re.sub(r"^-|-?$", "", re.sub(r"[^A-Za-z0-9]+", "-", clean_text(value))).strip("-")


def build_course_id(search, section):
    parts = [
        search["institutionValue"],
        search.get("selectedTermValue") or search.get("termValue") or search["termText"],
        section["subject"],
        section["number"],
        section["title"],
    ]
    return "-".join(slug(part) for part in parts if slug(part))


def build_section_id(search, section):
    parts = [
        search["institutionValue"],
        search.get("selectedTermValue") or search.get("termValue") or search["termText"],
        section["classNumber"],
    ]
    return "-".join(slug(part) for part in parts if slug(part))


def build_course_exports(sections):
    grouped = {}
    for section in sections:
        grouped.setdefault(section["courseId"], []).append(section)

    courses = []
    for course_id, course_sections in grouped.items():
        first = course_sections[0]
        courses.append(
            {
                "courseId": course_id,
                "subject": first["subject"],
                "courseNumber": first["courseNumber"],
                "code": first["courseCode"],
                "title": first["title"],
                "term": first["term"],
                "termValue": first["termValue"],
                "institution": first["institution"],
                "institutionValue": first["institutionValue"],
                "courseCareer": first["career"] or first["courseCareer"],
                "units": "; ".join(unique(section.get("units") for section in course_sections)),
                "classComponents": "; ".join(unique(section.get("classComponents") for section in course_sections)),
                "grading": "; ".join(unique(section.get("grading") for section in course_sections)),
                "prerequisites": "; ".join(unique(section.get("prerequisites") for section in course_sections)),
                "corequisites": "; ".join(unique(section.get("corequisites") for section in course_sections)),
                "preOrCorequisites": "; ".join(unique(section.get("preOrCorequisites") for section in course_sections)),
                "enrollmentRequirements": "; ".join(
                    unique(section.get("enrollmentRequirements") for section in course_sections)
                ),
                "requirementDesignations": unique(
                    section.get("requirementDesignation") for section in course_sections
                ),
                "classAttributes": unique(
                    attribute
                    for section in course_sections
                    for attribute in section.get("classAttributes", [])
                ),
                "descriptions": unique(section.get("description") for section in course_sections),
                "statuses": unique(section.get("status") for section in course_sections),
                "sectionCount": len(course_sections),
                "sectionIds": [section["sectionId"] for section in course_sections],
                "classNumbers": [section["classNumber"] for section in course_sections],
            }
        )

    return courses


def scrape_detail_page(page, url):
    page.goto(url, wait_until="networkidle")

    return page.evaluate(
        """() => {
            const clean = value => String(value || '').replace(/\\u00a0/g, ' ').replace(/\\s+/g, ' ').trim();
            const lines = document.body.innerText.split(/\\n+/).map(clean).filter(Boolean);
            const pick = label => {
                const index = lines.findIndex(line => line.toLowerCase() === label.toLowerCase());
                return index >= 0 ? clean(lines[index + 1]) : '';
            };

            const enrollment = {};
            for (const row of document.querySelectorAll('table tr')) {
                const cells = [...row.querySelectorAll('th,td')].map(cell => clean(cell.innerText)).filter(Boolean);
                if (cells.length === 2) {
                    enrollment[cells[0]] = cells[1];
                }
            }

            const availability = {};
            const tableRows = [...document.querySelectorAll('table tr')]
                .map(row => [...row.querySelectorAll('th,td')].map(cell => clean(cell.innerText)).filter(Boolean));

            for (let index = 0; index < tableRows.length; index += 1) {
                const cells = tableRows[index];
                const nextCells = tableRows[index + 1] || [];

                if (cells.includes('Class Capacity')) {
                    availability.classCapacity = nextCells[0] || '';
                    availability.waitListCapacity = nextCells[1] || '';
                }

                if (cells.includes('Enrollment Total')) {
                    availability.enrollmentTotal = nextCells[0] || '';
                    availability.waitListTotal = nextCells[1] || '';
                }

                if (cells.includes('Available Seats')) {
                    availability.availableSeats = nextCells[0] || '';
                }
            }

            const meetings = [...document.querySelectorAll('table.classinfo tbody tr')].map(row => {
                const cells = [...row.querySelectorAll('td')].map(cell => clean(cell.innerText));
                return {
                    daysAndTimes: cells[0] || '',
                    room: cells[1] || '',
                    instructor: cells[2] || '',
                    meetingDates: cells[3] || '',
                };
            });

            const descriptionTable = [...document.querySelectorAll('table')].at(-1);
            const description = clean(descriptionTable?.innerText || pick('Description'));

            return {
                heading: lines[0] || '',
                status: pick('Status'),
                classNumber: pick('Class Number'),
                session: pick('Session'),
                units: pick('Units'),
                instructionMode: pick('Instruction Mode'),
                classComponents: pick('Class Components'),
                career: pick('Career'),
                dates: pick('Dates'),
                grading: pick('Grading'),
                location: pick('Location'),
                campus: pick('Campus'),
                meetings,
                enrollmentRequirements: enrollment['Enrollment Requirements'] || pick('Enrollment Requirements'),
                requirementDesignation: enrollment['Requirement Designation'] || pick('Requirement Designation'),
                classAttributes: enrollment['Class Attributes'] || pick('Class Attributes'),
                availability,
                classNotes: pick('Class Notes'),
                description,
            };
        }"""
    )


def enrich_sections_with_details(page, sections, search):
    enriched_sections = []

    for index, section in enumerate(sections, start=1):
        if not section.get("detailsUrl"):
            enriched_sections.append(section)
            continue

        log(
            f"Reading section details {index}/{len(sections)}: "
            f"{section['subject']} {section['number']} {section['section']}"
        )
        details = scrape_detail_page(page, section["detailsUrl"])
        requirements = get_requirements(details.get("enrollmentRequirements", ""))
        course_id = build_course_id(search, section)
        section_id = build_section_id(search, section)

        enriched_sections.append(
            {
                "sectionId": section_id,
                "courseId": course_id,
                "institution": search["institutionLabel"],
                "institutionValue": search["institutionValue"],
                "term": search.get("selectedTermText") or search["termText"],
                "termValue": search.get("selectedTermValue") or search.get("termValue", ""),
                "subject": section["subject"],
                "courseNumber": section["number"],
                "courseCode": f"{section['subject']} {section['number']}",
                "title": section["title"],
                "classNumber": details.get("classNumber") or section["classNumber"],
                "section": section["section"],
                "status": details.get("status") or section["status"],
                "session": details.get("session", ""),
                "units": details.get("units", ""),
                "instructionMode": details.get("instructionMode", ""),
                "classComponents": details.get("classComponents", ""),
                "career": details.get("career", ""),
                "courseCareer": search.get("selectedCourseCareerText") or search["courseCareerText"],
                "dates": details.get("dates", ""),
                "grading": details.get("grading", ""),
                "location": details.get("location", ""),
                "campus": details.get("campus", ""),
                "daysAndTimes": section["daysAndTimes"],
                "room": section["room"],
                "instructor": section["instructor"],
                "meetingDates": section["meetingDates"],
                "meetings": details.get("meetings", []),
                "enrollmentRequirements": details.get("enrollmentRequirements", ""),
                "prerequisites": requirements["prerequisites"],
                "corequisites": requirements["corequisites"],
                "preOrCorequisites": requirements["preOrCorequisites"],
                "requirementDesignation": details.get("requirementDesignation", ""),
                "classAttributes": split_list_field(details.get("classAttributes", "")),
                "availability": details.get("availability", {}),
                "classNotes": details.get("classNotes", ""),
                "description": details.get("description", ""),
                "courseTopic": section["courseTopic"],
                "detailsUrl": section["detailsUrl"],
            }
        )

    return enriched_sections


def build_export_payload(search, courses, sections):
    return {
        "metadata": {
            "schemaVersion": 1,
            "source": "CUNY Global Search",
            "sourceUrl": START_URL,
            "scrapedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "search": {
                "institution": search["institutionLabel"],
                "institutionValue": search["institutionValue"],
                "term": search.get("selectedTermText") or search["termText"],
                "termValue": search.get("selectedTermValue") or search.get("termValue", ""),
                "subject": search.get("selectedSubjectText") or search["subjectText"],
                "subjectValue": search.get("selectedSubjectValue") or search["subjectValue"],
                "courseCareer": search.get("selectedCourseCareerText") or search["courseCareerText"],
                "courseCareerValue": search.get("selectedCourseCareerValue") or search["courseCareerValue"],
                "openClassesOnly": search["openClassesOnly"],
            },
            "counts": {
                "courses": len(courses),
                "sections": len(sections),
            },
        },
        "courses": courses,
        "sections": sections,
    }


def main(argv=None):
    search = read_args(argv or sys.argv[1:])

    try:
        from playwright.sync_api import sync_playwright
    except ModuleNotFoundError as exc:
        raise SystemExit(
            "Python Playwright is not installed. Run:\n"
            "  python -m pip install playwright\n"
            "  python -m playwright install chromium"
        ) from exc

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=search["headless"])
        page = browser.new_page()

        try:
            log("Opening Global Search...")
            choose_first_page_criteria(page, search)
            log("On criteria page:", page.url)

            choose_criteria_page(page, search)
            log("On results page:", page.url)

            result_sections = scrape_results(page)
            log(f"Sections found: {len(result_sections)}")

            sections = enrich_sections_with_details(page, result_sections, search)
            courses = build_course_exports(sections)
            log(f"Unique courses found: {len(courses)}")

            payload = build_export_payload(search, courses, sections)
            json_text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"

            if search["outputPath"]:
                Path(search["outputPath"]).write_text(json_text, encoding="utf-8")
                log(f"Saved {search['outputPath']}")

            if search["stdout"]:
                sys.stdout.write(json_text)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
