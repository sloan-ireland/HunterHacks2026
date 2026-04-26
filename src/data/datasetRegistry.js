import mockHunterCsPlaceholder from "./mockHunterCsPlaceholder";
import { fetchSupabaseCatalogDataset } from "./supabaseCatalog";

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
    label: "Hunter CS Demo",
    description: "Curated sample roadmap for product design and presentation flow.",
    data: mockHunterCsPlaceholder,
  },
  {
    id: "hunter-placeholder-balanced",
    label: "Hunter CS Demo (Balanced)",
    description: "Alternate sample roadmap for comparing pacing and course flow.",
    data: mockHunterCsBalanced,
  },
  {
    id: "hunter-live-supabase",
    label: "Hunter CS Current Catalog",
    description: "Uses the current catalog while keeping the Hunter CS roadmap stable.",
    fallbackData: mockHunterCsPlaceholder,
    loadData: fetchSupabaseCatalogDataset,
  },
];

export function getDatasetById(datasetId) {
  return DATASET_OPTIONS.find((dataset) => dataset.id === datasetId) ?? DATASET_OPTIONS[0];
}
