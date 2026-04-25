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
          <p className="eyebrow">What-if</p>
          <h2>Planning controls</h2>
        </div>
      </div>

      <div className="what-if-stack">
        <label className="toggle-row">
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

        <div className="credit-control">
          <div>
            <strong>Credit load</strong>
            <small>Adjust between part-time and a heavier full-time schedule.</small>
          </div>
          <div className="credit-segments">
            {[9, 12, 15].map((value) => (
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

        <div className="elective-picker">
          <div>
            <strong>Try adding electives</strong>
            <small>We keep the required path stable and layer electives into the plan.</small>
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
