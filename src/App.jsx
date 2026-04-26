import { useEffect, useMemo, useState } from "react";
import CollegeMajorSelector from "./components/CollegeMajorSelector";
import CompletedCourses from "./components/CompletedCourses";
import CourseDetail from "./components/CourseDetail";
import DependencyGraph from "./components/DependencyGraph";
import SemesterPlan from "./components/SemesterPlan";
import WhatIfPanel from "./components/WhatIfPanel";
import { DATASET_OPTIONS, getDatasetById } from "./data/datasetRegistry";
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

export default function App() {
  const savedState = useMemo(() => loadSavedState(), []);
  const [datasetId, setDatasetId] = useState(savedState?.datasetId ?? DATASET_OPTIONS[0].id);
  const selectedDataset = useMemo(() => getDatasetById(datasetId), [datasetId]);
  const [remoteDatasetData, setRemoteDatasetData] = useState(selectedDataset.data ?? null);
  const [datasetLoadState, setDatasetLoadState] = useState({
    status: selectedDataset.loadData ? "loading" : "ready",
    message: "",
  });

  useEffect(() => {
    let cancelled = false;

    if (!selectedDataset.loadData) {
      setRemoteDatasetData(selectedDataset.data ?? null);
      setDatasetLoadState({ status: "ready", message: "" });
      return () => {
        cancelled = true;
      };
    }

    setRemoteDatasetData(null);
    setDatasetLoadState({ status: "loading", message: "Refreshing the latest catalog..." });

    selectedDataset
      .loadData()
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
          message: "The current catalog could not be refreshed, so the planner is showing the built-in catalog for now.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDataset]);

  const rawDataset = useMemo(
    () => resolveDatasetData(selectedDataset, remoteDatasetData),
    [remoteDatasetData, selectedDataset],
  );
  const catalog = useMemo(() => createCatalog(rawDataset), [rawDataset]);

  const [college, setCollege] = useState(savedState?.college ?? catalog.source.college);
  const [major, setMajor] = useState(savedState?.major ?? catalog.source.major);
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

  useEffect(() => {
    setCollege(catalog.source.college);
    setMajor(catalog.source.major);
  }, [catalog.source.college, catalog.source.major]);

  useEffect(() => {
    setCompletedCodes((current) => current.filter((code) => catalog.courseMap[code]));
    setSelectedElectiveCodes((current) => current.filter((code) => catalog.courseMap[code]));
    setSelectedCourseCode((current) =>
      current && catalog.courseMap[current] ? current : catalog.planCourseCodes[0] ?? null,
    );
    setActiveScenarioKey(null);
  }, [catalog.courseMap, catalog.planCourseCodes]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        datasetId,
        college,
        major,
        completedCodes,
        includeSummer,
        maxCredits,
        selectedElectiveCodes,
        selectedCourseCode,
        activeScenarioKey,
      }),
    );
  }, [
    datasetId,
    college,
    major,
    completedCodes,
    includeSummer,
    maxCredits,
    selectedElectiveCodes,
    selectedCourseCode,
    activeScenarioKey,
  ]);

  const statuses = useMemo(
    () => getCourseStatuses(catalog.courses, completedCodes),
    [catalog.courses, completedCodes],
  );

  const graph = useMemo(
    () => buildGraphLayout(catalog.courses, catalog.courseMap, catalog.planCourseCodes),
    [catalog.courses, catalog.courseMap, catalog.planCourseCodes],
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
      }),
    [
      catalog.courses,
      catalog.courseMap,
      catalog.planCourseCodes,
      completedCodes,
      selectedElectiveCodes,
      includeSummer,
      maxCredits,
    ],
  );

  const trackedCredits = useMemo(
    () =>
      catalog.planCourseCodes.reduce(
        (sum, code) => sum + (completedCodes.includes(code) ? catalog.courseMap[code]?.credits ?? 0 : 0),
        0,
      ),
    [catalog.courseMap, catalog.planCourseCodes, completedCodes],
  );
  const completedTrackedCount = useMemo(
    () => catalog.planCourseCodes.filter((code) => completedCodes.includes(code)).length,
    [catalog.planCourseCodes, completedCodes],
  );
  const activeSemesterCount = useMemo(
    () => plan.semesters.filter((semester) => semester.courses.length).length,
    [plan.semesters],
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
    setActiveScenarioKey(null);
  }

  function toggleElective(code) {
    setSelectedElectiveCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
    setActiveScenarioKey(null);
  }

  function applyScenario(key) {
    const scenario = demoScenarios[key];
    if (!scenario) {
      return;
    }

    const nextRecommendedCode =
      catalog.planCourseCodes.find((code) => !scenario.completed.includes(code)) ??
      scenario.completed[scenario.completed.length - 1] ??
      catalog.planCourseCodes[0] ??
      null;

    setCompletedCodes([...scenario.completed]);
    setIncludeSummer(false);
    setMaxCredits(15);
    setSelectedElectiveCodes([]);
    setSelectedCourseCode(nextRecommendedCode);
    setActiveScenarioKey(key);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="hero-content">
          <div className="hero-kicker-row">
            <p className="eyebrow">CUNYPath</p>
            <span className="hero-tag">Hunter College</span>
          </div>
          <h1>Build the clearest path to graduation.</h1>
          <p className="hero-copy">
            Mark what you have already finished, uncover the hidden gates in the curriculum, and
            see a semester plan that keeps momentum instead of surprises.
          </p>
          <div className="hero-highlights">
            <span>Interactive prerequisite map</span>
            <span>Semester-by-semester plan</span>
            <span>What-if scheduling controls</span>
          </div>
          {datasetLoadState?.message ? (
            <p className={`hero-status is-${datasetLoadState.status}`}>{datasetLoadState.message}</p>
          ) : null}
        </div>

        <div className="hero-metrics">
          <div className="metric-card metric-strong">
            <span className="metric-label">Catalog courses</span>
            <strong>{catalog.courses.length}</strong>
            <span>available in this planning view</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Roadmap progress</span>
            <strong>
              {completedTrackedCount}/{catalog.planCourseCodes.length}
            </strong>
            <span>planner courses marked complete</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Projected finish</span>
            <strong>{plan.projectedGraduation}</strong>
            <span>{activeSemesterCount} active terms in the current plan</span>
          </div>
        </div>
      </header>

      <main className="dashboard">
        <section className="dashboard-sidebar">
          <CollegeMajorSelector
            datasetId={datasetId}
            datasetOptions={DATASET_OPTIONS}
            onDatasetChange={setDatasetId}
            college={college}
            major={major}
            onCollegeChange={setCollege}
            onMajorChange={setMajor}
            datasetStatus={datasetLoadState}
          />

          <section className="panel scenario-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Starting points</p>
                <h2>Jump to a realistic snapshot</h2>
              </div>
            </div>

            <div className="scenario-actions">
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

          <WhatIfPanel
            includeSummer={includeSummer}
            onIncludeSummerChange={setIncludeSummer}
            maxCredits={maxCredits}
            onMaxCreditsChange={setMaxCredits}
            electiveOptions={catalog.electiveOptions.map((code) => catalog.courseMap[code]).filter(Boolean)}
            selectedElectiveCodes={selectedElectiveCodes}
            onToggleElective={toggleElective}
          />
        </section>

        <section className="dashboard-main">
          <DependencyGraph
            graph={graph}
            statuses={statuses}
            selectedCode={selectedCourseCode}
            emphasizedCodes={[...catalog.planCourseCodes, ...selectedElectiveCodes]}
            onSelectCourse={setSelectedCourseCode}
          />

          <SemesterPlan plan={plan} />
        </section>

        <section className="dashboard-rail">
          <CourseDetail
            course={selectedCourse}
            status={selectedCourse ? statuses[selectedCourse.code] : ""}
            inPlan={selectedCourse ? catalog.planCourseCodes.includes(selectedCourse.code) : false}
          />
        </section>
      </main>

      <section className="dashboard-lower">
        <CompletedCourses
          groups={catalog.groupedCourses}
          completedCodes={completedCodes}
          onSetCourseCompleted={setCourseCompleted}
          trackedCredits={trackedCredits}
          trackedCourseCount={catalog.planCourseCodes.length}
          planCourseCodes={catalog.planCourseCodes}
        />
      </section>
    </div>
  );
}
