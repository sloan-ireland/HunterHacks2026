import { useMemo, useState } from "react";

const ELECTIVES_PER_PAGE = 5;

export default function WhatIfPanel({
  includeSummer,
  onIncludeSummerChange,
  maxCredits,
  onMaxCreditsChange,
  electiveOptions,
  selectedElectiveCodes,
  onToggleElective,
}) {
  const [activePage, setActivePage] = useState(0);
  const electivePages = useMemo(() => {
    const pages = [];

    for (let index = 0; index < electiveOptions.length; index += ELECTIVES_PER_PAGE) {
      pages.push(electiveOptions.slice(index, index + ELECTIVES_PER_PAGE));
    }

    return pages;
  }, [electiveOptions]);

  const clampedPage = Math.min(activePage, Math.max(electivePages.length - 1, 0));
  const visibleElectives = electivePages[clampedPage] ?? [];
  const tabWindowStart = Math.max(0, Math.min(clampedPage - 1, Math.max(electivePages.length - 4, 0)));
  const visiblePageTabs = electivePages.slice(tabWindowStart, tabWindowStart + 4);

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

          {electivePages.length > 1 ? (
            <div className="elective-page-shell">
              <div className="elective-page-header">
                <strong>Elective page {clampedPage + 1}</strong>
                <span>
                  {visibleElectives.length} of {electiveOptions.length} visible
                </span>
              </div>
              <div className="elective-page-tabs" role="tablist" aria-label="Elective pages">
                <button
                  type="button"
                  className="elective-page-nav"
                  onClick={() => setActivePage((current) => Math.max(current - 1, 0))}
                  disabled={clampedPage === 0}
                >
                  Prev
                </button>
                {visiblePageTabs.map((page, index) => {
                  const pageIndex = tabWindowStart + index;
                  return (
                    <button
                      key={`elective-page-${pageIndex}`}
                      type="button"
                      className={clampedPage === pageIndex ? "is-active" : ""}
                      onClick={() => setActivePage(pageIndex)}
                    >
                      {page[0]?.code?.split(" ")[1] ?? pageIndex * ELECTIVES_PER_PAGE + 1}
                      {" - "}
                      {page.at(-1)?.code?.split(" ")[1] ?? (pageIndex + 1) * ELECTIVES_PER_PAGE}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="elective-page-nav"
                  onClick={() =>
                    setActivePage((current) => Math.min(current + 1, Math.max(electivePages.length - 1, 0)))
                  }
                  disabled={clampedPage >= electivePages.length - 1}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}

          <div className="token-list">
            {visibleElectives.map((course) => {
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
