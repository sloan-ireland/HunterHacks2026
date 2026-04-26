export default function CollegeMajorSelector({
  datasetId,
  datasetOptions,
  onDatasetChange,
  college,
  major,
  onCollegeChange,
  onMajorChange,
  datasetStatus,
}) {
  const statusTone = datasetStatus?.status ?? "ready";

  return (
    <section className="panel selector-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 1</p>
          <h2>Plan setup</h2>
        </div>
        <span className="panel-chip">Roadmap</span>
      </div>

      <div className="selector-grid">
        <label className="field">
          <span>Catalog</span>
          <select value={datasetId} onChange={(event) => onDatasetChange(event.target.value)}>
            {datasetOptions.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>College</span>
          <select value={college} onChange={(event) => onCollegeChange(event.target.value)}>
            <option>Hunter College</option>
          </select>
        </label>

        <label className="field">
          <span>Major</span>
          <select value={major} onChange={(event) => onMajorChange(event.target.value)}>
            <option>Computer Science BA</option>
          </select>
        </label>
      </div>

      <p className="muted-copy selector-note">
        Choose the catalog you want to plan against. The graph, checklist, and semester plan update
        together.
      </p>

      {datasetStatus?.message ? (
        <p className={`selector-status is-${statusTone}`}>{datasetStatus.message}</p>
      ) : null}
    </section>
  );
}
