import { useEffect, useMemo, useRef, useState } from "react";
import CourseNode from "./CourseNode";

const STAGE_META = [
  { title: "Foundation", subtitle: "0-15 credits" },
  { title: "Core", subtitle: "16-30 credits" },
  { title: "Core Advanced", subtitle: "31-60 credits" },
  { title: "Upper Division", subtitle: "61+ credits" },
];

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "core", label: "Core" },
  { key: "math", label: "Math" },
  { key: "elective", label: "Electives" },
];

function buildConnectorPath(startX, startY, endX, endY) {
  const horizontalGap = endX - startX;

  if (Math.abs(endY - startY) < 6) {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }

  const exitRun = Math.min(46, Math.max(20, horizontalGap * 0.2));
  const entryRun = Math.min(30, Math.max(16, horizontalGap * 0.16));
  const turnX = Math.max(startX + exitRun, endX - entryRun - 16);
  const bendDirection = endY > startY ? 1 : -1;

  return [
    `M ${startX} ${startY}`,
    `L ${turnX} ${startY}`,
    `Q ${turnX + 10} ${startY} ${turnX + 10} ${startY + bendDirection * 10}`,
    `L ${turnX + 10} ${endY - bendDirection * 10}`,
    `Q ${turnX + 10} ${endY} ${turnX + 20} ${endY}`,
    `L ${endX} ${endY}`,
  ].join(" ");
}

function GraphEdge({ edge, nodeByCode }) {
  const source = nodeByCode[edge.source];
  const target = nodeByCode[edge.target];

  if (!source || !target) {
    return null;
  }

  const startX = source.x + source.width;
  const startY = source.y + source.height / 2;
  const endX = target.x;
  const endY = target.y + target.height / 2;
  const path = buildConnectorPath(startX, startY, endX, endY);

  return (
    <g className="graph-edge-group">
      <path d={path} className="graph-edge graph-edge-underlay" />
      <path d={path} className="graph-edge graph-edge-foreground" />
      <circle cx={endX} cy={endY} r="3" className="graph-edge-terminal" />
    </g>
  );
}

function compactNodes(nodes) {
  const columns = nodes.reduce((accumulator, node) => {
    accumulator[node.layer] ??= [];
    accumulator[node.layer].push(node);
    return accumulator;
  }, {});

  return Object.values(columns)
    .flatMap((columnNodes) =>
      [...columnNodes]
        .sort((left, right) => left.y - right.y)
        .map((node, index) => ({
          ...node,
          y: 96 + index * (node.height + 18),
        })),
    )
    .sort((left, right) => (left.layer === right.layer ? left.y - right.y : left.layer - right.layer));
}

function buildStageBands(nodes) {
  if (!nodes.length) {
    return [];
  }

  const layers = [...new Set(nodes.map((node) => node.layer))].sort((left, right) => left - right);
  const layerCount = Math.max(layers.length, 1);

  const stageBuckets = layers.reduce((accumulator, layer, index) => {
    const stageIndex = Math.min(
      STAGE_META.length - 1,
      Math.floor((index / layerCount) * STAGE_META.length),
    );

    accumulator[stageIndex] ??= [];
    accumulator[stageIndex].push(layer);
    return accumulator;
  }, {});

  return Object.entries(stageBuckets).map(([stageIndex, stageLayers]) => {
    const stageNodes = nodes.filter((node) => stageLayers.includes(node.layer));
    const x = Math.min(...stageNodes.map((node) => node.x));
    const rightEdge = Math.max(...stageNodes.map((node) => node.x + node.width));

    return {
      ...STAGE_META[stageIndex],
      key: `${stageIndex}-${stageLayers.join("-")}`,
      x,
      width: rightEdge - x,
    };
  });
}

export default function DependencyGraph({
  graph,
  statuses,
  selectedCode,
  onSelectCourse,
  emphasizedCodes,
}) {
  const [zoom, setZoom] = useState(1);
  const [activeFilter, setActiveFilter] = useState("all");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const scrollRef = useRef(null);
  const emphasizedSet = useMemo(() => new Set(emphasizedCodes), [emphasizedCodes]);
  const activeFilterLabel = FILTER_OPTIONS.find((option) => option.key === activeFilter)?.label ?? "All";

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return undefined;
    }

    const updateSize = () => {
      setViewportWidth(element.clientWidth);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const filteredNodes = useMemo(() => {
    const baseNodes = activeFilter === "all"
      ? graph.nodes
      : graph.nodes.filter((node) => node.category === activeFilter);

    return compactNodes(baseNodes);
  }, [activeFilter, graph.nodes]);

  const filteredNodeByCode = useMemo(
    () => Object.fromEntries(filteredNodes.map((node) => [node.code, node])),
    [filteredNodes],
  );

  const filteredEdges = useMemo(
    () =>
      graph.edges.filter(
        (edge) => filteredNodeByCode[edge.source] && filteredNodeByCode[edge.target],
      ),
    [filteredNodeByCode, graph.edges],
  );

  const stageBands = useMemo(() => buildStageBands(filteredNodes), [filteredNodes]);
  const contentWidth = useMemo(() => {
    if (!filteredNodes.length) {
      return 680;
    }

    return Math.max(620, Math.max(...filteredNodes.map((node) => node.x + node.width)) + 28);
  }, [filteredNodes]);

  const contentHeight = useMemo(() => {
    if (!filteredNodes.length) {
      return 240;
    }

    return Math.max(280, Math.max(...filteredNodes.map((node) => node.y + node.height)) + 30);
  }, [filteredNodes]);

  const fitZoom = useMemo(() => {
    if (!viewportWidth || !contentWidth) {
      return 1;
    }

    return Math.min(1, Math.max(0.76, (viewportWidth - 28) / contentWidth));
  }, [viewportWidth, contentWidth]);

  const effectiveZoom = Math.min(1.45, Math.max(0.7, fitZoom * zoom));

  return (
    <section className="panel graph-panel map-panel">
      <div className="map-toolbar">
        <div className="map-toolbar-title">
          <h2>Degree Map</h2>
        </div>

        <div className="map-toolbar-right">
          <div className="graph-legend graph-legend-inline">
            <span className="legend-item"><i className="legend-dot completed" /> Completed</span>
            <span className="legend-item"><i className="legend-dot available" /> Available Now</span>
            <span className="legend-item"><i className="legend-dot next" /> Available Next</span>
            <span className="legend-item"><i className="legend-dot locked" /> Locked</span>
          </div>

          <div className="map-toolbar-controls">
            <div className="filter-menu-shell">
              <button
                type="button"
                className={`filter-menu-button ${filterMenuOpen ? "is-open" : ""}`}
                onClick={() => setFilterMenuOpen((current) => !current)}
                aria-expanded={filterMenuOpen}
              >
                Filters: {activeFilterLabel}
              </button>
              {filterMenuOpen ? (
                <div className="filter-menu-popover" role="menu" aria-label="Degree map filters">
                  {FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={activeFilter === option.key ? "is-active" : ""}
                      onClick={() => {
                        setActiveFilter(option.key);
                        setFilterMenuOpen(false);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="graph-actions graph-actions-compact">
              <button type="button" onClick={() => setZoom((value) => Math.max(0.85, value - 0.08))}>
                -
              </button>
              <span>{Math.round(effectiveZoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((value) => Math.min(1.25, value + 0.08))}>
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="graph-scroll map-scroll" ref={scrollRef}>
        {filteredNodes.length ? (
          <div
            className="graph-surface"
            style={{
              width: contentWidth * effectiveZoom,
              height: contentHeight * effectiveZoom,
            }}
          >
            <div
              className="graph-stage"
              style={{
                width: contentWidth,
                height: contentHeight,
                transform: `scale(${effectiveZoom})`,
                transformOrigin: "top left",
              }}
            >
              <div className="graph-stage-bands">
                {stageBands.map((band) => (
                  <div
                    key={band.key}
                    className="graph-stage-band"
                    style={{ left: band.x, width: band.width }}
                  >
                    <strong>{band.title}</strong>
                    <span>{band.subtitle}</span>
                  </div>
                ))}
              </div>

              <svg className="graph-svg" width={contentWidth} height={contentHeight}>
                {filteredEdges.map((edge) => (
                  <GraphEdge key={edge.id} edge={edge} nodeByCode={filteredNodeByCode} />
                ))}
              </svg>

              {filteredNodes.map((course) => (
                <CourseNode
                  key={course.code}
                  course={course}
                  status={statuses[course.code]}
                  selected={selectedCode === course.code}
                  emphasized={emphasizedSet.has(course.code)}
                  onSelect={onSelectCourse}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="map-empty-state">
            <strong>No courses in this filter yet.</strong>
            <p>Switch filters to see the rest of the roadmap.</p>
          </div>
        )}
      </div>
    </section>
  );
}
