import { describe, it, expect } from "vitest";
import {
  normalize,
  similarityScore,
  extractTags,
  detectMediaTypeFromFolder,
  keywordOverlapScore,
  combinedMatchScore,
} from "../lib/mediaMatcherUtils";

describe("mediaMatcherUtils", () => {
  describe("normalize", () => {
    it("should lowercase text", () => {
      expect(normalize("HELLO")).toBe("hello");
    });

    it("should remove hyphens and underscores", () => {
      expect(normalize("sinus-bradycardia")).toBe("sinus bradycardia");
      expect(normalize("sinus_bradycardia")).toBe("sinus bradycardia");
    });

    it("should remove punctuation", () => {
      expect(normalize("hello, world!")).toBe("hello world");
    });

    it("should collapse whitespace", () => {
      expect(normalize("hello   world")).toBe("hello world");
    });

    it("should handle mixed cases", () => {
      expect(normalize("  EKG_Atrial-FIBRILLATION  ")).toBe(
        "ekg atrial fibrillation"
      );
    });
  });

  describe("similarityScore", () => {
    it("should return 1 for identical strings", () => {
      expect(similarityScore("hello", "hello")).toBe(1);
    });

    it("should return 1 for case-insensitive identical strings", () => {
      expect(similarityScore("Hello", "HELLO")).toBe(1);
    });

    it("should return 0 for empty strings", () => {
      expect(similarityScore("", "hello")).toBe(0);
      expect(similarityScore("hello", "")).toBe(0);
    });

    it("should return high score for similar strings", () => {
      const score = similarityScore("bradycardia", "tachycardia");
      expect(score).toBeGreaterThan(0.5);
    });

    it("should return low score for dissimilar strings", () => {
      const score = similarityScore("hello", "world");
      expect(score).toBeLessThan(0.5);
    });
  });

  describe("extractTags", () => {
    it("should extract tags from filename with underscores", () => {
      const tags = extractTags("EKG_atrial_fibrillation_rapid.png");
      expect(tags).toContain("ekg");
      expect(tags).toContain("atrial");
      expect(tags).toContain("fibrillation");
      expect(tags).toContain("rapid");
    });

    it("should extract tags from filename with hyphens", () => {
      const tags = extractTags("sinus-bradycardia.png");
      expect(tags).toContain("sinus");
      expect(tags).toContain("bradycardia");
    });

    it("should filter out noise words", () => {
      const tags = extractTags("the_image_of_heart.png");
      expect(tags).not.toContain("the");
      expect(tags).not.toContain("image");
      expect(tags).toContain("heart");
    });

    it("should filter out very short tokens", () => {
      const tags = extractTags("a_b_heart.png");
      expect(tags).not.toContain("a");
      expect(tags).not.toContain("b");
      expect(tags).toContain("heart");
    });
  });

  describe("detectMediaTypeFromFolder", () => {
    it("should detect ekg type from path", () => {
      expect(detectMediaTypeFromFolder("/assets/media/ekg/file.png")).toBe(
        "ekg"
      );
      expect(detectMediaTypeFromFolder("/assets/media/ecg/file.png")).toBe(
        "ekg"
      );
    });

    it("should detect labs type from path", () => {
      expect(detectMediaTypeFromFolder("/assets/media/labs/file.png")).toBe(
        "labs"
      );
    });

    it("should detect imaging type from path", () => {
      expect(detectMediaTypeFromFolder("/assets/media/imaging/file.png")).toBe(
        "imaging"
      );
    });

    it("should detect diagram type from path", () => {
      expect(
        detectMediaTypeFromFolder("/assets/media/diagrams/file.png")
      ).toBe("diagram");
      expect(detectMediaTypeFromFolder("/assets/media/diagram/file.png")).toBe(
        "diagram"
      );
    });

    it("should return other for unknown paths", () => {
      expect(detectMediaTypeFromFolder("/assets/media/other/file.png")).toBe(
        "other"
      );
      expect(detectMediaTypeFromFolder("/random/path/file.png")).toBe("other");
    });

    it("should handle Windows paths", () => {
      expect(
        detectMediaTypeFromFolder("C:\\assets\\media\\ekg\\file.png")
      ).toBe("ekg");
    });
  });

  describe("keywordOverlapScore", () => {
    it("should return 0 for empty arrays", () => {
      expect(keywordOverlapScore([], ["a", "b"])).toBe(0);
      expect(keywordOverlapScore(["a", "b"], [])).toBe(0);
    });

    it("should return high score for matching tags", () => {
      const score = keywordOverlapScore(
        ["atrial", "fibrillation"],
        ["atrial", "fibrillation", "cv", "ecg"]
      );
      expect(score).toBeGreaterThan(0.5);
    });

    it("should return lower score for partial matches", () => {
      const score = keywordOverlapScore(
        ["atrial", "flutter"],
        ["atrial", "fibrillation"]
      );
      expect(score).toBeLessThan(1);
      expect(score).toBeGreaterThan(0);
    });

    it("should handle medical term aliases (ekg/ecg)", () => {
      const score = keywordOverlapScore(["ekg"], ["ecg"]);
      expect(score).toBeGreaterThan(0.5);
    });
  });

  describe("combinedMatchScore", () => {
    it("should return 0 for empty tags", () => {
      expect(combinedMatchScore([], "condition")).toBe(0);
    });

    it("should return high score for matching condition", () => {
      const score = combinedMatchScore(
        ["sinus", "bradycardia"],
        "CV__ecg__sinus_bradycardia",
        ["cv", "ecg", "sinus", "bradycardia"]
      );
      expect(score).toBeGreaterThan(0.5);
    });

    it("should handle medical term aliases", () => {
      const score = combinedMatchScore(
        ["ekg", "atrial", "fibrillation"],
        "CV__ecg__atrial_fibrillation",
        ["cv", "ecg", "atrial", "fibrillation"]
      );
      expect(score).toBeGreaterThan(0.5);
    });

    it("should return lower score for partial matches", () => {
      const fullScore = combinedMatchScore(
        ["sinus", "bradycardia"],
        "CV__ecg__sinus_bradycardia",
        []
      );
      const partialScore = combinedMatchScore(
        ["sinus"],
        "CV__ecg__sinus_bradycardia",
        []
      );
      expect(fullScore).toBeGreaterThan(partialScore);
    });
  });
});
