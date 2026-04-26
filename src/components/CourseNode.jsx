const STATUS_LABELS = {
  completed: "Completed",
  available: "Available Now",
  next: "Available Next",
  locked: "Locked",
};

function formatRequirementText(groups, fallbackText, emptyLabel) {
  if (fallbackText) {
    return fallbackText;
  }

  if (!groups?.length) {
    return emptyLabel;
  }

  return groups
    .map((group) => (group.length > 1 ? `(${group.join(" or ")})` : group[0]))
    .join(" and ");
}

export default function CourseNode({ course, status, selected, onSelect, emphasized }) {
  const prerequisiteText = formatRequirementText(
    course.prerequisiteGroups,
    course.prerequisiteText,
    "No prerequisites",
  );
  const corequisiteText = formatRequirementText(
    course.corequisiteGroups ?? course.corequisites?.map((code) => [code]),
    course.corequisiteText,
    "None",
  );

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
      title={`Prereqs: ${prerequisiteText}${corequisiteText !== "None" ? ` | Coreqs: ${corequisiteText}` : ""}`}
      onClick={() => onSelect(course.code)}
    >
      <span className="graph-node-topline">
        <span className="graph-node-code">{course.code}</span>
        <span className="graph-node-credit">{course.credits}</span>
      </span>
      <strong>{course.name}</strong>
      <span className="graph-node-footer">
        <span>{STATUS_LABELS[status]}</span>
        <span>{emphasized ? "In roadmap" : course.category}</span>
      </span>

      <span className="graph-node-hovercard" aria-hidden="true">
        <span className="graph-node-hovercard-label">Prereqs</span>
        <span className="graph-node-hovercard-text">{prerequisiteText}</span>
        {corequisiteText !== "None" ? (
          <>
            <span className="graph-node-hovercard-label">Coreqs</span>
            <span className="graph-node-hovercard-text">{corequisiteText}</span>
          </>
        ) : null}
      </span>
    </button>
  );
}
