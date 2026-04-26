const fs = require('fs');
const path = require('path');

const DEFAULT_INPUT = 'courses.json';
const DEFAULT_OUTPUT = 'normalized-courses.json';

function cleanText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function emptyToNull(value) {
  const text = cleanText(value);
  return text ? text : null;
}

function toInt(value) {
  const text = cleanText(value);
  if (!text || /^TBA$/i.test(text)) {
    return null;
  }

  const number = Number.parseInt(text.replace(/[^\d-]/g, ''), 10);
  return Number.isNaN(number) ? null : number;
}

function slug(value) {
  return cleanText(value).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function uniquePush(map, key, row) {
  if (!key) {
    return;
  }

  if (!map.has(key)) {
    map.set(key, row);
  }
}

function parseDate(value) {
  const match = cleanText(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseDateRange(value) {
  const text = cleanText(value);
  const matches = [...text.matchAll(/(\d{1,2}\/\d{1,2}\/\d{4})/g)].map(match => match[1]);

  return {
    raw: text || null,
    startDate: parseDate(matches[0]),
    endDate: parseDate(matches[1]),
  };
}

function parseUnits(value) {
  const text = cleanText(value);
  const numbers = [...text.matchAll(/\d+(?:\.\d+)?/g)].map(match => Number(match[0]));

  return {
    raw: text || null,
    minUnits: numbers.length ? numbers[0] : null,
    maxUnits: numbers.length > 1 ? numbers[numbers.length - 1] : numbers[0] ?? null,
  };
}

function parseTime(value) {
  const match = cleanText(value).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();

  if (period === 'AM' && hour === 12) {
    hour = 0;
  } else if (period === 'PM' && hour !== 12) {
    hour += 12;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseDayTokens(value) {
  const text = cleanText(value);
  const days = [];
  const pattern = /(Mo|Tu|We|Th|Fr|Sa|Su)/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    days.push(match[1]);
  }

  return days;
}

function parseDaysAndTimes(value) {
  const text = cleanText(value);

  if (!text || /^TBA$/i.test(text)) {
    return {
      raw: text || null,
      daysRaw: null,
      days: [],
      startTime: null,
      endTime: null,
    };
  }

  const timeMatch = text.match(/^(.*?)\s+(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))$/i);

  if (!timeMatch) {
    return {
      raw: text,
      daysRaw: null,
      days: parseDayTokens(text),
      startTime: null,
      endTime: null,
    };
  }

  const daysRaw = cleanText(timeMatch[1]);

  return {
    raw: text,
    daysRaw,
    days: parseDayTokens(daysRaw),
    startTime: parseTime(timeMatch[2]),
    endTime: parseTime(timeMatch[3]),
  };
}

function parseSectionCode(section) {
  const text = cleanText(section);
  const [code, ...rest] = text.split(/\s+/);

  return {
    sectionCode: code || null,
    sectionType: rest.join(' ') || null,
  };
}

function parseTerm(term, termValue) {
  const text = cleanText(term);
  const match = text.match(/\b(20\d{2})\s+(.+?)\s+Term\b/i);

  return {
    termId: cleanText(termValue) || slug(text),
    termValue: cleanText(termValue) || null,
    name: text || null,
    year: match ? Number(match[1]) : null,
    season: match ? cleanText(match[2]) : null,
  };
}

function readArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    stdout: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index];

    if (arg === '--input') {
      args.input = next();
    } else if (arg === '--output') {
      args.output = next();
    } else if (arg === '--stdout') {
      args.stdout = true;
    } else if (arg === '--help') {
      process.stdout.write(`Usage: node normalize-courses.js [options]\n\nOptions:\n  --input courses.json                 Raw scraper export\n  --output normalized-courses.json     Normalized JSON output\n  --stdout                            Also print normalized JSON to stdout\n`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function normalize(raw) {
  const metadata = raw.metadata || {};
  const search = metadata.search || {};
  const term = parseTerm(search.term, search.termValue);
  const institutionId = cleanText(search.institutionValue) || slug(search.institution);
  const subjectId = cleanText(search.subjectValue) || slug(search.subject);

  const institutions = new Map();
  const terms = new Map();
  const subjects = new Map();
  const courses = new Map();
  const sections = new Map();
  const meetings = [];
  const availability = new Map();
  const requirementDesignations = new Map();
  const classAttributes = new Map();
  const sectionRequirementDesignations = [];
  const sectionClassAttributes = [];

  uniquePush(institutions, institutionId, {
    institutionId,
    name: emptyToNull(search.institution),
    sourceValue: emptyToNull(search.institutionValue),
  });

  uniquePush(terms, term.termId, term);

  uniquePush(subjects, subjectId, {
    subjectId,
    code: emptyToNull(search.subjectValue),
    name: emptyToNull(search.subject),
  });

  for (const rawCourse of raw.courses || []) {
    const units = parseUnits(rawCourse.units);

    courses.set(rawCourse.courseId, {
      courseId: rawCourse.courseId,
      institutionId,
      termId: term.termId,
      subjectId,
      subject: emptyToNull(rawCourse.subject),
      courseNumber: emptyToNull(rawCourse.courseNumber),
      code: emptyToNull(rawCourse.code),
      title: emptyToNull(rawCourse.title),
      career: emptyToNull(rawCourse.courseCareer),
      unitsRaw: units.raw,
      minUnits: units.minUnits,
      maxUnits: units.maxUnits,
      classComponents: emptyToNull(rawCourse.classComponents),
      grading: emptyToNull(rawCourse.grading),
      prerequisites: emptyToNull(rawCourse.prerequisites),
      corequisites: emptyToNull(rawCourse.corequisites),
      preOrCorequisites: emptyToNull(rawCourse.preOrCorequisites),
      enrollmentRequirements: emptyToNull(rawCourse.enrollmentRequirements),
      descriptions: rawCourse.descriptions || [],
      statuses: rawCourse.statuses || [],
      sectionCount: rawCourse.sectionCount || 0,
    });
  }

  for (const rawSection of raw.sections || []) {
    const sectionId = rawSection.sectionId;
    const courseId = rawSection.courseId;
    const units = parseUnits(rawSection.units);
    const sectionDates = parseDateRange(rawSection.dates);
    const sectionCode = parseSectionCode(rawSection.section);

    sections.set(sectionId, {
      sectionId,
      courseId,
      institutionId,
      termId: term.termId,
      subjectId,
      classNumber: emptyToNull(rawSection.classNumber),
      section: emptyToNull(rawSection.section),
      sectionCode: sectionCode.sectionCode,
      sectionType: sectionCode.sectionType,
      status: emptyToNull(rawSection.status),
      session: emptyToNull(rawSection.session),
      instructionMode: emptyToNull(rawSection.instructionMode),
      career: emptyToNull(rawSection.career || rawSection.courseCareer),
      unitsRaw: units.raw,
      minUnits: units.minUnits,
      maxUnits: units.maxUnits,
      classComponents: emptyToNull(rawSection.classComponents),
      grading: emptyToNull(rawSection.grading),
      location: emptyToNull(rawSection.location),
      campus: emptyToNull(rawSection.campus),
      datesRaw: sectionDates.raw,
      startDate: sectionDates.startDate,
      endDate: sectionDates.endDate,
      classNotes: emptyToNull(rawSection.classNotes),
      description: emptyToNull(rawSection.description),
      courseTopic: emptyToNull(rawSection.courseTopic),
      detailsUrl: emptyToNull(rawSection.detailsUrl),
      enrollmentRequirements: emptyToNull(rawSection.enrollmentRequirements),
      prerequisites: emptyToNull(rawSection.prerequisites),
      corequisites: emptyToNull(rawSection.corequisites),
      preOrCorequisites: emptyToNull(rawSection.preOrCorequisites),
    });

    availability.set(sectionId, {
      sectionId,
      classCapacity: toInt(rawSection.availability?.classCapacity),
      waitListCapacity: toInt(rawSection.availability?.waitListCapacity),
      enrollmentTotal: toInt(rawSection.availability?.enrollmentTotal),
      waitListTotal: toInt(rawSection.availability?.waitListTotal),
      availableSeats: toInt(rawSection.availability?.availableSeats),
    });

    if (rawSection.requirementDesignation) {
      const designationId = slug(rawSection.requirementDesignation);
      uniquePush(requirementDesignations, designationId, {
        requirementDesignationId: designationId,
        name: rawSection.requirementDesignation,
      });
      sectionRequirementDesignations.push({
        sectionId,
        requirementDesignationId: designationId,
      });
    }

    for (const attribute of rawSection.classAttributes || []) {
      const attributeId = slug(attribute);
      uniquePush(classAttributes, attributeId, {
        classAttributeId: attributeId,
        name: attribute,
      });
      sectionClassAttributes.push({
        sectionId,
        classAttributeId: attributeId,
      });
    }

    const rawMeetings = Array.isArray(rawSection.meetings) && rawSection.meetings.length
      ? rawSection.meetings
      : [{
          daysAndTimes: rawSection.daysAndTimes,
          room: rawSection.room,
          instructor: rawSection.instructor,
          meetingDates: rawSection.meetingDates,
        }];

    rawMeetings.forEach((meeting, meetingIndex) => {
      const daysAndTimes = parseDaysAndTimes(meeting.daysAndTimes);
      const meetingDates = parseDateRange(meeting.meetingDates);

      meetings.push({
        meetingId: `${sectionId}-meeting-${meetingIndex + 1}`,
        sectionId,
        daysAndTimesRaw: daysAndTimes.raw,
        daysRaw: daysAndTimes.daysRaw,
        days: daysAndTimes.days,
        startTime: daysAndTimes.startTime,
        endTime: daysAndTimes.endTime,
        room: emptyToNull(meeting.room),
        instructor: emptyToNull(meeting.instructor) || emptyToNull(rawSection.instructor),
        meetingDatesRaw: meetingDates.raw,
        startDate: meetingDates.startDate,
        endDate: meetingDates.endDate,
      });
    });
  }

  return {
    metadata: {
      schemaVersion: 1,
      sourceFileSchemaVersion: metadata.schemaVersion || null,
      source: metadata.source || null,
      sourceUrl: metadata.sourceUrl || null,
      scrapedAt: metadata.scrapedAt || null,
      normalizedAt: new Date().toISOString(),
      inputCounts: metadata.counts || {
        courses: (raw.courses || []).length,
        sections: (raw.sections || []).length,
      },
      outputCounts: {
        institutions: institutions.size,
        terms: terms.size,
        subjects: subjects.size,
        courses: courses.size,
        sections: sections.size,
        meetings: meetings.length,
        availability: availability.size,
        requirementDesignations: requirementDesignations.size,
        classAttributes: classAttributes.size,
        sectionRequirementDesignations: sectionRequirementDesignations.length,
        sectionClassAttributes: sectionClassAttributes.length,
      },
    },
    tables: {
      institutions: [...institutions.values()],
      terms: [...terms.values()],
      subjects: [...subjects.values()],
      courses: [...courses.values()],
      sections: [...sections.values()],
      meetings,
      availability: [...availability.values()],
      requirementDesignations: [...requirementDesignations.values()],
      classAttributes: [...classAttributes.values()],
      sectionRequirementDesignations,
      sectionClassAttributes,
    },
  };
}

function main() {
  const args = readArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(args.output);
  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const normalized = normalize(raw);
  const json = `${JSON.stringify(normalized, null, 2)}\n`;

  fs.writeFileSync(outputPath, json);
  console.error(`Wrote ${args.output}`);
  console.error(JSON.stringify(normalized.metadata.outputCounts, null, 2));

  if (args.stdout) {
    process.stdout.write(json);
  }
}

main();
