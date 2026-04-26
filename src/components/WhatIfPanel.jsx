export default function WhatIfPanel({
  includeSummer,
  onIncludeSummerChange,
  maxCredits,
  onMaxCreditsChange,
  electiveOptions,
  selectedElectiveCodes,
  onToggleElective,
}) {
  return (
    <section className="panel what-if-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Plan controls</p>
          <h2>Shape the roadmap</h2>
        </div>
      </div>

      <div className="what-if-stack">
        <label className="toggle-row control-card">
          <span>
            <strong>Include summer courses</strong>
            <small>Compress the path when summer offerings exist.</small>
          </span>
          <input
            type="checkbox"
            checked={includeSummer}
            onChange={(event) => onIncludeSummerChange(event.target.checked)}
          />
        </label>

        <div className="credit-control control-card">
          <div>
            <strong>Credit load</strong>
            <small>The graduation plan uses this cap when placing and validating courses.</small>
          </div>
          <div className="credit-segments">
            {[9, 12, 15, 18].map((value) => (
              <button
                key={value}
                type="button"
                className={value === maxCredits ? "is-active" : ""}
                onClick={() => onMaxCreditsChange(value)}
              >
                {value} cr
              </button>
            ))}
          </div>
        </div>

        <div className="elective-picker control-card">
          <div>
            <strong>Add electives</strong>
            <small>Electives appear in their own map filter and can be pulled into the graduation plan.</small>
          </div>

          <div className="token-list">
            {electiveOptions.map((course) => {
              const active = selectedElectiveCodes.includes(course.code);
              return (
                <button
                  key={course.code}
                  type="button"
                  className={`token-button ${active ? "is-active" : ""}`}
                  onClick={() => onToggleElective(course.code)}
                >
                  {course.code}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
