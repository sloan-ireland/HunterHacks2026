import { useMemo, useState } from "react";
import CourseNode from "./CourseNode";

function buildConnectorPath(startX, startY, endX, endY) {
  const horizontalGap = endX - startX;

  if (Math.abs(endY - startY) < 6) {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }

  const exitRun = Math.min(48, Math.max(24, horizontalGap * 0.18));
  const entryRun = Math.min(34, Math.max(18, horizontalGap * 0.12));
  const turnX = Math.max(startX + exitRun, endX - entryRun - 18);
  const bendDirection = endY > startY ? 1 : -1;

  return [
    `M ${startX} ${startY}`,
    `L ${turnX} ${startY}`,
    `Q ${turnX + 12} ${startY} ${turnX + 12} ${startY + bendDirection * 12}`,
    `L ${turnX + 12} ${endY - bendDirection * 12}`,
    `Q ${turnX + 12} ${endY} ${turnX + 24} ${endY}`,
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
      <circle cx={endX} cy={endY} r="2.5" className="graph-edge-terminal" />
    </g>
  );
}

export default function DependencyGraph({
  graph,
  statuses,
  selectedCode,
  onSelectCourse,
  emphasizedCodes,
}) {
  const [zoom, setZoom] = useState(1);
  const emphasizedSet = useMemo(() => new Set(emphasizedCodes), [emphasizedCodes]);

  return (
    <section className="panel graph-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Roadmap</p>
          <h2>Interactive prerequisite graph</h2>
        </div>

        <div className="graph-actions">
          <button type="button" onClick={() => setZoom((value) => Math.max(0.8, value - 0.1))}>
            -
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(1.4, value + 0.1))}>
            +
          </button>
        </div>
      </div>

      <div className="graph-legend">
        <span className="legend-item"><i className="legend-dot completed" /> Completed</span>
        <span className="legend-item"><i className="legend-dot available" /> Available now</span>
        <span className="legend-item"><i className="legend-dot next" /> Next semester</span>
        <span className="legend-item"><i className="legend-dot locked" /> Locked</span>
      </div>

      <div className="graph-scroll">
        <div
          className="graph-surface"
          style={{
            width: graph.width * zoom,
            height: graph.height * zoom,
          }}
        >
          <div
            className="graph-stage"
            style={{
              width: graph.width,
              height: graph.height,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            <svg className="graph-svg" width={graph.width} height={graph.height}>
              {graph.edges.map((edge) => (
                <GraphEdge key={edge.id} edge={edge} nodeByCode={graph.nodeByCode} />
              ))}
            </svg>

            {graph.nodes.map((course) => (
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
      </div>
    </section>
  );
}
