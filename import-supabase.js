const fs = require('fs');
const path = require('path');

const DEFAULT_INPUT = 'normalized-courses.json';
const DEFAULT_BATCH_SIZE = 500;

function loadDotEnv(filePath = '.env') {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^['"]|['"]$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function readArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    batchSize: DEFAULT_BATCH_SIZE,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index];

    if (arg === '--input') {
      args.input = next();
    } else if (arg === '--batch-size') {
      args.batchSize = Number.parseInt(next(), 10);
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--help') {
      process.stdout.write(`Usage: node import-supabase.js [options]\n\nOptions:\n  --input normalized-courses.json   Normalized JSON file\n  --batch-size 500                  Rows per API request\n  --dry-run                         Validate and print counts without uploading\n\nRequired env:\n  SUPABASE_URL\n  SUPABASE_SERVICE_ROLE_KEY\n`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function pick(row, mapping) {
  return Object.fromEntries(
    Object.entries(mapping).map(([outputKey, inputKey]) => [outputKey, row[inputKey] ?? null])
  );
}

function readTables(inputPath) {
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  if (!data.tables) {
    throw new Error(`${inputPath} does not look like normalized-courses.json. Missing "tables".`);
  }

  return data.tables;
}

function mapTables(tables) {
  return {
    institutions: (tables.institutions || []).map(row => pick(row, {
      institution_id: 'institutionId',
      name: 'name',
      source_value: 'sourceValue',
    })),

    terms: (tables.terms || []).map(row => pick(row, {
      term_id: 'termId',
      term_value: 'termValue',
      name: 'name',
      year: 'year',
      season: 'season',
    })),

    subjects: (tables.subjects || []).map(row => pick(row, {
      subject_id: 'subjectId',
      code: 'code',
      name: 'name',
    })),

    courses: (tables.courses || []).map(row => pick(row, {
      course_id: 'courseId',
      institution_id: 'institutionId',
      term_id: 'termId',
      subject_id: 'subjectId',
      subject: 'subject',
      course_number: 'courseNumber',
      code: 'code',
      title: 'title',
      career: 'career',
      units_raw: 'unitsRaw',
      min_units: 'minUnits',
      max_units: 'maxUnits',
      class_components: 'classComponents',
      grading: 'grading',
      prerequisites: 'prerequisites',
      corequisites: 'corequisites',
      pre_or_corequisites: 'preOrCorequisites',
      enrollment_requirements: 'enrollmentRequirements',
      descriptions: 'descriptions',
      statuses: 'statuses',
      section_count: 'sectionCount',
    })),

    sections: (tables.sections || []).map(row => pick(row, {
      section_id: 'sectionId',
      course_id: 'courseId',
      institution_id: 'institutionId',
      term_id: 'termId',
      subject_id: 'subjectId',
      class_number: 'classNumber',
      section: 'section',
      section_code: 'sectionCode',
      section_type: 'sectionType',
      status: 'status',
      session: 'session',
      instruction_mode: 'instructionMode',
      career: 'career',
      units_raw: 'unitsRaw',
      min_units: 'minUnits',
      max_units: 'maxUnits',
      class_components: 'classComponents',
      grading: 'grading',
      location: 'location',
      campus: 'campus',
      dates_raw: 'datesRaw',
      start_date: 'startDate',
      end_date: 'endDate',
      class_notes: 'classNotes',
      description: 'description',
      course_topic: 'courseTopic',
      details_url: 'detailsUrl',
      enrollment_requirements: 'enrollmentRequirements',
      prerequisites: 'prerequisites',
      corequisites: 'corequisites',
      pre_or_corequisites: 'preOrCorequisites',
    })),

    meetings: (tables.meetings || []).map(row => pick(row, {
      meeting_id: 'meetingId',
      section_id: 'sectionId',
      days_and_times_raw: 'daysAndTimesRaw',
      days_raw: 'daysRaw',
      days: 'days',
      start_time: 'startTime',
      end_time: 'endTime',
      room: 'room',
      instructor: 'instructor',
      meeting_dates_raw: 'meetingDatesRaw',
      start_date: 'startDate',
      end_date: 'endDate',
    })),

    section_availability: (tables.availability || []).map(row => pick(row, {
      section_id: 'sectionId',
      class_capacity: 'classCapacity',
      wait_list_capacity: 'waitListCapacity',
      enrollment_total: 'enrollmentTotal',
      wait_list_total: 'waitListTotal',
      available_seats: 'availableSeats',
    })),

    requirement_designations: (tables.requirementDesignations || []).map(row => pick(row, {
      requirement_designation_id: 'requirementDesignationId',
      name: 'name',
    })),

    class_attributes: (tables.classAttributes || []).map(row => pick(row, {
      class_attribute_id: 'classAttributeId',
      name: 'name',
    })),

    section_requirement_designations: (tables.sectionRequirementDesignations || []).map(row => pick(row, {
      section_id: 'sectionId',
      requirement_designation_id: 'requirementDesignationId',
    })),

    section_class_attributes: (tables.sectionClassAttributes || []).map(row => pick(row, {
      section_id: 'sectionId',
      class_attribute_id: 'classAttributeId',
    })),
  };
}

function chunk(rows, size) {
  const chunks = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

async function upsertTable({ supabaseUrl, serviceRoleKey, tableName, rows, onConflict, batchSize }) {
  if (!rows.length) {
    console.error(`${tableName}: skipped 0 rows`);
    return;
  }

  let uploaded = 0;

  for (const batch of chunk(rows, batchSize)) {
    const url = new URL(`/rest/v1/${tableName}`, supabaseUrl);
    url.searchParams.set('on_conflict', onConflict);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${tableName} import failed (${response.status}): ${body}`);
    }

    uploaded += batch.length;
    console.error(`${tableName}: uploaded ${uploaded}/${rows.length}`);
  }
}

async function main() {
  loadDotEnv();
  loadDotEnv('real.env');
  const args = readArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.input);
  const tables = mapTables(readTables(inputPath));

  const order = [
    ['institutions', 'institution_id'],
    ['terms', 'term_id'],
    ['subjects', 'subject_id'],
    ['courses', 'course_id'],
    ['sections', 'section_id'],
    ['meetings', 'meeting_id'],
    ['section_availability', 'section_id'],
    ['requirement_designations', 'requirement_designation_id'],
    ['class_attributes', 'class_attribute_id'],
    ['section_requirement_designations', 'section_id,requirement_designation_id'],
    ['section_class_attributes', 'section_id,class_attribute_id'],
  ];

  console.error('Prepared rows:');
  for (const [tableName] of order) {
    console.error(`  ${tableName}: ${tables[tableName].length}`);
  }

  if (args.dryRun) {
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  for (const [tableName, onConflict] of order) {
    await upsertTable({
      supabaseUrl,
      serviceRoleKey,
      tableName,
      rows: tables[tableName],
      onConflict,
      batchSize: args.batchSize,
    });
  }

  console.error('Import complete.');
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
