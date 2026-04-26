import { useEffect, useMemo, useState } from "react";
import AuthPanel from "./components/AuthPanel";
import CollegeMajorSelector from "./components/CollegeMajorSelector";
import CompletedCourses from "./components/CompletedCourses";
import CourseDetail from "./components/CourseDetail";
import DependencyGraph from "./components/DependencyGraph";
import SemesterPlan from "./components/SemesterPlan";
import WhatIfPanel from "./components/WhatIfPanel";
import { DATASET_OPTIONS, getDatasetById } from "./data/datasetRegistry";
import { createCatalog, demoScenarios } from "./lib/catalog";
import { buildGraphLayout, generateSemesterPlan, getCourseStatuses } from "./lib/planner";
import { supabase } from "./lib/supabaseClient";

const STORAGE_KEY = "cunypath-front-end-state";
const SAVE_STATUS_RESET_DELAY = 2200;
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

function getLocalSavedState() {
  return loadSavedState();
}

function getTimeValue(value) {
  const time = Date.parse(value ?? "");
  return Number.isFinite(time) ? time : 0;
}

function normalizePlannerForCompare(plannerState) {
  if (!plannerState) {
    return null;
  }

  return {
    datasetId: plannerState.datasetId ?? DATASET_OPTIONS[0].id,
    college: plannerState.college ?? "",
    major: plannerState.major ?? "",
    completedCodes: [...(plannerState.completedCodes ?? [])].sort(),
    includeSummer: Boolean(plannerState.includeSummer),
    maxCredits: plannerState.maxCredits ?? 15,
    selectedElectiveCodes: [...(plannerState.selectedElectiveCodes ?? [])].sort(),
    selectedCourseCode: plannerState.selectedCourseCode ?? null,
    activeScenarioKey: plannerState.activeScenarioKey ?? null,
  };
}

function plannerStatesMatch(left, right) {
  return JSON.stringify(normalizePlannerForCompare(left)) === JSON.stringify(normalizePlannerForCompare(right));
}

function serializePlannerState({
  datasetId,
  college,
  major,
  completedCodes,
  includeSummer,
  maxCredits,
  selectedElectiveCodes,
  selectedCourseCode,
  activeScenarioKey,
}) {
  return {
    datasetId,
    college,
    major,
    completedCodes,
    includeSummer,
    maxCredits,
    selectedElectiveCodes,
    selectedCourseCode,
    activeScenarioKey,
  };
}

function serializeLocalPlannerState(plannerState) {
  return {
    ...plannerState,
    localUpdatedAt: new Date().toISOString(),
  };
}

function toPlannerStateRow(userId, plannerState) {
  return {
    user_id: userId,
    dataset_id: plannerState.datasetId,
    college: plannerState.college,
    major: plannerState.major,
    completed_codes: plannerState.completedCodes,
    selected_elective_codes: plannerState.selectedElectiveCodes,
    selected_course_code: plannerState.selectedCourseCode,
    include_summer: plannerState.includeSummer,
    max_credits: plannerState.maxCredits,
    active_scenario_key: plannerState.activeScenarioKey,
    updated_at: new Date().toISOString(),
  };
}

function fromPlannerStateRow(row) {
  return {
    datasetId: row.dataset_id,
    college: row.college,
    major: row.major,
    completedCodes: row.completed_codes ?? [],
    includeSummer: row.include_summer,
    maxCredits: row.max_credits,
    selectedElectiveCodes: row.selected_elective_codes ?? [],
    selectedCourseCode: row.selected_course_code,
    activeScenarioKey: row.active_scenario_key,
  };
}

function applyPlannerState({
  plannerState,
  setDatasetId,
  setCollege,
  setMajor,
  setCompletedCodes,
  setIncludeSummer,
  setMaxCredits,
  setSelectedElectiveCodes,
  setSelectedCourseCode,
  setActiveScenarioKey,
}) {
  setDatasetId(plannerState.datasetId ?? DATASET_OPTIONS[0].id);
  setCollege(plannerState.college ?? "");
  setMajor(plannerState.major ?? "");
  setCompletedCodes(plannerState.completedCodes ?? []);
  setIncludeSummer(Boolean(plannerState.includeSummer));
  setMaxCredits(plannerState.maxCredits ?? 15);
  setSelectedElectiveCodes(plannerState.selectedElectiveCodes ?? []);
  setSelectedCourseCode(plannerState.selectedCourseCode ?? null);
  setActiveScenarioKey(plannerState.activeScenarioKey ?? null);
}

export default function App() {
  const savedState = useMemo(() => loadSavedState(), []);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [remoteStateLoadedFor, setRemoteStateLoadedFor] = useState(null);
  const [pendingSyncChoice, setPendingSyncChoice] = useState(null);
  const [saveStatus, setSaveStatus] = useState("Local only");
  const [saveError, setSaveError] = useState("");
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
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) {
          return;
        }

        if (error) {
          setAuthError(error.message);
        }

        setAuthUser(data.session?.user ?? null);
        setAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
      setAuthError("");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authUser) {
      setRemoteStateLoadedFor(null);
      setPendingSyncChoice(null);
      setSaveStatus("Local only");
      setSaveError("");
      return;
    }

    let cancelled = false;
    setSaveStatus("Loading saved plan...");
    setSaveError("");

    supabase
      .from("user_planner_states")
      .select("*")
      .eq("user_id", authUser.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) {
          return;
        }

        if (error) {
          setSaveError(error.message);
          setSaveStatus("Save unavailable");
          setRemoteStateLoadedFor(authUser.id);
          return;
        }

        if (data) {
          const localState = getLocalSavedState();
          const remoteState = fromPlannerStateRow(data);
          const localUpdatedAt = getTimeValue(localState?.localUpdatedAt);
          const hasLocalConflict = localUpdatedAt > 0 && !plannerStatesMatch(localState, remoteState);

          if (hasLocalConflict) {
            setPendingSyncChoice({ localState, remoteState });
            setSaveStatus("Choose plan source");
            return;
          }

          applyPlannerState({
            plannerState: remoteState,
            setDatasetId,
            setCollege,
            setMajor,
            setCompletedCodes,
            setIncludeSummer,
            setMaxCredits,
            setSelectedElectiveCodes,
            setSelectedCourseCode,
            setActiveScenarioKey,
          });
          setSaveStatus("Saved plan loaded");
        } else {
          setSaveStatus("Ready to save");
        }

        setRemoteStateLoadedFor(authUser.id);
      });

    return () => {
      cancelled = true;
    };
  }, [authUser]);

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
    const plannerState = serializePlannerState({
        datasetId,
        college,
        major,
        completedCodes,
        includeSummer,
        maxCredits,
        selectedElectiveCodes,
        selectedCourseCode,
        activeScenarioKey,
      });

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeLocalPlannerState(plannerState)));
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

  useEffect(() => {
    if (!authUser || remoteStateLoadedFor !== authUser.id) {
      return undefined;
    }

    const plannerState = serializePlannerState({
      datasetId,
      college,
      major,
      completedCodes,
      includeSummer,
      maxCredits,
      selectedElectiveCodes,
      selectedCourseCode,
      activeScenarioKey,
    });

    const timeoutId = window.setTimeout(() => {
      setSaveStatus("Saving...");
      setSaveError("");

      supabase
        .from("user_planner_states")
        .upsert(toPlannerStateRow(authUser.id, plannerState), { onConflict: "user_id" })
        .then(({ error }) => {
          if (error) {
            setSaveError(error.message);
            setSaveStatus("Save failed");
            return;
          }

          setSaveStatus("Saved");
          window.setTimeout(() => {
            setSaveStatus("Saved to account");
          }, SAVE_STATUS_RESET_DELAY);
        });
    }, 600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    authUser,
    remoteStateLoadedFor,
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

  function useLocalPlanForAccount() {
    if (!authUser || !pendingSyncChoice?.localState) {
      return;
    }

    setPendingSyncChoice(null);
    setSaveStatus("Saving local plan...");
    setRemoteStateLoadedFor(authUser.id);
  }

  function loadAccountPlan() {
    if (!authUser || !pendingSyncChoice?.remoteState) {
      return;
    }

    applyPlannerState({
      plannerState: pendingSyncChoice.remoteState,
      setDatasetId,
      setCollege,
      setMajor,
      setCompletedCodes,
      setIncludeSummer,
      setMaxCredits,
      setSelectedElectiveCodes,
      setSelectedCourseCode,
      setActiveScenarioKey,
    });
    setPendingSyncChoice(null);
    setRemoteStateLoadedFor(authUser.id);
    setSaveStatus("Saved plan loaded");
  }

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

  async function signInWithGoogle() {
    setAuthLoading(true);
    setAuthError("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
    }
  }

  async function signOut() {
    setAuthLoading(true);
    setAuthError("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message);
    } else {
      setAuthUser(null);
    }

    setAuthLoading(false);
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
          <AuthPanel
            user={authUser}
            loading={authLoading}
            error={authError}
            saveStatus={saveStatus}
            saveError={saveError}
            pendingSyncChoice={Boolean(pendingSyncChoice)}
            onUseLocalPlan={useLocalPlanForAccount}
            onLoadAccountPlan={loadAccountPlan}
            onSignIn={signInWithGoogle}
            onSignOut={signOut}
          />
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
