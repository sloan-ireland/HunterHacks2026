export default function CollegeMajorSelector({ catalogLabel, college, major, datasetStatus }) {
  const statusTone = datasetStatus?.status ?? "ready";
  const setupItems = ["Academic Background", "Program", "Plan Options"];

  return (
    <section className="panel setup-panel">
      <div className="panel-header rail-header">
        <div>
          <p className="eyebrow">Setup</p>
          <h2>Program setup</h2>
        </div>
      </div>

      <div className="setup-checklist">
        {setupItems.map((item) => (
          <div key={item} className="setup-check-row">
            <span>{item}</span>
            <span className="setup-check-icon">OK</span>
          </div>
        ))}
      </div>

      <div className="setup-overview">
        <div className="setup-card">
          <span className="setup-card-label">Catalog</span>
          <strong className="setup-card-value">{catalogLabel}</strong>
        </div>
        <div className="setup-card">
          <span className="setup-card-label">College</span>
          <strong className="setup-card-value">{college}</strong>
        </div>
        <div className="setup-card">
          <span className="setup-card-label">Major</span>
          <strong className="setup-card-value">{major}</strong>
        </div>
      </div>

      {datasetStatus?.message ? (
        <p className={`selector-status is-${statusTone}`}>{datasetStatus.message}</p>
      ) : null}
    </section>
  );
}
