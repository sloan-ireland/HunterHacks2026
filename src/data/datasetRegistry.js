import mockHunterCsPlaceholder from "./mockHunterCsPlaceholder";

const mockHunterCsBalanced = {
  ...mockHunterCsPlaceholder,
  source: {
    ...mockHunterCsPlaceholder.source,
    implementation: "Balanced placeholder dataset",
  },
  program: {
    ...mockHunterCsPlaceholder.program,
    longName: "Computer Science BA Placeholder (Balanced)",
  },
  planCourseCodes: [
    "CSCI 12700",
    "MATH 12500",
    "CSCI 13500",
    "CSCI 15000",
    "MATH 15000",
    "STAT 21300",
    "CSCI 16000",
    "CSCI 23500",
    "MATH 15500",
    "MATH 16000",
    "CSCI 26000",
    "CSCI 26500",
    "CSCI 33500",
    "CSCI 34000",
    "CSCI 49900",
  ],
  electiveOptions: ["CSCI 23200", "CSCI 35000", "CSCI 46000"],
};

export const DATASET_OPTIONS = [
  {
    id: "hunter-placeholder",
    label: "Hunter CS Placeholder",
    description: "Curated demo data for frontend work and pitch flow.",
    data: mockHunterCsPlaceholder,
  },
  {
    id: "hunter-placeholder-balanced",
    label: "Hunter CS Placeholder (Balanced)",
    description: "Alternate placeholder plan to test dataset switching in the UI.",
    data: mockHunterCsBalanced,
  },
];

export function getDatasetById(datasetId) {
  return DATASET_OPTIONS.find((dataset) => dataset.id === datasetId) ?? DATASET_OPTIONS[0];
}
