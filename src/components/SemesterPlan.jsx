import { useEffect, useMemo, useState } from "react";
import { hasSatisfiedPrerequisites } from "../lib/planner";

const TERMS_PER_PAGE = 2;

function isCourseOfferedIn(course, season) {
  if (!course?.semestersOffered?.length) {
    return season !== "summer";
  }

  if (course.semestersOffered.includes("all terms")) {
    return true;
  }

  return course.semestersOffered.includes(season);
}

function createPlanSeed(plan) {
  return JSON.stringify(
    plan.semesters.map((semester) => ({
      id: semester.id,
      credits: semester.credits,
      codes: semester.courses.map((course) => course.code),
    })),
  );
}

function buildSemesterWarnings(semesters, completedCodes, maxCredits) {
  const warningsBySemester = {};
  const priorCompleted = new Set(completedCodes);

  semesters.forEach((semester) => {
    const warnings = [];

    if (semester.credits > maxCredits) {
      warnings.push(`This term exceeds the ${maxCredits}-credit load.`);
    }

    semester.courses.forEach((course) => {
      if (!hasSatisfiedPrerequisites(course, priorCompleted)) {
        warnings.push(`${course.code} has unmet prerequisite requirements.`);
      }

      if (!isCourseOfferedIn(course, semester.season)) {
        warnings.push(`${course.code} is not typically offered in ${semester.label}.`);
      }
    });

    warningsBySemester[semester.id] = [...new Set(warnings)];
    semester.courses.forEach((course) => priorCompleted.add(course.code));
  });

  return warningsBySemester;
}

function sortCourses(courses) {
  return [...courses].sort((left, right) => left.code.localeCompare(right.code));
}

export default function SemesterPlan({
  plan,
  courseMap,
  roadmapCourseCodes,
  completedCodes,
  maxCredits,
  onSelectCourse,
}) {
  const [editableSemesters, setEditableSemesters] = useState([]);
  const [additionSelections, setAdditionSelections] = useState({});
  const [additionQueries, setAdditionQueries] = useState({});
  const [plannerAlert, setPlannerAlert] = useState("");
  const [pageStart, setPageStart] = useState(0);
  const planSeed = useMemo(() => createPlanSeed(plan), [plan]);

  useEffect(() => {
    const nextSemesters = plan.semesters.map((semester) => ({
      ...semester,
      courses: sortCourses(semester.courses),
    }));

    setEditableSemesters(nextSemesters);
    setAdditionSelections({});
    setAdditionQueries({});
    setPlannerAlert("");
    setPageStart(0);
  }, [planSeed]);

  const plannedCodeSet = useMemo(
    () => new Set(editableSemesters.flatMap((semester) => semester.courses.map((course) => course.code))),
    [editableSemesters],
  );

  const availableAddCodes = useMemo(
    () =>
      Object.keys(courseMap).filter(
        (code) => !completedCodes.includes(code) && !plannedCodeSet.has(code) && courseMap[code],
      ),
    [completedCodes, courseMap, plannedCodeSet],
  );

  const warningsBySemester = useMemo(
    () => buildSemesterWarnings(editableSemesters, completedCodes, maxCredits),
    [editableSemesters, completedCodes, maxCredits],
  );

  const projectedGraduation = useMemo(
    () => editableSemesters.filter((semester) => semester.courses.length).at(-1)?.label ?? "Complete",
    [editableSemesters],
  );
  const remainingAfterTimeline = plan.remainingCourses.length;
  const maxPageStart = Math.max(0, editableSemesters.length - TERMS_PER_PAGE);
  const visibleSemesters = editableSemesters.slice(pageStart, pageStart + TERMS_PER_PAGE);
  const showingStart = editableSemesters.length ? pageStart + 1 : 0;
  const showingEnd = Math.min(pageStart + TERMS_PER_PAGE, editableSemesters.length);

  function validateAddition(courseCode, semesterIndex) {
    const course = courseMap[courseCode];
    const semester = editableSemesters[semesterIndex];

    if (!course || !semester) {
      return "That course could not be scheduled.";
    }

    if (completedCodes.includes(courseCode)) {
      return `Cannot add ${courseCode}. It is already marked complete.`;
    }

    if (plannedCodeSet.has(courseCode)) {
      return `Cannot add ${courseCode}. It is already in the graduation plan.`;
    }

    const priorCompleted = new Set(completedCodes);
    editableSemesters.slice(0, semesterIndex).forEach((plannedSemester) => {
      plannedSemester.courses.forEach((plannedCourse) => priorCompleted.add(plannedCourse.code));
    });

    if (!hasSatisfiedPrerequisites(course, priorCompleted)) {
      return `Cannot add ${courseCode} to ${semester.label}. Required prerequisite(s) are not completed yet.`;
    }

    if (!isCourseOfferedIn(course, semester.season)) {
      return `Cannot add ${courseCode} to ${semester.label}. It is not typically offered that term.`;
    }

    if (semester.credits + course.credits > maxCredits) {
      return `Cannot add ${courseCode} to ${semester.label}. That would exceed the ${maxCredits}-credit load.`;
    }

    return null;
  }

  function handleAddCourse(semesterId, semesterIndex) {
    const selectedCode = additionSelections[semesterId];

    if (!selectedCode) {
      setPlannerAlert("Choose a course before adding it to the graduation plan.");
      return;
    }

    const validationMessage = validateAddition(selectedCode, semesterIndex);
    if (validationMessage) {
      setPlannerAlert(validationMessage);
      return;
    }

    const course = courseMap[selectedCode];
    setEditableSemesters((current) =>
      current.map((semester) => {
        if (semester.id !== semesterId) {
          return semester;
        }

        const nextCourses = sortCourses([...semester.courses, course]);
        return {
          ...semester,
          courses: nextCourses,
          credits: nextCourses.reduce((sum, item) => sum + item.credits, 0),
          isIdle: nextCourses.length === 0,
        };
      }),
    );
    setAdditionSelections((current) => ({ ...current, [semesterId]: "" }));
    setAdditionQueries((current) => ({ ...current, [semesterId]: "" }));
    setPlannerAlert("");
  }

  function handleRemoveCourse(semesterId, courseCode) {
    setEditableSemesters((current) =>
      current.map((semester) => {
        if (semester.id !== semesterId) {
          return semester;
        }

        const nextCourses = semester.courses.filter((course) => course.code !== courseCode);
        return {
          ...semester,
          courses: nextCourses,
          credits: nextCourses.reduce((sum, item) => sum + item.credits, 0),
          isIdle: nextCourses.length === 0,
        };
      }),
    );
    setPlannerAlert("");
  }

  return (
    <section className="panel semester-panel graduation-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">My Graduation Plan</p>
          <h2>Semester timeline</h2>
        </div>
        <span className="panel-chip">Projected graduation: {projectedGraduation}</span>
      </div>

      <div className="timeline-toolbar">
        <span className="timeline-window-copy">
          Showing {showingStart}-{showingEnd} of {editableSemesters.length} terms
        </span>
        <div className="timeline-pager">
          <button
            type="button"
            className="timeline-page-button"
            onClick={() => setPageStart((current) => Math.max(0, current - TERMS_PER_PAGE))}
            disabled={pageStart === 0}
          >
            Previous
          </button>
          <button
            type="button"
            className="timeline-page-button"
            onClick={() => setPageStart((current) => Math.min(maxPageStart, current + TERMS_PER_PAGE))}
            disabled={pageStart >= maxPageStart}
          >
            Next
          </button>
        </div>
      </div>

      {plannerAlert ? <div className="planner-alert">{plannerAlert}</div> : null}

      <div className="graduation-plan-window">
        <div className="graduation-plan-strip graduation-plan-strip-paged">
        {visibleSemesters.map((semester, index) => {
          const semesterIndex = pageStart + index;
          const filteredAddCodes = availableAddCodes.filter((code) => {
            const query = additionQueries[semester.id]?.trim().toLowerCase();
            if (!query) {
              return true;
            }

            return [code, courseMap[code]?.name]
              .filter(Boolean)
              .some((value) => value.toLowerCase().includes(query));
          });

          return (
            <article key={semester.id} className="graduation-card graduation-card-editable">
              <div className="graduation-card-topline">
                <strong>{semester.label}</strong>
                <span className={`graduation-state ${semesterIndex === 0 ? "is-current" : "is-planned"}`}>
                  {semesterIndex === 0 ? "Current" : "Planned"}
                </span>
              </div>

              <div className="graduation-course-list">
                {semester.courses.length ? (
                  semester.courses.map((course) => (
                    <div key={course.code} className="graduation-course-row graduation-course-row-editable">
                      <button type="button" className="graduation-course-copy" onClick={() => onSelectCourse(course.code)}>
                        <strong>{course.code}</strong>
                        <p>{course.name}</p>
                      </button>
                      <div className="graduation-course-actions">
                        <span>{course.credits}</span>
                        <button
                          type="button"
                          className="semester-remove-button"
                          onClick={() => handleRemoveCourse(semester.id, course.code)}
                          aria-label={`Remove ${course.code} from ${semester.label}`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted-copy empty-term-copy">No courses assigned yet.</p>
                )}
              </div>

              <div className="semester-add-stack">
                <label className="progress-search-shell semester-search-shell">
                  <span className="progress-search-label">Search courses to add</span>
                  <input
                    type="search"
                    value={additionQueries[semester.id] ?? ""}
                    onChange={(event) =>
                      setAdditionQueries((current) => ({
                        ...current,
                        [semester.id]: event.target.value,
                      }))
                    }
                    placeholder="Search by code or title"
                  />
                </label>

                <div className="semester-add-row">
                  <select
                    value={additionSelections[semester.id] ?? ""}
                    onChange={(event) =>
                      setAdditionSelections((current) => ({
                        ...current,
                        [semester.id]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Add a course...</option>
                    {filteredAddCodes.map((code) => (
                      <option key={code} value={code}>
                        {code} - {courseMap[code]?.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="semester-add-button" onClick={() => handleAddCourse(semester.id, semesterIndex)}>
                    Add
                  </button>
                </div>
              </div>

              {warningsBySemester[semester.id]?.length ? (
                <div className="semester-warning-list">
                  {warningsBySemester[semester.id].map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}

              <div className="graduation-card-footer">
                <span>Total Credits</span>
                <strong>
                  {semester.credits} / {maxCredits}
                </strong>
              </div>
            </article>
          );
        })}
        </div>
      </div>

      <div className="graduation-summary-bar">
        <span>Total remaining credits: {plan.totalRemainingCredits}</span>
        <strong>Credit load target: {maxCredits} credits</strong>
      </div>
      {remainingAfterTimeline ? (
        <p className="graduation-overflow-note">
          {remainingAfterTimeline} course{remainingAfterTimeline === 1 ? "" : "s"} still sit beyond this timeline window.
        </p>
      ) : null}
    </section>
  );
}

