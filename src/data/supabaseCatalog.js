import mockHunterCsPlaceholder from "./mockHunterCsPlaceholder";

const SUPABASE_URL = "https://awgcdhteareaizvssboe.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3Z2NkaHRlYXJlYWl6dnNzYm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNDQ5NTMsImV4cCI6MjA5MjcyMDk1M30.ZyXsBAol9tLMhYkdhl1-S_PTLcD57kYqqVEbKrcmCew";

const placeholderMetadataByCode = Object.fromEntries(
  mockHunterCsPlaceholder.courses.map((course) => [course.code, course]),
);

const seasonRank = {
  winter: 0,
  spring: 1,
  summer: 2,
  fall: 3,
};

function normalizeCode(code) {
  if (!code) {
    return "";
  }

  const compact = String(code).trim().replace(/\s+/g, " ");
  const merged = compact.match(/^([A-Z]{2,})\s?(\d{5})$/);

  if (!merged) {
    return compact;
  }

  return `${merged[1]} ${merged[2]}`;
}

function extractCodes(text) {
  if (!text) {
    return [];
  }

  return [...new Set((String(text).match(/[A-Z]{2,}\s?\d{5}/g) ?? []).map(normalizeCode))];
}

function normalizeSeason(value) {
  return String(value ?? "").trim().toLowerCase();
}

function compareTermRows(left, right, termById) {
  const leftTerm = termById[left.term_id] ?? {};
  const rightTerm = termById[right.term_id] ?? {};
  const yearDelta = Number(rightTerm.year ?? 0) - Number(leftTerm.year ?? 0);

  if (yearDelta !== 0) {
    return yearDelta;
  }

  return (seasonRank[normalizeSeason(rightTerm.season)] ?? -1) - (seasonRank[normalizeSeason(leftTerm.season)] ?? -1);
}

function normalizeDescription(rawValue) {
  if (!rawValue) {
    return "";
  }

  if (Array.isArray(rawValue)) {
    return rawValue
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object") {
          return item.text ?? item.description ?? item.value ?? "";
        }

        return "";
      })
      .filter(Boolean)
      .join(" ");
  }

  if (typeof rawValue === "string") {
    return rawValue;
  }

  return "";
}

function inferDifficulty(courseNumber, fallback) {
  if (fallback) {
    return fallback;
  }

  const number = Number.parseInt(courseNumber, 10);
  if (!Number.isFinite(number)) {
    return "intermediate";
  }
  if (number < 15000) {
    return "introductory";
  }
  if (number < 30000) {
    return "foundational";
  }
  if (number < 40000) {
    return "intermediate";
  }
  return "advanced";
}

function getSupabaseHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
}

async function fetchTable(tableName, select) {
  const url = new URL(`/rest/v1/${tableName}`, SUPABASE_URL);
  url.searchParams.set("select", select);

  const response = await fetch(url, {
    headers: getSupabaseHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${tableName} fetch failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

function getSemestersOffered(rows, termById, fallback) {
  const semesters = [...new Set(
    rows
      .map((row) => normalizeSeason(termById[row.term_id]?.season))
      .filter(Boolean),
  )];

  return semesters.length ? semesters : fallback ?? ["fall", "spring"];
}

export async function fetchSupabaseCatalogDataset() {
  const [institutions, terms, subjects, courses, sections] = await Promise.all([
    fetchTable("institutions", "institution_id,name,source_value"),
    fetchTable("terms", "term_id,term_value,name,year,season"),
    fetchTable("subjects", "subject_id,code,name"),
    fetchTable(
      "courses",
      [
        "course_id",
        "institution_id",
        "term_id",
        "subject_id",
        "subject",
        "course_number",
        "code",
        "title",
        "career",
        "units_raw",
        "min_units",
        "max_units",
        "prerequisites",
        "corequisites",
        "pre_or_corequisites",
        "descriptions",
      ].join(","),
    ),
    fetchTable(
      "sections",
      [
        "section_id",
        "course_id",
        "term_id",
        "details_url",
        "description",
        "status",
        "prerequisites",
        "corequisites",
        "pre_or_corequisites",
      ].join(","),
    ),
  ]);

  if (!courses.length) {
    throw new Error(
      "Supabase returned zero course rows for the anon key. Public SELECT policies are likely missing on the catalog tables.",
    );
  }

  const hunterInstitution =
    institutions.find((row) => /hunter/i.test(row.name ?? row.source_value ?? "")) ?? institutions[0] ?? null;
  const termById = Object.fromEntries(terms.map((row) => [row.term_id, row]));
  const subjectById = Object.fromEntries(subjects.map((row) => [row.subject_id, row]));
  const sectionsByCourseId = sections.reduce((accumulator, row) => {
    accumulator[row.course_id] ??= [];
    accumulator[row.course_id].push(row);
    return accumulator;
  }, {});

  const isUndergraduateCareer = (value) => {
    if (!value) {
      return true;
    }

    const normalized = String(value).trim().toLowerCase();
    return normalized === "ugrd" || normalized === "undergraduate";
  };

  const filteredCourses = courses.filter((row) => {
    const matchesInstitution = hunterInstitution ? row.institution_id === hunterInstitution.institution_id : true;
    return matchesInstitution && isUndergraduateCareer(row.career);
  });
  const visibleCourses = filteredCourses.length
    ? filteredCourses
    : courses.filter((row) => isUndergraduateCareer(row.career));

  const groupedByCode = visibleCourses.reduce((accumulator, row) => {
    const code = normalizeCode(row.code ?? `${row.subject} ${row.course_number}`);
    if (!code) {
      return accumulator;
    }

    accumulator[code] ??= [];
    accumulator[code].push({ ...row, code });
    return accumulator;
  }, {});

  const coursesForFrontend = Object.entries(groupedByCode)
    .map(([code, courseRows]) => {
      const metadata = placeholderMetadataByCode[code] ?? {};
      const sortedRows = [...courseRows].sort((left, right) => compareTermRows(left, right, termById));
      const representative = sortedRows[0];
      const representativeSections = sortedRows.flatMap((row) => sectionsByCourseId[row.course_id] ?? []);
      const subjectRecord = subjectById[representative.subject_id] ?? {};
      const subject = representative.subject ?? subjectRecord.code ?? metadata.subject ?? code.split(" ")[0];
      const courseNumber = representative.course_number ?? metadata.courseNumber ?? code.split(" ")[1];
      const parsedPrereqs = extractCodes(
        representative.prerequisites ??
          representative.pre_or_corequisites ??
          representativeSections.find((section) => section.prerequisites)?.prerequisites,
      );
      const parsedCoreqs = extractCodes(
        representative.corequisites ??
          representativeSections.find((section) => section.corequisites)?.corequisites,
      );
      const detailsUrl = representativeSections.find((section) => section.details_url)?.details_url;
      const sectionDescription = representativeSections.find((section) => section.description)?.description;
      const credits =
        Number(representative.max_units ?? representative.min_units ?? metadata.credits ?? 0) || metadata.credits || 0;

      return {
        code,
        name: representative.title ?? metadata.name ?? code,
        credits,
        prerequisites: metadata.prerequisites?.length ? metadata.prerequisites : parsedPrereqs,
        prerequisiteGroups:
          metadata.prerequisiteGroups?.length
            ? metadata.prerequisiteGroups
            : parsedPrereqs.map((prereqCode) => [prereqCode]),
        corequisites: metadata.corequisites?.length ? metadata.corequisites : parsedCoreqs,
        prerequisiteText: representative.prerequisites ?? metadata.prerequisiteText ?? "",
        corequisiteText: representative.corequisites ?? metadata.corequisiteText ?? "",
        semestersOffered: getSemestersOffered(sortedRows, termById, metadata.semestersOffered),
        category:
          metadata.category ??
          (subject === "MATH" || subject === "STAT"
            ? "math"
            : mockHunterCsPlaceholder.planCourseCodes.includes(code)
              ? "core"
              : "elective"),
        description:
          normalizeDescription(representative.descriptions) ||
          sectionDescription ||
          metadata.description ||
          "Imported from Supabase course data.",
        difficulty: inferDifficulty(courseNumber, metadata.difficulty),
        subject,
        courseNumber,
        sourceUrl: detailsUrl ?? metadata.sourceUrl ?? "#",
      };
    })
    .sort((left, right) => left.code.localeCompare(right.code));

  const availableCodes = new Set(coursesForFrontend.map((course) => course.code));

  return {
    source: {
      college: hunterInstitution?.name ?? mockHunterCsPlaceholder.source.college,
      major: mockHunterCsPlaceholder.source.major,
      implementation: "Live Supabase catalog dataset",
      programUrl: mockHunterCsPlaceholder.source.programUrl,
    },
    program: {
      ...mockHunterCsPlaceholder.program,
      longName: "Computer Science BA with live Supabase catalog",
      planCode: "COMPSCI-BA-SUPABASE-LIVE",
    },
    planCourseCodes: mockHunterCsPlaceholder.planCourseCodes.filter((code) => availableCodes.has(code)),
    electiveOptions: mockHunterCsPlaceholder.electiveOptions.filter((code) => availableCodes.has(code)),
    courses: coursesForFrontend,
  };
}
