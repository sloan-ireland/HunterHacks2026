import { useEffect, useMemo, useState } from "react";

function renderRequirementPills(codes, courseMap) {
  if (!codes.length) {
    return <span className="detail-empty">None</span>;
  }

  return (
    <div className="requirement-pill-list">
      {codes.map((code) => (
        <div key={code} className="requirement-pill">
          <strong>{code}</strong>
          <span>{courseMap?.[code]?.name ?? "Course in roadmap"}</span>
        </div>
      ))}
    </div>
  );
}

export default function CourseDetail({ course, status, inPlan, courseMap }) {
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    setActiveTab("overview");
  }, [course?.code]);

  const semesterLabel = useMemo(
    () => course?.semestersOffered?.map((term) => term[0].toUpperCase() + term.slice(1)).join(", ") ?? "",
    [course],
  );

  if (!course) {
    return (
      <aside className="panel detail-panel drawer-panel">
        <div className="drawer-header">
          <div>
            <h2>Select a course</h2>
            <p className="muted-copy">
              Choose any course in the map to inspect prerequisites, term patterns, and how it fits
              into the roadmap.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="panel detail-panel drawer-panel">
      <div className="drawer-header">
        <div>
          <h2>{course.code}</h2>
          <h3>{course.name}</h3>
        </div>
        <div className="drawer-header-badges">
          <span className="panel-chip">{course.credits} Credits</span>
          <span className={`status-pill status-${status}`}>{status.replace(/(^.|\s.)/g, (value) => value.toUpperCase())}</span>
        </div>
      </div>

      <div className="drawer-tabs">
        <button type="button" className={activeTab === "overview" ? "is-active" : ""} onClick={() => setActiveTab("overview")}>
          Overview
        </button>
        <button type="button" className={activeTab === "details" ? "is-active" : ""} onClick={() => setActiveTab("details")}>
          Details
        </button>
      </div>

      {activeTab === "overview" ? (
        <div className="detail-stack">
          <p className="drawer-description">{course.description}</p>

          <div className="drawer-section">
            <h4>Prerequisites</h4>
            {renderRequirementPills(course.prerequisites, courseMap)}
          </div>

          <div className="drawer-section">
            <h4>Corequisites</h4>
            {renderRequirementPills(course.corequisites, courseMap)}
          </div>
        </div>
      ) : (
        <div className="detail-stack">
          <dl className="detail-grid detail-grid-stacked">
            <div>
              <dt>Category</dt>
              <dd>{course.category}</dd>
            </div>
            <div>
              <dt>Difficulty</dt>
              <dd>{course.difficulty}</dd>
            </div>
            <div>
              <dt>Typically Offered</dt>
              <dd>{semesterLabel}</dd>
            </div>
          </dl>

          {course.prerequisiteText ? (
            <div className="drawer-section">
              <h4>Catalog prerequisite text</h4>
              <p className="detail-note">{course.prerequisiteText}</p>
            </div>
          ) : null}
        </div>
      )}
    </aside>
  );
}
