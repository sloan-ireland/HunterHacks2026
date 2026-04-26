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
          <h2>Setup</h2>
        </div>
        <span className="panel-chip">MVP</span>
      </div>

      <div className="selector-grid">
        <label className="field">
          <span>Dataset</span>
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
        Swap between placeholder datasets and the live Supabase catalog without changing the rest of
        the planner UI.
      </p>

      {datasetStatus?.message ? (
        <p className={`selector-status is-${statusTone}`}>{datasetStatus.message}</p>
      ) : null}
    </section>
  );
}
