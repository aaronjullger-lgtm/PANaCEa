/**
 * Re-export shim — import from @/lib/drugSearch instead.
 */
export { getDrugClassOptions, getDrugTypeOptions, searchDrugs, findDrugById, findDrugByName, getDrugsByClass, getDrugCount, type DrugData } from '../../lib/drugSearch';
export type { DrugSearchFilters, DrugSearchResult } from '@/types/pharm';
