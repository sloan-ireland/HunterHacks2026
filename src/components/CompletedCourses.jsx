function courseMeta(course, completedSet, focusSet) {
  if (completedSet.has(course.code)) {
    return "Completed";
  }

  if (focusSet.has(course.code)) {
    return "Planner Track";
  }

  return "Reference";
}

export default function CompletedCourses({
  groups,
  completedCodes,
  onSetCourseCompleted,
  trackedCredits,
  trackedCourseCount,
  planCourseCodes,
}) {
  const completedSet = new Set(completedCodes);
  const focusSet = new Set(planCourseCodes);

  return (
    <section className="panel checklist-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 2</p>
          <h2>Mark completed courses</h2>
        </div>
        <span className="panel-chip">
          {trackedCredits} credits / {trackedCourseCount} tracked courses
        </span>
      </div>

      <div className="checklist-groups">
        {groups.map((group) => (
          <div key={group.key} className="checklist-group">
            <div className="checklist-heading">
              <h3>{group.label}</h3>
              <span>{group.courses.length} courses</span>
            </div>

            <div className="course-list">
              {group.courses.map((course) => {
                const checked = completedSet.has(course.code);
                const inputId = `course-${course.code.replace(/\s+/g, "-").toLowerCase()}`;
                return (
                  <label
                    key={course.code}
                    className={`course-row ${checked ? "is-completed" : ""}`}
                    htmlFor={inputId}
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={checked}
                      aria-label={`${course.code} ${course.name}`}
                      onChange={(event) => onSetCourseCompleted(course.code, event.target.checked)}
                    />
                    <div className="course-copy">
                      <div className="course-row-topline">
                        <strong>{course.code}</strong>
                        <span>{course.credits} cr</span>
                      </div>
                      <p>{course.name}</p>
                    </div>
                    <span className="course-badge">{courseMeta(course, completedSet, focusSet)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
