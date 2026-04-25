const STATUS_LABELS = {
  completed: "Done",
  available: "Ready",
  next: "Next",
  locked: "Locked",
};

export default function CourseNode({ course, status, selected, onSelect, emphasized }) {
  return (
    <button
      type="button"
      className={`graph-node status-${status} ${selected ? "is-selected" : ""} ${
        emphasized ? "is-emphasized" : ""
      }`}
      style={{
        left: course.x,
        top: course.y,
        width: course.width,
        height: course.height,
      }}
      onClick={() => onSelect(course.code)}
    >
      <span className="graph-node-topline">
        <span>{course.code}</span>
        <span>{course.credits} cr</span>
      </span>
      <strong>{course.name}</strong>
      <span className="graph-node-footer">
        <span>{STATUS_LABELS[status]}</span>
        <span>{emphasized ? "In plan" : course.category}</span>
      </span>
    </button>
  );
}
