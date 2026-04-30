import { fetchSupabaseCatalogDataset } from "./supabaseCatalog";
import mockHunterCsPlaceholder from "./mockHunterCsPlaceholder";

export const DATASET_OPTIONS = [
  {
    id: "hunter-current-catalog",
    label: "Hunter CS Current Catalog",
    description: "Current Hunter catalog data matched to the Computer Science BA roadmap.",
    fallbackData: mockHunterCsPlaceholder,
    loadData: fetchSupabaseCatalogDataset,
  },
];
