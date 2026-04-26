import { useEffect, useMemo, useState } from "react";
import CollegeMajorSelector from "./components/CollegeMajorSelector";
import CompletedCourses from "./components/CompletedCourses";
import CourseDetail from "./components/CourseDetail";
import DependencyGraph from "./components/DependencyGraph";
import SemesterPlan from "./components/SemesterPlan";
import WhatIfPanel from "./components/WhatIfPanel";
import { DATASET_OPTIONS } from "./data/datasetRegistry";
import { createCatalog, demoScenarios } from "./lib/catalog";
import { buildGraphLayout, generateSemesterPlan, getCourseStatuses } from "./lib/planner";

const STORAGE_KEY = "cunypath-front-end-state";
const EMPTY_DATASET = {
  source: {
    college: "Hunter College",
    major: "Computer Science BA",
    implementation: "Loading dataset",
    programUrl: "#",
  },
  program: {
    planCode: "EMPTY",
    longName: "Loading dataset",
    degreeDesignation: "BA - Bachelor of Arts",
    creditsRequired: 0,
  },
  planCourseCodes: [],
  electiveOptions: [],
  courses: [],
};

const CURRENT_DATASET = DATASET_OPTIONS[0];
const SCENARIO_TERM_COUNTS = {
  freshman: 8,
  sophomore: 6,
  junior: 4,
  senior: 2,
  transfer: 6,
};
const DEFAULT_TIMELINE_TERMS = 4;

function loadSavedState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function resolveDatasetData(dataset, remoteData) {
  return remoteData ?? dataset.data ?? dataset.fallbackData ?? EMPTY_DATASET;
}

function buildRoadmapCodes(planCourseCodes, selectedElectiveCodes) {
  return [...new Set([...planCourseCodes, ...selectedElectiveCodes])];
}

export default function App() {
  const savedState = useMemo(() => loadSavedState(), []);
  const [remoteDatasetData, setRemoteDatasetData] = useState(CURRENT_DATASET.data ?? null);
  const [datasetLoadState, setDatasetLoadState] = useState({
    status: CURRENT_DATASET.loadData ? "loading" : "ready",
    message: "",
  });

  useEffect(() => {
    let cancelled = false;

    if (!CURRENT_DATASET.loadData) {
      setRemoteDatasetData(CURRENT_DATASET.data ?? null);
      setDatasetLoadState({ status: "ready", message: "" });
      return () => {
        cancelled = true;
      };
    }

    setRemoteDatasetData(null);
    setDatasetLoadState({ status: "loading", message: "Refreshing the latest catalog..." });

    CURRENT_DATASET.loadData()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setRemoteDatasetData(data);
        setDatasetLoadState({
          status: "ready",
          message: data.datasetStatusMessage ?? "Current catalog loaded.",
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.error(error);
        setRemoteDatasetData(null);
        setDatasetLoadState({
          status: "error",
          message:
            "The current catalog could not be refreshed, so the planner is showing the built-in catalog for now.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const rawDataset = useMemo(
    () => resolveDatasetData(CURRENT_DATASET, remoteDatasetData),
    [remoteDatasetData],
  );
  const catalog = useMemo(() => createCatalog(rawDataset), [rawDataset]);

  const [completedCodes, setCompletedCodes] = useState(savedState?.completedCodes ?? []);
  const [includeSummer, setIncludeSummer] = useState(savedState?.includeSummer ?? false);
  const [maxCredits, setMaxCredits] = useState(savedState?.maxCredits ?? 15);
  const [selectedElectiveCodes, setSelectedElectiveCodes] = useState(
    savedState?.selectedElectiveCodes ?? [],
  );
  const [selectedCourseCode, setSelectedCourseCode] = useState(
    savedState?.selectedCourseCode ?? catalog.planCourseCodes[0] ?? null,
  );
  const [activeScenarioKey, setActiveScenarioKey] = useState(savedState?.activeScenarioKey ?? null);
  const [timelineTermCount, setTimelineTermCount] = useState(
    savedState?.timelineTermCount ??
      SCENARIO_TERM_COUNTS[savedState?.activeScenarioKey] ??
      DEFAULT_TIMELINE_TERMS,
  );

  useEffect(() => {
    setCompletedCodes((current) => current.filter((code) => catalog.courseMap[code]));
    setSelectedElectiveCodes((current) => current.filter((code) => catalog.courseMap[code]));
    setSelectedCourseCode((current) =>
      current && catalog.courseMap[current] ? current : catalog.planCourseCodes[0] ?? null,
    );
  }, [catalog.courseMap, catalog.planCourseCodes]);

  useEffect(() => {
    const expectedTimelineTermCount = activeScenarioKey
      ? SCENARIO_TERM_COUNTS[activeScenarioKey] ?? DEFAULT_TIMELINE_TERMS
      : DEFAULT_TIMELINE_TERMS;

    if (timelineTermCount !== expectedTimelineTermCount) {
      setTimelineTermCount(expectedTimelineTermCount);
    }
  }, [activeScenarioKey, timelineTermCount]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        completedCodes,
        includeSummer,
        maxCredits,
        selectedElectiveCodes,
        selectedCourseCode,
        activeScenarioKey,
        timelineTermCount,
      }),
    );
  }, [
    completedCodes,
    includeSummer,
    maxCredits,
    selectedElectiveCodes,
    selectedCourseCode,
    activeScenarioKey,
    timelineTermCount,
  ]);

  const roadmapCourseCodes = useMemo(
    () => buildRoadmapCodes(catalog.planCourseCodes, selectedElectiveCodes),
    [catalog.planCourseCodes, selectedElectiveCodes],
  );

  const statuses = useMemo(
    () => getCourseStatuses(catalog.courses, completedCodes),
    [catalog.courses, completedCodes],
  );

  const graph = useMemo(
    () => buildGraphLayout(catalog.courses, catalog.courseMap, roadmapCourseCodes),
    [catalog.courses, catalog.courseMap, roadmapCourseCodes],
  );

  const plan = useMemo(
    () =>
      generateSemesterPlan({
        courses: catalog.courses,
        courseMap: catalog.courseMap,
        completedCodes,
        planCourseCodes: catalog.planCourseCodes,
        selectedElectiveCodes,
        includeSummer,
        maxCredits,
        targetSemesterCount: timelineTermCount,
      }),
    [
      catalog.courses,
      catalog.courseMap,
      catalog.planCourseCodes,
      completedCodes,
      selectedElectiveCodes,
      includeSummer,
      maxCredits,
      timelineTermCount,
    ],
  );

  const trackedCredits = useMemo(
    () =>
      roadmapCourseCodes.reduce(
        (sum, code) => sum + (completedCodes.includes(code) ? catalog.courseMap[code]?.credits ?? 0 : 0),
        0,
      ),
    [catalog.courseMap, roadmapCourseCodes, completedCodes],
  );
  const completedTrackedCount = useMemo(
    () => roadmapCourseCodes.filter((code) => completedCodes.includes(code)).length,
    [roadmapCourseCodes, completedCodes],
  );
  const totalCreditsRequired = catalog.program.creditsRequired || 120;
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round((trackedCredits / Math.max(totalCreditsRequired, 1)) * 100)),
  );

  const selectedCourse = selectedCourseCode ? catalog.courseMap[selectedCourseCode] ?? null : null;

  function setCourseCompleted(code, nextChecked) {
    setCompletedCodes((current) => {
      const currentSet = new Set(current);

      if (nextChecked) {
        currentSet.add(code);
      } else {
        currentSet.delete(code);
      }

      return [...currentSet];
    });
    setSelectedCourseCode(code);
  }

  function toggleElective(code) {
    setSelectedElectiveCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
    setSelectedCourseCode(code);
  }

  function applyScenario(key) {
    const scenario = demoScenarios[key];
    if (!scenario) {
      return;
    }

    const nextRecommendedCode =
      roadmapCourseCodes.find((code) => !scenario.completed.includes(code)) ??
      scenario.completed[scenario.completed.length - 1] ??
      roadmapCourseCodes[0] ??
      null;

    setCompletedCodes([...scenario.completed]);
    setIncludeSummer(false);
    setMaxCredits(15);
    setSelectedElectiveCodes([]);
    setSelectedCourseCode(nextRecommendedCode);
    setActiveScenarioKey(key);
    setTimelineTermCount(SCENARIO_TERM_COUNTS[key] ?? DEFAULT_TIMELINE_TERMS);
  }

  return (
    <div className="app-shell app-shell-immersive">
      <header className="topbar">
        <div className="topbar-brand-row">
          <button type="button" className="topbar-icon-button" aria-label="Open navigation">
            <span />
            <span />
            <span />
          </button>
          <div className="brand-lockup">
            <strong className="brand-cuny">CUNY</strong>
            <strong className="brand-path">Path</strong>
          </div>
        </div>

        <div className="topbar-selects">
          <div className="topbar-select-card">
            <span>College</span>
            <strong>{catalog.source.college}</strong>
          </div>
          <div className="topbar-select-card">
            <span>Major</span>
            <strong>{catalog.source.major}</strong>
          </div>
        </div>

        <div className="topbar-actions">
          <button type="button" className="topbar-link">Help</button>
          <button type="button" className="topbar-link">My Profile</button>
        </div>
      </header>

      <main className="workspace-layout">
        <aside className="left-rail">
          <CollegeMajorSelector
            catalogLabel={CURRENT_DATASET.label}
            college={catalog.source.college}
            major={catalog.source.major}
            datasetStatus={datasetLoadState}
          />

          <WhatIfPanel
            includeSummer={includeSummer}
            onIncludeSummerChange={setIncludeSummer}
            maxCredits={maxCredits}
            onMaxCreditsChange={setMaxCredits}
            electiveOptions={catalog.electiveOptions.map((code) => catalog.courseMap[code]).filter(Boolean)}
            selectedElectiveCodes={selectedElectiveCodes}
            onToggleElective={toggleElective}
          />

          <CompletedCourses
            groups={catalog.groupedCourses}
            completedCodes={completedCodes}
            onSetCourseCompleted={setCourseCompleted}
            trackedCredits={trackedCredits}
            trackedCourseCount={roadmapCourseCodes.length}
            planCourseCodes={roadmapCourseCodes}
            degreeCreditsRequired={totalCreditsRequired}
            progressPercent={progressPercent}
            onSelectCourse={setSelectedCourseCode}
          />
        </aside>

        <section className="planner-workspace">
          <div className="workspace-summary-row">
            <div className="summary-pill">
              <span>Credits completed</span>
              <strong>
                {trackedCredits} / {totalCreditsRequired}
              </strong>
            </div>
            <div className="summary-pill">
              <span>Roadmap courses</span>
              <strong>
                {completedTrackedCount} / {roadmapCourseCodes.length}
              </strong>
            </div>
            <div className="summary-pill summary-pill-emphasis">
              <span>Projected graduation</span>
              <strong>{plan.projectedGraduation}</strong>
            </div>
          </div>

          <div className="map-detail-grid">
            <DependencyGraph
              graph={graph}
              statuses={statuses}
              selectedCode={selectedCourseCode}
              emphasizedCodes={roadmapCourseCodes}
              onSelectCourse={setSelectedCourseCode}
            />

            <CourseDetail
              course={selectedCourse}
              status={selectedCourse ? statuses[selectedCourse.code] : ""}
              inPlan={selectedCourse ? roadmapCourseCodes.includes(selectedCourse.code) : false}
              courseMap={catalog.courseMap}
            />
          </div>

          <section className="panel scenario-panel scenario-panel-inline">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Snapshots</p>
                <h2>Jump to a starting point</h2>
              </div>
              <span className="panel-chip">Timeline: {plan.semesters.length} terms</span>
            </div>

            <div className="scenario-actions scenario-actions-inline">
              {Object.entries(demoScenarios).map(([key, scenario]) => (
                <button
                  key={key}
                  type="button"
                  className={activeScenarioKey === key ? "is-active" : ""}
                  aria-pressed={activeScenarioKey === key}
                  onClick={() => applyScenario(key)}
                >
                  {scenario.label}
                </button>
              ))}
            </div>
          </section>

          <SemesterPlan
            plan={plan}
            courseMap={catalog.courseMap}
            roadmapCourseCodes={roadmapCourseCodes}
            completedCodes={completedCodes}
            maxCredits={maxCredits}
            onSelectCourse={setSelectedCourseCode}
          />
        </section>
      </main>
    </div>
  );
}

