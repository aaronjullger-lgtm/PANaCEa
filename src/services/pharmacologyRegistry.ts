import pharmacologyRegistry from "../data/pharmacology/registry.json";
import type { PharmacologyEntry, PharmacologyRegistry } from "../types/pharmacology";

interface PharmacologyRegistrySourceEntry
  extends Omit<PharmacologyEntry, "id" | "type"> {}

function slugify(term: string): string {
  return term
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export const PHARMACOLOGY_REGISTRY: PharmacologyRegistry =
  (pharmacologyRegistry as PharmacologyRegistrySourceEntry[]).map((entry) => ({
    ...entry,
    id: slugify(entry.term),
    type: "drug",
  }));

export function findPharmacologyEntryById(
  id: string
): PharmacologyEntry | undefined {
  return PHARMACOLOGY_REGISTRY.find((entry) => entry.id === id);
}
