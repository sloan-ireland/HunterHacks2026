export default function SemesterPlan({ plan }) {
  const activeSemesters = plan.semesters.filter((semester) => semester.courses.length);
  const previewSemesters = activeSemesters.slice(0, 2);
  const remainingTermCount = Math.max(activeSemesters.length - previewSemesters.length, 0);
  const averageCredits = activeSemesters.length
    ? Math.round(plan.totalRemainingCredits / activeSemesters.length)
    : 0;

  return (
    <section className="panel semester-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 3</p>
          <h2>Next two terms</h2>
        </div>
        <span className="panel-chip">Projected finish: {plan.projectedGraduation}</span>
      </div>

      <div className="semester-summary">
        <div>
          <span className="summary-label">Credits left</span>
          <strong>{plan.totalRemainingCredits}</strong>
          <span>still needed for the tracked roadmap</span>
        </div>
        <div>
          <span className="summary-label">Terms ahead</span>
          <strong>{activeSemesters.length}</strong>
          <span>active terms in the full roadmap</span>
        </div>
        <div>
          <span className="summary-label">Average load</span>
          <strong>{averageCredits || 0}</strong>
          <span>credits per active term in this plan</span>
        </div>
      </div>

      {remainingTermCount > 0 ? (
        <p className="muted-copy semester-preview-note">
          Showing the next two active terms. {remainingTermCount} more term{remainingTermCount === 1 ? "" : "s"} continue in the longer roadmap.
        </p>
      ) : null}

      <div className="semester-grid">
        {previewSemesters.map((semester, index) => (
          <article key={semester.id} className={`semester-card ${semester.isIdle ? "is-idle" : ""}`}>
            <div className="semester-card-topline">
              <span className="semester-card-index">Term {index + 1}</span>
              <span className={`semester-card-chip ${semester.isIdle ? "is-idle" : ""}`}>
                {semester.isIdle ? "Idle" : "On track"}
              </span>
            </div>

            <div className="semester-card-header">
              <h3>{semester.label}</h3>
              <span>{semester.credits} credits</span>
            </div>

            {semester.courses.length ? (
              <div className="semester-course-list">
                {semester.courses.map((course) => (
                  <div key={course.code} className="semester-course-row">
                    <div>
                      <strong>{course.code}</strong>
                      <p>{course.name}</p>
                    </div>
                    <span>{course.credits} cr</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-copy semester-empty-copy">No eligible courses fit this term.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
