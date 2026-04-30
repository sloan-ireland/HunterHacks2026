import { useEffect, useMemo, useRef, useState } from "react";
import AuthPanel from "./components/AuthPanel";
import CollegeMajorSelector from "./components/CollegeMajorSelector";
import CompletedCourses from "./components/CompletedCourses";
import CourseDetail from "./components/CourseDetail";
import DependencyGraph from "./components/DependencyGraph";
import SemesterPlan from "./components/SemesterPlan";
import WhatIfPanel from "./components/WhatIfPanel";
import { DATASET_OPTIONS } from "./data/datasetRegistry";
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

const CURRENT_DATASET = DATASET_OPTIONS[0];
const SCENARIO_TERM_COUNTS = {
  freshman: 8,
  sophomore: 6,
  junior: 4,
  senior: 2,
  transfer: 6,
};
const DEFAULT_TIMELINE_TERMS = 4;
const OAUTH_URL_KEYS = [
  "access_token",
  "code",
  "error",
  "error_code",
  "error_description",
  "expires_at",
  "expires_in",
  "provider_token",
  "refresh_token",
  "token_type",
  "type",
];

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

function getTimeValue(value) {
  const time = Date.parse(value ?? "");
  return Number.isFinite(time) ? time : 0;
}

function normalizePlannerForCompare(plannerState) {
  if (!plannerState) {
    return null;
  }

  return {
    datasetId: plannerState.datasetId ?? CURRENT_DATASET.id,
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

function serializeLocalPlannerState(plannerState, timelineTermCount) {
  return {
    ...plannerState,
    timelineTermCount,
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

function getTimelineCountForScenario(activeScenarioKey) {
  return activeScenarioKey
    ? SCENARIO_TERM_COUNTS[activeScenarioKey] ?? DEFAULT_TIMELINE_TERMS
    : DEFAULT_TIMELINE_TERMS;
}

function getOAuthRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function readAuthCallbackState() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const params = new Map();

  for (const key of OAUTH_URL_KEYS) {
    const searchValue = searchParams.get(key);
    const hashValue = hashParams.get(key);

    if (searchValue) {
      params.set(key, searchValue);
    } else if (hashValue) {
      params.set(key, hashValue);
    }
  }

  return {
    hasAuthParams: params.size > 0,
    errorDescription: params.get("error_description") ?? params.get("error") ?? "",
  };
}

function applyPlannerState({
  plannerState,
  setCompletedCodes,
  setIncludeSummer,
  setMaxCredits,
  setSelectedElectiveCodes,
  setSelectedCourseCode,
  setActiveScenarioKey,
  setTimelineTermCount,
}) {
  setCompletedCodes(plannerState.completedCodes ?? []);
  setIncludeSummer(Boolean(plannerState.includeSummer));
  setMaxCredits(plannerState.maxCredits ?? 15);
  setSelectedElectiveCodes(plannerState.selectedElectiveCodes ?? []);
  setSelectedCourseCode(plannerState.selectedCourseCode ?? null);
  setActiveScenarioKey(plannerState.activeScenarioKey ?? null);
  setTimelineTermCount(getTimelineCountForScenario(plannerState.activeScenarioKey));
}

export default function App() {
  const savedState = useMemo(() => loadSavedState(), []);
  const authCallbackState = useMemo(() => readAuthCallbackState(), []);
  const [remoteDatasetData, setRemoteDatasetData] = useState(CURRENT_DATASET.data ?? null);
  const [datasetLoadState, setDatasetLoadState] = useState({
    status: CURRENT_DATASET.loadData ? "loading" : "ready",
    message: "",
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [remoteStateLoadedFor, setRemoteStateLoadedFor] = useState(null);
  const [pendingSyncChoice, setPendingSyncChoice] = useState(null);
  const [saveStatus, setSaveStatus] = useState("Local only");
  const [saveError, setSaveError] = useState("");
  const setupRef = useRef(null);
  const controlsRef = useRef(null);
  const progressRef = useRef(null);
  const degreeMapRef = useRef(null);
  const snapshotsRef = useRef(null);
  const timelineRef = useRef(null);

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
  const [editedSemesters, setEditedSemesters] = useState(null);
  const [timelineTermCount, setTimelineTermCount] = useState(
    savedState?.timelineTermCount ??
      getTimelineCountForScenario(savedState?.activeScenarioKey),
  );

  useEffect(() => {
    let mounted = true;

    if (authCallbackState.hasAuthParams) {
      setProfileOpen(true);
    }

    if (authCallbackState.errorDescription) {
      setAuthError(decodeURIComponent(authCallbackState.errorDescription));
    }

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
    } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);

      if (event === "SIGNED_IN") {
        setAuthError("");
        setProfileOpen(true);
        setSaveStatus("Connected to account");
      }

      if (event === "SIGNED_OUT") {
        setAuthError("");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setCompletedCodes((current) => current.filter((code) => catalog.courseMap[code]));
    setSelectedElectiveCodes((current) => current.filter((code) => catalog.courseMap[code]));
    setSelectedCourseCode((current) =>
      current && catalog.courseMap[current] ? current : catalog.planCourseCodes[0] ?? null,
    );
  }, [catalog.courseMap, catalog.planCourseCodes]);

  useEffect(() => {
    const expectedTimelineTermCount = getTimelineCountForScenario(activeScenarioKey);

    if (timelineTermCount !== expectedTimelineTermCount) {
      setTimelineTermCount(expectedTimelineTermCount);
    }
  }, [activeScenarioKey, timelineTermCount]);

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
          const localState = loadSavedState();
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
            setCompletedCodes,
            setIncludeSummer,
            setMaxCredits,
            setSelectedElectiveCodes,
            setSelectedCourseCode,
            setActiveScenarioKey,
            setTimelineTermCount,
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

  const plannerState = useMemo(
    () =>
      serializePlannerState({
        datasetId: CURRENT_DATASET.id,
        college: catalog.source.college,
        major: catalog.source.major,
        completedCodes,
        includeSummer,
        maxCredits,
        selectedElectiveCodes,
        selectedCourseCode,
        activeScenarioKey,
      }),
    [
      activeScenarioKey,
      catalog.source.college,
      catalog.source.major,
      completedCodes,
      includeSummer,
      maxCredits,
      selectedCourseCode,
      selectedElectiveCodes,
    ],
  );

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(serializeLocalPlannerState(plannerState, timelineTermCount)),
    );
  }, [plannerState, timelineTermCount]);

  useEffect(() => {
    if (!authUser || remoteStateLoadedFor !== authUser.id) {
      return undefined;
    }

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
  }, [authUser, plannerState, remoteStateLoadedFor]);

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
        startingTerm: catalog.planningStartTerm,
      }),
    [
      catalog.courses,
      catalog.courseMap,
      catalog.planningStartTerm,
      catalog.planCourseCodes,
      completedCodes,
      selectedElectiveCodes,
      includeSummer,
      maxCredits,
      timelineTermCount,
    ],
  );

  const planSeed = useMemo(
    () =>
      JSON.stringify(
        plan.semesters.map((semester) => ({
          id: semester.id,
          credits: semester.credits,
          codes: semester.courses.map((course) => course.code),
        })),
      ),
    [plan.semesters],
  );

  useEffect(() => {
    setEditedSemesters(null);
  }, [planSeed]);

  const syncedSemesters = editedSemesters ?? plan.semesters;
  const syncedProjectedGraduation =
    syncedSemesters.filter((semester) => semester.courses.length).at(-1)?.label ?? plan.projectedGraduation;

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
  const sectionLinks = [
    { key: "setup", label: "Setup", ref: setupRef },
    { key: "controls", label: "Plan Controls", ref: controlsRef },
    { key: "progress", label: "My Progress", ref: progressRef },
    { key: "map", label: "Degree Map", ref: degreeMapRef },
    { key: "snapshots", label: "Snapshots", ref: snapshotsRef },
    { key: "timeline", label: "Semester Timeline", ref: timelineRef },
  ];

  function jumpToSection(targetRef) {
    targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
  }

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
      setCompletedCodes,
      setIncludeSummer,
      setMaxCredits,
      setSelectedElectiveCodes,
      setSelectedCourseCode,
      setActiveScenarioKey,
      setTimelineTermCount,
    });
    setPendingSyncChoice(null);
    setRemoteStateLoadedFor(authUser.id);
    setSaveStatus("Saved plan loaded");
  }

  async function signInWithGoogle() {
    setAuthLoading(true);
    setAuthError("");
    setSaveError("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getOAuthRedirectUrl(),
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
      setProfileOpen(false);
    }

    setAuthLoading(false);
  }

  return (
    <div className="app-shell app-shell-immersive">
      <header className="topbar">
        <div className="topbar-brand-row">
          <div className="topbar-menu-shell">
            <button
              type="button"
              className={`topbar-icon-button ${menuOpen ? "is-active" : ""}`}
              aria-label="Open section menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
            >
              <span />
              <span />
              <span />
            </button>
            {menuOpen ? (
              <div className="topbar-menu-popover" role="menu" aria-label="Jump to section">
                {sectionLinks.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="topbar-menu-item"
                    onClick={() => jumpToSection(item.ref)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
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
          <button
            type="button"
            className={`topbar-link ${profileOpen ? "is-active" : ""}`}
            onClick={() => setProfileOpen((current) => !current)}
          >
            My Profile
          </button>
        </div>
      </header>

      <main className="workspace-layout">
        <aside className="left-rail">
          <div ref={setupRef}>
            <CollegeMajorSelector
              catalogLabel={CURRENT_DATASET.label}
              college={catalog.source.college}
              major={catalog.source.major}
              datasetStatus={datasetLoadState}
            />
          </div>

          <div ref={controlsRef}>
            <WhatIfPanel
              includeSummer={includeSummer}
              onIncludeSummerChange={setIncludeSummer}
              maxCredits={maxCredits}
              onMaxCreditsChange={setMaxCredits}
              electiveOptions={catalog.electiveOptions.map((code) => catalog.courseMap[code]).filter(Boolean)}
              selectedElectiveCodes={selectedElectiveCodes}
              onToggleElective={toggleElective}
            />
          </div>
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
              <strong>{syncedProjectedGraduation}</strong>
            </div>
          </div>

          <div ref={progressRef} className="workspace-progress-row">
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
          </div>

          <div className="map-detail-grid" ref={degreeMapRef}>
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

          <section className="panel scenario-panel scenario-panel-inline" ref={snapshotsRef}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Snapshots</p>
                <h2>Jump to a starting point</h2>
              </div>
              <span className="panel-chip">Timeline: {syncedSemesters.length} terms</span>
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

          <div ref={timelineRef}>
            <SemesterPlan
              plan={plan}
              courseMap={catalog.courseMap}
              roadmapCourseCodes={roadmapCourseCodes}
              completedCodes={completedCodes}
              maxCredits={maxCredits}
              onSelectCourse={setSelectedCourseCode}
              onPlanEdit={setEditedSemesters}
            />
          </div>
        </section>
      </main>

      {profileOpen ? (
        <div className="profile-backdrop" onClick={() => setProfileOpen(false)}>
          <aside className="profile-modal" onClick={(event) => event.stopPropagation()}>
            <div className="profile-modal-header">
              <div>
                <p className="eyebrow">Account</p>
                <h2>My Profile</h2>
              </div>
              <button type="button" className="profile-close-button" onClick={() => setProfileOpen(false)}>
                Close
              </button>
            </div>

            <p className="profile-modal-copy">
              Sign in to save your planner to your account, restore it later, and keep your local and account plan in sync.
            </p>

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
          </aside>
        </div>
      ) : null}
    </div>
  );
}

