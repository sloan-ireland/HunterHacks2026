export default function SemesterPlan({ plan }) {
  return (
    <section className="panel semester-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 3</p>
          <h2>Semester-by-semester plan</h2>
        </div>
        <span className="panel-chip">Projected graduation: {plan.projectedGraduation}</span>
      </div>

      <div className="semester-summary">
        <div>
          <strong>{plan.totalRemainingCredits}</strong>
          <span>credits remaining</span>
        </div>
        <div>
          <strong>{plan.semesters.filter((semester) => semester.courses.length).length}</strong>
          <span>active semesters</span>
        </div>
      </div>

      <div className="semester-grid">
        {plan.semesters.map((semester) => (
          <article key={semester.id} className={`semester-card ${semester.isIdle ? "is-idle" : ""}`}>
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
              <p className="muted-copy">No eligible courses fit this term.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
