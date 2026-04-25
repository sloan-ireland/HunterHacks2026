import { useMemo, useState } from "react";
import CourseNode from "./CourseNode";

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
  const midX = startX + (endX - startX) / 2;

  return (
    <path
      d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
      className="graph-edge"
    />
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
