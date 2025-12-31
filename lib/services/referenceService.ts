import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const referenceService = {
  // ============================================
  // ANATOMY
  // ============================================
  async getAnatomyStructures(system?: string) {
    return prisma.anatomyStructure.findMany({
      where: system ? { system } : undefined,
      include: { Condition: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' }
    });
  },
  
  async getAnatomyStructure(id: string) {
    return prisma.anatomyStructure.findUnique({
      where: { id },
      include: { Condition: { select: { id: true, name: true } } }
    });
  },

  async searchAnatomy(query: string) {
    return prisma.anatomyStructure.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 10
    });
  },

  // ============================================
  // SPECIAL TESTS
  // ============================================
  async getSpecialTests(system?: string) {
    return prisma.specialTest.findMany({
      where: system ? { system } : undefined,
      include: { Condition: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' }
    });
  },

  async getSpecialTest(id: string) {
    return prisma.specialTest.findUnique({
      where: { id },
      include: { Condition: { select: { id: true, name: true } } }
    });
  },

  // ============================================
  // PHYSIOLOGY
  // ============================================
  async getPhysiologyConcepts(category?: string) {
    return prisma.physiologyConcept.findMany({
      where: category ? { category } : undefined,
      orderBy: { name: 'asc' }
    });
  },

  async getPhysiologyConcept(id: string) {
    return prisma.physiologyConcept.findUnique({
      where: { id }
    });
  },

  async searchPhysiology(query: string) {
    return prisma.physiologyConcept.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 10
    });
  },

  // ============================================
  // PROCEDURES
  // ============================================
  async getProcedures(filters?: { category?: string; system?: string }) {
    const where: any = {};
    if (filters?.category) where.category = filters.category;
    if (filters?.system) where.system = filters.system;
    
    return prisma.procedure.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { name: 'asc' }
    });
  },

  async getProcedure(id: string) {
    return prisma.procedure.findUnique({
      where: { id }
    });
  },

  async searchProcedures(query: string) {
    return prisma.procedure.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { indications: { hasSome: [query] } }
        ]
      },
      take: 15
    });
  },

  // ============================================
  // HISTORY COMPONENTS
  // ============================================
  async getHistoryComponents(category?: string) {
    return prisma.historyComponent.findMany({
      where: category ? { category } : undefined,
      orderBy: { name: 'asc' }
    });
  },

  async getHistoryComponent(id: string) {
    return prisma.historyComponent.findUnique({
      where: { id }
    });
  },

  async searchHistoryComponents(query: string) {
    return prisma.historyComponent.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 15
    });
  },

  // ============================================
  // DIFFERENTIAL DIAGNOSIS
  // ============================================
  async getDifferentials(filters?: { category?: string; presentingComplaint?: string }) {
    const where: any = {};
    if (filters?.category) where.category = filters.category;
    if (filters?.presentingComplaint) {
      where.presentingComplaint = { contains: filters.presentingComplaint, mode: 'insensitive' };
    }
    
    return prisma.differentialDiagnosis.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { presentingComplaint: 'asc' }
    });
  },

  async getDifferential(id: string) {
    return prisma.differentialDiagnosis.findUnique({
      where: { id }
    });
  },

  async searchDifferentials(query: string) {
    return prisma.differentialDiagnosis.findMany({
      where: {
        OR: [
          { presentingComplaint: { contains: query, mode: 'insensitive' } },
          { differentialList: { hasSome: [query] } }
        ]
      },
      take: 20
    });
  },

  async getDifferentialsByComplaint(presentingComplaint: string) {
    return prisma.differentialDiagnosis.findMany({
      where: {
        presentingComplaint: { contains: presentingComplaint, mode: 'insensitive' }
      },
      orderBy: { presentingComplaint: 'asc' }
    });
  },

  // ============================================
  // TREATMENTS
  // ============================================
  async getTreatments(category?: string) {
    return prisma.treatment.findMany({
      where: category ? { category } : undefined,
      orderBy: { name: 'asc' }
    });
  },

  // ============================================
  // IMAGING
  // ============================================
  async getImagingStudies(modality?: string) {
    return prisma.imagingStudy.findMany({
      where: modality ? { modality } : undefined,
      orderBy: { name: 'asc' }
    });
  },

  // ============================================
  // PHYSICAL EXAM FINDINGS
  // ============================================
  async getFindings(system?: string) {
    return prisma.physicalExamFinding.findMany({
      where: system ? { system } : undefined,
      orderBy: { name: 'asc' }
    });
  },

  async getFinding(id: string) {
    return prisma.physicalExamFinding.findUnique({
      where: { id }
    });
  },

  async searchFindings(query: string) {
    return prisma.physicalExamFinding.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 15
    });
  },

  // ============================================
  // GUIDELINES
  // ============================================
  async getGuidelines(category?: string) {
    return prisma.practiceGuideline.findMany({
      where: category ? { category } : undefined,
      orderBy: { name: 'asc' }
    });
  },

  async getGuideline(id: string) {
    return prisma.practiceGuideline.findUnique({
      where: { id }
    });
  },

  // ============================================
  // VITAL SIGN RANGES
  // ============================================
  async getVitalSignRanges() {
    return prisma.vitalSignRange.findMany({
      orderBy: { vitalSign: 'asc' }
    });
  },

  async getVitalSignRange(id: string) {
    return prisma.vitalSignRange.findUnique({
      where: { id }
    });
  },

  // ============================================
  // LAB TESTS
  // ============================================
  async getLabTests(category?: string) {
    return prisma.labTest.findMany({
      where: category ? { category } : undefined,
      orderBy: { name: 'asc' }
    });
  },

  async getLabTest(id: string) {
    return prisma.labTest.findUnique({
      where: { id }
    });
  },

  async searchLabTests(query: string) {
    return prisma.labTest.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { typicalUse: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 15
    });
  },

  // ============================================
  // ECG PATTERNS
  // ============================================
  async getECGPatterns(category?: string) {
    return prisma.eCGPattern.findMany({
      where: category ? { category } : undefined,
      orderBy: { name: 'asc' }
    });
  },

  async getECGPattern(id: string) {
    return prisma.eCGPattern.findUnique({
      where: { id }
    });
  },

  // ============================================
  // ANTIBIOTIC GUIDELINES
  // ============================================
  async getAntibioticGuidelines(organismClass?: string) {
    return prisma.antibioticGuideline.findMany({
      where: organismClass ? { class: organismClass } : undefined,
      orderBy: { organism: 'asc' }
    });
  },

  async getAntibioticGuideline(id: string) {
    return prisma.antibioticGuideline.findUnique({
      where: { id }
    });
  }
};
