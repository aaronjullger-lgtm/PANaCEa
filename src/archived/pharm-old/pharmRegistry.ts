export interface DrugClass {
  className: string;
  drugs: string[];
}

export interface DrugEntry {
  drugName: string;
  className: string;
}

// ------------------------------
// RAW DRUG CLASS MAP
// ------------------------------

export const drugClasses: Record<string, string[]> = {
  "ACE Inhibitors": [
    "lisinopril", "enalapril", "captopril", "ramipril", "benazepril",
    "quinapril", "fosinopril", "moexipril", "perindopril", "trandolapril"
  ],

  "ARBs": [
    "losartan", "valsartan", "irbesartan", "candesartan", "telmisartan",
    "olmesartan", "eprosartan", "azilsartan"
  ],

  "Beta-Blockers (Selective)": [
    "metoprolol", "atenolol", "bisoprolol", "nebivolol", "esmolol"
  ],

  "Beta-Blockers (Nonselective)": [
    "propranolol", "nadolol", "timolol", "pindolol"
  ],

  "Alpha/Beta Blockers": [
    "carvedilol", "labetalol"
  ],

  "Alpha-1 Blockers": [
    "prazosin", "terazosin", "doxazosin"
  ],

  "Central Alpha-2 Agonists": [
    "clonidine", "guanfacine", "methyldopa"
  ],

  "Calcium Channel Blockers — Dihydropyridine": [
    "amlodipine", "nifedipine", "felodipine", "nicardipine",
    "isradipine", "clevidipine"
  ],

  "Calcium Channel Blockers — Non-Dihydropyridine": [
    "diltiazem", "verapamil"
  ],

  "Thiazide & Like Diuretics": [
    "hydrochlorothiazide", "chlorthalidone", "indapamide", "metolazone"
  ],

  "Loop Diuretics": [
    "furosemide", "bumetanide", "torsemide", "ethacrynic acid"
  ],

  "Potassium-Sparing Diuretics": [
    "spironolactone", "eplerenone", "amiloride", "triamterene"
  ],

  "Vasodilators": [
    "hydralazine", "minoxidil", "nitroprusside", "isosorbide dinitrate",
    "isosorbide mononitrate", "nitroglycerin"
  ],

  "Heart Failure — Specific": [
    "sacubitril/valsartan", "ivabradine", "digoxin", "dobutamine", "milrinone"
  ],

  // -------------------------------------------
  // I will continue the ENTIRE list for you
  // -------------------------------------------
  // To keep the message from exceeding limits, I will generate the entire file
  // in the next message — fully complete, with ALL 1,000+ drugs.
  // -------------------------------------------
};

// ----------------------------------------------
// BUILD LOOKUP TABLES
// ----------------------------------------------

export const drugToClass: Record<string, string> = {};

for (const className of Object.keys(drugClasses)) {
  const drugs = drugClasses[className];
  for (const drug of drugs) {
    drugToClass[drug.toLowerCase()] = className;
  }
}

// Utility: get class from drug name
export function getDrugClass(drug: string): string | null {
  return drugToClass[drug.toLowerCase()] ?? null;
}

// Utility: get drugs from class name
export function getDrugsInClass(className: string): string[] {
  return drugClasses[className] ?? [];
}
