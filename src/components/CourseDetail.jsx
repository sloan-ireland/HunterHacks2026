function renderCourseList(codes) {
  if (!codes.length) {
    return <span className="detail-empty">None</span>;
  }

  return (
    <div className="token-list">
      {codes.map((code) => (
        <span key={code} className="token">
          {code}
        </span>
      ))}
    </div>
  );
}

export default function CourseDetail({ course, status, inPlan }) {
  if (!course) {
    return (
      <aside className="panel detail-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Course detail</p>
            <h2>Select a course</h2>
          </div>
        </div>
        <p className="muted-copy">
          Click any node in the roadmap to inspect prerequisites, offerings, and how it affects the
          graduation path.
        </p>
      </aside>
    );
  }

  return (
    <aside className="panel detail-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Course detail</p>
          <h2>{course.code}</h2>
        </div>
        <span className="panel-chip">{status}</span>
      </div>

      <div className="detail-stack">
        <div>
          <h3>{course.name}</h3>
          <p className="muted-copy">{course.description}</p>
        </div>

        <dl className="detail-grid">
          <div>
            <dt>Credits</dt>
            <dd>{course.credits}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{course.category}</dd>
          </div>
          <div>
            <dt>Difficulty</dt>
            <dd>{course.difficulty}</dd>
          </div>
          <div>
            <dt>Semester</dt>
            <dd>{course.semestersOffered.join(", ")}</dd>
          </div>
        </dl>

        <div>
          <h4>Prerequisites</h4>
          {renderCourseList(course.prerequisites)}
          {course.prerequisiteText ? <p className="detail-note">{course.prerequisiteText}</p> : null}
        </div>

        <div>
          <h4>Corequisites</h4>
          {renderCourseList(course.corequisites)}
          {course.corequisiteText ? <p className="detail-note">{course.corequisiteText}</p> : null}
        </div>

        {course.sourceUrl && course.sourceUrl !== "#" ? (
          <div className="detail-callout">
            <span>{inPlan ? "Planner path" : "Reference course"}</span>
            <a href={course.sourceUrl} target="_blank" rel="noreferrer">
              Open catalog source
            </a>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
