const DIFFICULTY_POINTS = {
  introductory: 1,
  foundational: 2,
  intermediate: 3,
  advanced: 4,
};

const TERM_LABELS = {
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
};

function unique(items) {
  return [...new Set(items)];
}

function isCourseOfferedIn(course, season) {
  if (!course?.semestersOffered?.length) {
    return season !== "summer";
  }

  if (course.semestersOffered.includes("all terms")) {
    return true;
  }

  return course.semestersOffered.includes(season);
}

export function hasSatisfiedPrerequisites(course, completedSet) {
  const groups = course.prerequisiteGroups ?? course.prerequisites.map((code) => [code]);

  return groups.every((group) => {
    if (!group.length) {
      return true;
    }

    return group.some((code) => completedSet.has(code));
  });
}

function getDifficultyPoints(course) {
  return DIFFICULTY_POINTS[course.difficulty] ?? 2;
}

function createTermLabel(term) {
  return `${TERM_LABELS[term.season]} ${term.year}`;
}

function getStartingTerm(includeSummer) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  if (month <= 5) {
    return includeSummer ? { season: "summer", year } : { season: "fall", year };
  }

  if (month <= 8) {
    return { season: "fall", year };
  }

  return { season: "spring", year: year + 1 };
}

function nextTerm(term, includeSummer) {
  if (term.season === "spring") {
    return includeSummer
      ? { season: "summer", year: term.year }
      : { season: "fall", year: term.year };
  }

  if (term.season === "summer") {
    return { season: "fall", year: term.year };
  }

  return { season: "spring", year: term.year + 1 };
}

function getDescendantCounts(courses, courseMap) {
  const memo = new Map();
  const directDependents = courses.reduce((accumulator, course) => {
    course.prerequisites.forEach((prerequisite) => {
      if (!courseMap[prerequisite]) {
        return;
      }

      accumulator[prerequisite] ??= [];
      accumulator[prerequisite].push(course.code);
    });

    return accumulator;
  }, {});

  function visit(code, trail = new Set()) {
    if (memo.has(code)) {
      return memo.get(code);
    }

    if (trail.has(code)) {
      return new Set();
    }

    trail.add(code);
    const descendants = new Set();
    const dependents = directDependents[code] ?? [];

    dependents.forEach((dependentCode) => {
      descendants.add(dependentCode);
      visit(dependentCode, trail).forEach((nextCode) => descendants.add(nextCode));
    });

    memo.set(code, descendants);
    trail.delete(code);
    return descendants;
  }

  return Object.fromEntries(courses.map((course) => [course.code, visit(course.code).size]));
}

export function getCourseStatuses(courses, completedCodes) {
  const completedSet = new Set(completedCodes);
  const availableNow = new Set();

  courses.forEach((course) => {
    if (!completedSet.has(course.code) && hasSatisfiedPrerequisites(course, completedSet)) {
      availableNow.add(course.code);
    }
  });

  const statuses = {};

  courses.forEach((course) => {
    if (completedSet.has(course.code)) {
      statuses[course.code] = "completed";
      return;
    }

    if (availableNow.has(course.code)) {
      statuses[course.code] = "available";
      return;
    }

    const nextReady = course.prerequisites.every(
      (code) => completedSet.has(code) || availableNow.has(code),
    );

    statuses[course.code] = nextReady ? "next" : "locked";
  });

  return statuses;
}

export function buildGraphLayout(courses, courseMap, emphasizedCodes = []) {
  const layerMemo = new Map();
  const emphasizedSet = new Set(emphasizedCodes);

  function getLayer(code, trail = new Set()) {
    if (layerMemo.has(code)) {
      return layerMemo.get(code);
    }

    if (trail.has(code)) {
      return 0;
    }

    const course = courseMap[code];
    if (!course) {
      return 0;
    }

    trail.add(code);
    const prerequisites = course.prerequisites.filter((prerequisite) => courseMap[prerequisite]);
    const layer = prerequisites.length
      ? Math.max(...prerequisites.map((prerequisite) => getLayer(prerequisite, trail) + 1))
      : 0;
    trail.delete(code);
    layerMemo.set(code, layer);
    return layer;
  }

  const columns = new Map();

  courses.forEach((course) => {
    const layer = getLayer(course.code);
    columns.set(layer, [...(columns.get(layer) ?? []), course]);
  });

  const orderedLayers = [...columns.entries()]
    .sort(([left], [right]) => left - right)
    .map(([layer, columnCourses]) => [
      layer,
      columnCourses.sort((a, b) => {
        const priorityA = emphasizedSet.has(a.code) ? 0 : 1;
        const priorityB = emphasizedSet.has(b.code) ? 0 : 1;

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        if (a.subject !== b.subject) {
          return a.subject.localeCompare(b.subject);
        }

        return Number(a.courseNumber) - Number(b.courseNumber);
      }),
    ]);

  const nodeWidth = 162;
  const nodeHeight = 88;
  const horizontalGap = 34;
  const verticalGap = 16;
  const topPadding = 84;
  const leftPadding = 18;

  const nodes = [];
  let maxRows = 0;

  orderedLayers.forEach(([layer, columnCourses]) => {
    maxRows = Math.max(maxRows, columnCourses.length);
    columnCourses.forEach((course, index) => {
      nodes.push({
        ...course,
        x: leftPadding + layer * (nodeWidth + horizontalGap),
        y: topPadding + index * (nodeHeight + verticalGap),
        width: nodeWidth,
        height: nodeHeight,
        layer,
      });
    });
  });

  const nodeByCode = Object.fromEntries(nodes.map((node) => [node.code, node]));
  const edges = nodes.flatMap((node) =>
    node.prerequisites
      .filter((code) => nodeByCode[code])
      .map((prerequisite) => ({
        id: `${prerequisite}->${node.code}`,
        source: prerequisite,
        target: node.code,
      })),
  );

  return {
    width:
      leftPadding * 2 +
      orderedLayers.length * nodeWidth +
      Math.max(orderedLayers.length - 1, 0) * horizontalGap,
    height: topPadding * 2 + maxRows * nodeHeight + Math.max(maxRows - 1, 0) * verticalGap,
    nodes,
    nodeByCode,
    edges,
  };
}

export function generateSemesterPlan({
  courses,
  courseMap,
  completedCodes,
  planCourseCodes,
  selectedElectiveCodes = [],
  includeSummer = false,
  maxCredits = 15,
  targetSemesterCount = 6,
}) {
  const descendantCounts = getDescendantCounts(courses, courseMap);
  const requiredCodes = unique([...planCourseCodes, ...selectedElectiveCodes]).filter(
    (code) => courseMap[code],
  );

  const completedSet = new Set(completedCodes);
  const remainingCodes = new Set(requiredCodes.filter((code) => !completedSet.has(code)));
  const semesters = [];
  let cursor = getStartingTerm(includeSummer);
  const maxGeneratedTerms = Math.max(targetSemesterCount, 20);

  for (
    let termIndex = 0;
    termIndex < maxGeneratedTerms && (termIndex < targetSemesterCount || remainingCodes.size > 0);
    termIndex += 1
  ) {
    const availableCourses = [...remainingCodes]
      .map((code) => courseMap[code])
      .filter((course) => hasSatisfiedPrerequisites(course, completedSet))
      .filter((course) => isCourseOfferedIn(course, cursor.season))
      .sort((left, right) => {
        const gateDelta = (descendantCounts[right.code] ?? 0) - (descendantCounts[left.code] ?? 0);
        if (gateDelta !== 0) {
          return gateDelta;
        }

        const difficultyDelta = getDifficultyPoints(left) - getDifficultyPoints(right);
        if (difficultyDelta !== 0) {
          return difficultyDelta;
        }

        return left.code.localeCompare(right.code);
      });

    let usedCredits = 0;
    let usedDifficulty = 0;
    const chosenCourses = [];

    availableCourses.forEach((course) => {
      const difficulty = getDifficultyPoints(course);
      const nextCredits = usedCredits + course.credits;
      const exceedsCredits = nextCredits > maxCredits;
      const exceedsDifficulty = usedDifficulty + difficulty > Math.max(8, Math.ceil(maxCredits / 2));

      if (!chosenCourses.length || (!exceedsCredits && !exceedsDifficulty)) {
        if (!exceedsCredits) {
          chosenCourses.push(course);
          usedCredits = nextCredits;
          usedDifficulty += difficulty;
        }
      }
    });

    if (!chosenCourses.length && availableCourses.length) {
      chosenCourses.push(availableCourses[0]);
      usedCredits = availableCourses[0].credits;
      usedDifficulty = getDifficultyPoints(availableCourses[0]);
    }

    if (chosenCourses.length) {
      chosenCourses.forEach((course) => {
        completedSet.add(course.code);
        remainingCodes.delete(course.code);
      });
    }

    semesters.push({
      id: `${cursor.season}-${cursor.year}`,
      label: createTermLabel(cursor),
      season: cursor.season,
      year: cursor.year,
      credits: usedCredits,
      courses: chosenCourses,
      isIdle: !chosenCourses.length,
    });

    cursor = nextTerm(cursor, includeSummer);
  }

  const totalRemainingCredits = requiredCodes.reduce(
    (sum, code) => sum + (completedCodes.includes(code) ? 0 : courseMap[code]?.credits ?? 0),
    0,
  );

  const projectedGraduation = semesters.filter((semester) => semester.courses.length).at(-1);

  return {
    semesters,
    projectedGraduation: projectedGraduation?.label ?? "Complete",
    remainingCourses: [...remainingCodes],
    totalRemainingCredits,
  };
}

