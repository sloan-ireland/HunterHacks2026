const DEFAULT_PLAN_CODES = [
  "CSCI 12700",
  "MATH 12500",
  "CSCI 13500",
  "CSCI 15000",
  "MATH 15000",
  "CSCI 16000",
  "STAT 21300",
  "MATH 15500",
  "MATH 16000",
  "CSCI 23500",
  "CSCI 26000",
  "CSCI 26500",
  "CSCI 33500",
  "CSCI 34000",
  "CSCI 49900",
];

const DEFAULT_ELECTIVES = [
  "CSCI 23200",
  "CSCI 35000",
  "CSCI 35500",
  "CSCI 38500",
  "CSCI 46000",
  "CSCI 26700",
];

const CATEGORY_LABELS = {
  core: "Computer Science Core",
  math: "Math and Statistics",
  elective: "Popular Electives",
};

const PREREQUISITE_GROUP_OVERRIDES = {
  "CSCI 13500": [["CSCI 12700"], ["MATH 12400", "MATH 12500", "MATH 12550", "MATH 15000", "MATH 15500"]],
  "CSCI 15000": [["MATH 12400", "MATH 12500", "MATH 12550", "MATH 15000", "MATH 15500"]],
  "CSCI 16000": [["CSCI 12700"], ["CSCI 15000"]],
  "CSCI 23200": [["CSCI 12700", "CSCI 13200"]],
  "CSCI 23500": [["CSCI 13500"], ["CSCI 15000"], ["MATH 15000"]],
  "CSCI 26000": [["CSCI 13500"], ["CSCI 16000", "CSCI 24500"], ["MATH 15000"]],
  "CSCI 26500": [["CSCI 16000", "CSCI 14500"], ["MATH 15000"]],
  "CSCI 26700": [["CSCI 13300", "CSCI 26000"]],
  "CSCI 33500": [["CSCI 23500"], ["MATH 15500"]],
  "CSCI 34000": [["CSCI 26000", "CSCI 24500"], ["CSCI 23500"], ["STAT 11300", "STAT 21300"], ["MATH 15500"]],
  "CSCI 35000": [["CSCI 33500"], ["STAT 21300"]],
  "CSCI 46000": [["CSCI 26500"], ["CSCI 33500"]],
  "CSCI 49900": [["CSCI 33500"], ["CSCI 34000"]],
  "MATH 12400": [["MATH 10100", "MATH 101EN"]],
  "MATH 12500": [],
  "MATH 12550": [["MATH 10150", "MATH 12500"]],
  "MATH 15000": [["MATH 12400", "MATH 12500", "MATH 12550"]],
  "MATH 15500": [["MATH 15000", "MATH 15100"]],
  "MATH 16000": [["MATH 12400", "MATH 12500", "MATH 12550"]],
  "STAT 21300": [["MATH 12400", "MATH 12500", "MATH 12550"]],
};

function sortCourses(a, b) {
  if (a.subject !== b.subject) {
    return a.subject.localeCompare(b.subject);
  }

  return Number(a.courseNumber) - Number(b.courseNumber);
}

export function createCatalog(rawCatalog) {
  const courses = [...rawCatalog.courses]
    .map((course) => ({
      ...course,
      semestersOffered:
        course.semestersOffered?.map((semester) => semester.toLowerCase()) ?? [],
      prerequisiteGroups:
        course.prerequisiteGroups ??
        PREREQUISITE_GROUP_OVERRIDES[course.code] ??
        course.prerequisites.map((code) => [code]),
    }))
    .sort(sortCourses);

  const courseMap = Object.fromEntries(courses.map((course) => [course.code, course]));
  const planCourseCodes = (rawCatalog.planCourseCodes ?? DEFAULT_PLAN_CODES).filter(
    (code) => courseMap[code],
  );
  const electiveOptions = (rawCatalog.electiveOptions ?? DEFAULT_ELECTIVES).filter(
    (code) => courseMap[code],
  );

  const groupedCourses = Object.entries(
    courses.reduce((accumulator, course) => {
      const key = course.category ?? "other";
      accumulator[key] ??= [];
      accumulator[key].push(course);
      return accumulator;
    }, {}),
  )
    .sort(([left], [right]) => {
      const order = ["core", "math", "elective"];
      return order.indexOf(left) - order.indexOf(right);
    })
    .map(([key, value]) => ({
      key,
      label: CATEGORY_LABELS[key] ?? key,
      courses: value.sort(sortCourses),
    }));

  const totalPlanCredits = planCourseCodes.reduce(
    (sum, code) => sum + (courseMap[code]?.credits ?? 0),
    0,
  );

  return {
    source: rawCatalog.source,
    program: rawCatalog.program,
    courses,
    courseMap,
    groupedCourses,
    planCourseCodes,
    electiveOptions,
    totalPlanCredits,
  };
}

export const demoScenarios = {
  freshman: {
    label: "Freshman",
    completed: [],
  },
  sophomore: {
    label: "Sophomore",
    completed: ["CSCI 12700", "MATH 12500", "CSCI 13500", "CSCI 15000", "MATH 15000"],
  },
  junior: {
    label: "Junior",
    completed: [
      "CSCI 12700",
      "MATH 12500",
      "CSCI 13500",
      "CSCI 15000",
      "MATH 15000",
      "CSCI 16000",
      "STAT 21300",
      "MATH 15500",
      "CSCI 23500",
    ],
  },
  senior: {
    label: "Senior",
    completed: [
      "CSCI 12700",
      "MATH 12500",
      "CSCI 13500",
      "CSCI 15000",
      "MATH 15000",
      "CSCI 16000",
      "STAT 21300",
      "MATH 15500",
      "MATH 16000",
      "CSCI 23500",
      "CSCI 26000",
      "CSCI 26500",
      "CSCI 33500",
    ],
  },
  transfer: {
    label: "Transfer",
    completed: ["CSCI 12700", "MATH 12500", "MATH 15000", "STAT 21300", "CSCI 23200"],
  },
};

