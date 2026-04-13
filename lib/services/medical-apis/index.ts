/**
 * Medical APIs barrel export
 * @module lib/services/medical-apis
 */

export { getRxCUI, searchDrug, getRxCUIProperties, validateDrugName, checkInteractions, validateQuestionDrugs, type RxNormConcept, type DrugInteraction, type DrugValidationResult, type InteractionCheckResult } from './rxnorm';
export { searchOpenFDA, lookupDrugLabel, searchAdverseEvents, type OpenFDADrugResult, type AdverseEventResult } from './openfda';
export { searchUMLS, getConceptAtoms, crosswalk, validateTerm, mapToICD10, batchValidateTerms, type UMLSConcept, type UMLSAtom, type CrosswalkResult, type UMLSSearchResult } from './umls';
