const { chromium } = require('playwright');
const fs = require('fs');

const START_URL = 'https://globalsearch.cuny.edu/';
const log = (...args) => console.error(...args);

const DEFAULT_SEARCH = {
  institutionValue: 'HTR01',
  institutionLabel: 'Hunter College',
  termText: '2026 Fall Term',
  subjectText: 'Computer Science',
  subjectValue: 'CMSC',
  courseCareerText: 'Undergraduate',
  courseCareerValue: 'UGRD',
  openClassesOnly: false,
  headless: true,
  outputPath: 'courses.json',
  stdout: false,

  // Optional extra criteria. Leave blank/empty when not needed.
  sessionText: '',
  modesOfInstruction: [],
  daysOfWeek: [],
  instructorLastName: '',
};

function readArgs(argv) {
  const search = { ...DEFAULT_SEARCH };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index];

    if (arg === '--term') {
      const term = next();
      if (/^\d+$/.test(term)) {
        search.termValue = term;
        search.termText = term;
      } else {
        search.termText = term;
      }
    } else if (arg === '--subject') {
      const subject = next();
      if (/^(cs|csci|cmsc)$/i.test(subject)) {
        search.subjectText = 'Computer Science';
        search.subjectValue = 'CMSC';
      } else {
        search.subjectText = subject;
      }
    } else if (arg === '--subject-value') {
      search.subjectValue = next();
    } else if (arg === '--career') {
      search.courseCareerText = next();
      search.courseCareerValue = '';
    } else if (arg === '--career-value') {
      search.courseCareerValue = next();
    } else if (arg === '--all-careers') {
      search.courseCareerText = '';
      search.courseCareerValue = '';
    } else if (arg === '--institution') {
      search.institutionValue = next();
    } else if (arg === '--institution-label') {
      search.institutionLabel = next();
    } else if (arg === '--open-only') {
      search.openClassesOnly = true;
    } else if (arg === '--headed') {
      search.headless = false;
    } else if (arg === '--output') {
      search.outputPath = next();
    } else if (arg === '--stdout') {
      search.stdout = true;
    } else if (arg === '--no-file') {
      search.outputPath = '';
      search.stdout = true;
    } else if (arg === '--help') {
      process.stdout.write(`Usage: node scrape.js [options]\n\nOptions:\n  --term \"2026 Fall Term\"     Term text or numeric value, for example 1269\n  --subject \"Computer Science\" Subject text; cs/csci/cmsc maps to Computer Science\n  --subject-value CMSC       Fallback subject option value\n  --career \"Undergraduate\"   Course career text\n  --career-value UGRD        Fallback career option value\n  --all-careers              Do not select a course career\n  --institution HTR01        Institution checkbox value\n  --institution-label \"Hunter College\"\n  --open-only                Only include open sections\n  --headed                   Show the browser\n  --output courses.json      Write formatted JSON to this file\n  --stdout                   Also print JSON to stdout\n  --no-file                  Only print JSON to stdout\n`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return search;
}

async function selectByText(page, selector, text, fallbackValue = '') {
  const options = await page.$$eval(`${selector} option`, opts =>
    opts.map(option => ({
      value: option.value,
      text: option.textContent.trim().replace(/\s+/g, ' '),
    }))
  );

  const normalizedText = text.toLowerCase();
  const option = options.find(item => item.value === text)
    || options.find(item => item.text.toLowerCase() === normalizedText)
    || options.find(item => item.text.toLowerCase().includes(normalizedText))
    || options.find(item => item.value === fallbackValue);

  if (!option || !option.value) {
    throw new Error(`Could not find option "${text}" in ${selector}`);
  }

  await page.selectOption(selector, option.value);
  return option;
}

async function submitAndWait(page, buttonSelector) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.locator(buttonSelector).click(),
  ]);
}

async function setCheckbox(page, selector, checked = true) {
  const changed = await page.locator(selector).evaluate((checkbox, nextChecked) => {
    checkbox.checked = nextChecked;
    checkbox.dispatchEvent(new Event('input', { bubbles: true }));
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    return checkbox.checked;
  }, checked);

  if (changed !== checked) {
    throw new Error(`Could not set checkbox ${selector}`);
  }
}

async function chooseFirstPageCriteria(page, search) {
  await page.goto(START_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('form[name="searchform"]');

  const term = await selectByText(page, '#t_pd', search.termText, search.termValue);
  search.selectedTermText = term.text;
  search.selectedTermValue = term.value;
  log(`Selected term: ${term.text} (${term.value})`);

  const institution = page.locator(`input[name="inst_selection"][value="${search.institutionValue}"]`);
  if (await institution.count()) {
    await setCheckbox(page, `input[name="inst_selection"][value="${search.institutionValue}"]`);
  } else {
    await page.getByLabel(search.institutionLabel).check();
  }
  log(`Selected institution: ${search.institutionLabel}`);

  await submitAndWait(page, 'input[name="next_btn"]');
}

async function chooseCriteriaPage(page, search) {
  await page.waitForSelector('form[name="class_search_form"]');

  const subject = await selectByText(page, '#subject_ld', search.subjectText, search.subjectValue);
  search.selectedSubjectText = subject.text;
  search.selectedSubjectValue = subject.value;
  log(`Selected subject: ${subject.text} (${subject.value})`);

  if (search.courseCareerText || search.courseCareerValue) {
    const career = await selectByText(
      page,
      '#courseCareerId',
      search.courseCareerText || search.courseCareerValue,
      search.courseCareerValue
    );
    search.selectedCourseCareerText = career.text;
    search.selectedCourseCareerValue = career.value;
    log(`Selected course career: ${career.text} (${career.value})`);
  }

  await setCheckbox(page, '#open_class_id', search.openClassesOnly);
  log(`Open classes only: ${search.openClassesOnly ? 'yes' : 'no'}`);

  if (search.sessionText) {
    const session = await selectByText(page, '#sessionId', search.sessionText);
    log(`Selected session: ${session.text} (${session.value})`);
  }

  for (const mode of search.modesOfInstruction) {
    const checkbox = page.locator(`input[name="ModeOfIns"][value="${mode}"]`);
    if (await checkbox.count()) {
      await setCheckbox(page, `input[name="ModeOfIns"][value="${mode}"]`);
    }
  }

  for (const day of search.daysOfWeek) {
    const checkbox = page.locator(`input[name="daysOfWeekCheck"][value="${day}"]`);
    if (await checkbox.count()) {
      await setCheckbox(page, `input[name="daysOfWeekCheck"][value="${day}"]`);
    }
  }

  if (search.instructorLastName) {
    await page.fill('#instructorNameId', search.instructorLastName);
  }

  await submitAndWait(page, 'input[name="search_btn_search"]');
}

function cleanText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

async function scrapeResults(page) {
  await page.waitForLoadState('domcontentloaded');

  return page.evaluate(() => {
    const clean = value => value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const courseSections = [];

    for (const span of document.querySelectorAll('.testing_msg span')) {
      const heading = clean(span.innerText);
      const courseMatch = heading.match(/\b([A-Z]{2,5})\s+([0-9]{3,5}[A-Z]?)\s*-\s*(.+)$/);

      if (!courseMatch) {
        continue;
      }

      const toggleLink = span.querySelector('a[href*="subjectToggle"]');
      const contentId = toggleLink?.getAttribute('href')?.match(/subjectToggle\('([^']+)'/)?.[1];
      const content = contentId ? document.getElementById(contentId) : span.closest('.testing_msg')?.nextElementSibling;

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
  });
}

function getRequirements(enrollmentRequirements) {
  const text = cleanText(enrollmentRequirements);
  const prereq = text.match(/Prerequisites?:\s*(.*?)(?=\s+(?:Co-?requisites?|Corequisites?|Pre-?\/?Co-?requisites?):|$)/i);
  const coreq = text.match(/(?:Co-?requisites?|Corequisites?):\s*(.*?)(?=\s+Prerequisites?:|$)/i);
  const preOrCoreq = text.match(/(?:Pre-?\/?Co-?requisites?|Prerequisites?\s+or\s+Corequisites?):\s*(.*)$/i);

  return {
    prerequisites: cleanText(prereq?.[1] || ''),
    corequisites: cleanText(coreq?.[1] || ''),
    preOrCorequisites: cleanText(preOrCoreq?.[1] || ''),
  };
}

function splitListField(value) {
  const text = cleanText(value);
  return text ? text.split(/\s*;\s*|\s*\|\s*/).map(cleanText).filter(Boolean) : [];
}

function unique(values) {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function slug(value) {
  return cleanText(value).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildCourseId(search, section) {
  return [
    search.institutionValue,
    search.selectedTermValue || search.termValue || search.termText,
    section.subject,
    section.number,
    section.title,
  ].map(slug).filter(Boolean).join('-');
}

function buildSectionId(search, section) {
  return [
    search.institutionValue,
    search.selectedTermValue || search.termValue || search.termText,
    section.classNumber,
  ].map(slug).filter(Boolean).join('-');
}

function buildCourseExports(sections) {
  const grouped = new Map();

  for (const section of sections) {
    if (!grouped.has(section.courseId)) {
      grouped.set(section.courseId, []);
    }

    grouped.get(section.courseId).push(section);
  }

  return [...grouped.entries()].map(([courseId, courseSections]) => {
    const first = courseSections[0];

    return {
      courseId,
      subject: first.subject,
      courseNumber: first.courseNumber,
      code: first.courseCode,
      title: first.title,
      term: first.term,
      termValue: first.termValue,
      institution: first.institution,
      institutionValue: first.institutionValue,
      courseCareer: first.career || first.courseCareer,
      units: unique(courseSections.map(section => section.units)).join('; '),
      classComponents: unique(courseSections.map(section => section.classComponents)).join('; '),
      grading: unique(courseSections.map(section => section.grading)).join('; '),
      prerequisites: unique(courseSections.map(section => section.prerequisites)).join('; '),
      corequisites: unique(courseSections.map(section => section.corequisites)).join('; '),
      preOrCorequisites: unique(courseSections.map(section => section.preOrCorequisites)).join('; '),
      enrollmentRequirements: unique(courseSections.map(section => section.enrollmentRequirements)).join('; '),
      requirementDesignations: unique(courseSections.map(section => section.requirementDesignation)),
      classAttributes: unique(courseSections.flatMap(section => section.classAttributes)),
      descriptions: unique(courseSections.map(section => section.description)),
      statuses: unique(courseSections.map(section => section.status)),
      sectionCount: courseSections.length,
      sectionIds: courseSections.map(section => section.sectionId),
      classNumbers: courseSections.map(section => section.classNumber),
    };
  });
}

async function scrapeDetailPage(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });

  return page.evaluate(() => {
    const clean = value => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const lines = document.body.innerText
      .split(/\n+/)
      .map(clean)
      .filter(Boolean);

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
  });
}

async function enrichSectionsWithDetails(page, sections, search) {
  const enrichedSections = [];

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];

    if (!section.detailsUrl) {
      enrichedSections.push(section);
      continue;
    }

    log(`Reading section details ${index + 1}/${sections.length}: ${section.subject} ${section.number} ${section.section}`);
    const details = await scrapeDetailPage(page, section.detailsUrl);
    const requirements = getRequirements(details.enrollmentRequirements);
    const courseId = buildCourseId(search, section);
    const sectionId = buildSectionId(search, section);

    enrichedSections.push({
      sectionId,
      courseId,
      institution: search.institutionLabel,
      institutionValue: search.institutionValue,
      term: search.selectedTermText || search.termText,
      termValue: search.selectedTermValue || search.termValue || '',
      subject: section.subject,
      courseNumber: section.number,
      courseCode: `${section.subject} ${section.number}`,
      title: section.title,
      classNumber: details.classNumber || section.classNumber,
      section: section.section,
      status: details.status || section.status,
      session: details.session,
      units: details.units,
      instructionMode: details.instructionMode,
      classComponents: details.classComponents,
      career: details.career,
      courseCareer: search.selectedCourseCareerText || search.courseCareerText,
      dates: details.dates,
      grading: details.grading,
      location: details.location,
      campus: details.campus,
      daysAndTimes: section.daysAndTimes,
      room: section.room,
      instructor: section.instructor,
      meetingDates: section.meetingDates,
      meetings: details.meetings,
      enrollmentRequirements: details.enrollmentRequirements,
      prerequisites: requirements.prerequisites,
      corequisites: requirements.corequisites,
      preOrCorequisites: requirements.preOrCorequisites,
      requirementDesignation: details.requirementDesignation,
      classAttributes: splitListField(details.classAttributes),
      availability: details.availability,
      classNotes: details.classNotes,
      description: details.description,
      courseTopic: section.courseTopic,
      detailsUrl: section.detailsUrl,
    });
  }

  return enrichedSections;
}

function buildExportPayload(search, courses, sections) {
  return {
    metadata: {
      schemaVersion: 1,
      source: 'CUNY Global Search',
      sourceUrl: START_URL,
      scrapedAt: new Date().toISOString(),
      search: {
        institution: search.institutionLabel,
        institutionValue: search.institutionValue,
        term: search.selectedTermText || search.termText,
        termValue: search.selectedTermValue || search.termValue || '',
        subject: search.selectedSubjectText || search.subjectText,
        subjectValue: search.selectedSubjectValue || search.subjectValue,
        courseCareer: search.selectedCourseCareerText || search.courseCareerText,
        courseCareerValue: search.selectedCourseCareerValue || search.courseCareerValue || '',
        openClassesOnly: search.openClassesOnly,
      },
      counts: {
        courses: courses.length,
        sections: sections.length,
      },
    },
    courses,
    sections,
  };
}

(async () => {
  const search = readArgs(process.argv.slice(2));
  const browser = await chromium.launch({ headless: search.headless });
  const page = await browser.newPage();

  try {
    log('Opening Global Search...');
    await chooseFirstPageCriteria(page, search);
    log('On criteria page:', page.url());

    await chooseCriteriaPage(page, search);
    log('On results page:', page.url());

    const resultSections = await scrapeResults(page);
    log(`Sections found: ${resultSections.length}`);

    const sections = await enrichSectionsWithDetails(page, resultSections, search);
    const courses = buildCourseExports(sections);
    log(`Unique courses found: ${courses.length}`);

    const payload = buildExportPayload(search, courses, sections);
    const json = `${JSON.stringify(payload, null, 2)}\n`;

    if (search.outputPath) {
      fs.writeFileSync(search.outputPath, json);
      log(`Saved ${search.outputPath}`);
    }

    if (search.stdout) {
      process.stdout.write(json);
    }
  } finally {
    await browser.close();
  }
})();
