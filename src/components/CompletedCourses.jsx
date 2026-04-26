import { useMemo, useState } from "react";

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "core", label: "Core" },
  { key: "math", label: "Math" },
  { key: "elective", label: "Electives" },
];

function courseMeta(course, completedSet, trackedSet) {
  if (completedSet.has(course.code)) {
    return "Completed";
  }

  return trackedSet.has(course.code) ? "Roadmap" : "Available";
}

export default function CompletedCourses({
  groups,
  completedCodes,
  onSetCourseCompleted,
  trackedCredits,
  trackedCourseCount,
  planCourseCodes,
  degreeCreditsRequired,
  progressPercent,
  onSelectCourse,
}) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [query, setQuery] = useState("");
  const completedSet = new Set(completedCodes);
  const trackedSet = new Set(planCourseCodes);

  const allCourses = useMemo(
    () =>
      groups.flatMap((group) =>
        group.courses.map((course) => ({
          ...course,
          groupKey: group.key,
          groupLabel: group.label,
        })),
      ),
    [groups],
  );

  const visibleCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return allCourses
      .filter((course) => (activeFilter === "all" ? true : course.category === activeFilter))
      .filter((course) => {
        if (!normalizedQuery) {
          return true;
        }

        return [course.code, course.name, course.groupLabel]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => {
        const leftCompleted = completedSet.has(left.code) ? 0 : 1;
        const rightCompleted = completedSet.has(right.code) ? 0 : 1;

        if (leftCompleted !== rightCompleted) {
          return leftCompleted - rightCompleted;
        }

        if (left.category !== right.category) {
          return left.category.localeCompare(right.category);
        }

        return left.code.localeCompare(right.code);
      });
  }, [activeFilter, allCourses, completedSet, query]);

  return (
    <section className="panel checklist-panel rail-panel progress-panel-expanded">
      <div className="panel-header rail-header">
        <div>
          <p className="eyebrow">My Progress</p>
          <h2>Degree progress</h2>
        </div>
        <span className="panel-chip">{progressPercent}%</span>
      </div>

      <div className="progress-hero">
        <strong>
          {trackedCredits} of {degreeCreditsRequired} credits completed
        </strong>
        <div className="progress-bar-shell" aria-hidden="true">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="muted-copy">
          {completedCodes.length} course{completedCodes.length === 1 ? "" : "s"} marked complete across the roadmap.
        </span>
      </div>

      <div className="completed-header-row">
        <strong>Roadmap courses</strong>
        <span>{trackedCourseCount}</span>
      </div>

      <div className="progress-filter-tabs" role="tablist" aria-label="Course filters">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={activeFilter === option.key ? "is-active" : ""}
            onClick={() => setActiveFilter(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="progress-search-shell">
        <span className="progress-search-label">Search courses</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by code or title"
        />
      </label>

      <div className="completed-header-row completed-header-row-subtle">
        <strong>Showing</strong>
        <span>{visibleCourses.length}</span>
      </div>

      <div className="completed-course-list completed-course-list-tall">
        {visibleCourses.map((course) => {
          const checked = completedSet.has(course.code);
          const inputId = `course-${course.code.replace(/\s+/g, "-").toLowerCase()}`;
          return (
            <label
              key={course.code}
              className={`progress-course-row ${checked ? "is-completed" : ""}`}
              htmlFor={inputId}
            >
              <input
                id={inputId}
                type="checkbox"
                checked={checked}
                aria-label={`${course.code} ${course.name}`}
                onChange={(event) => onSetCourseCompleted(course.code, event.target.checked)}
              />
              <button
                type="button"
                className="progress-course-copy"
                onClick={() => onSelectCourse(course.code)}
              >
                <div className="progress-course-topline">
                  <strong>{course.code}</strong>
                  <span>{course.credits} cr</span>
                </div>
                <p>{course.name}</p>
                <small>{course.groupLabel}</small>
              </button>
              <span className="course-badge">{courseMeta(course, completedSet, trackedSet)}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
