import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const referenceService = {
  // Anatomy
  async getAnatomyStructures(system?: string) {
    return prisma.anatomyStructure.findMany({
      where: system ? { system } : undefined,
      include: { conditions: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' }
    });
  },
  
  async getAnatomyStructure(id: string) {
    return prisma.anatomyStructure.findUnique({
      where: { id },
      include: { conditions: { select: { id: true, name: true } } }
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

  // Special Tests
  async getSpecialTests(system?: string) {
    return prisma.specialTest.findMany({
      where: system ? { system } : undefined,
      include: { conditions: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' }
    });
  },

  async getSpecialTest(id: string) {
    return prisma.specialTest.findUnique({
      where: { id },
      include: { conditions: { select: { id: true, name: true } } }
    });
  },

  // Physiology
  async getPhysiologyConcepts(category?: string) {
    return prisma.physiologyConcept.findMany({
      where: category ? { category } : undefined,
      orderBy: { name: 'asc' }
    });
  },

  // Treatments
  async getTreatments(category?: string) {
    return prisma.treatment.findMany({
      where: category ? { category } : undefined,
      orderBy: { name: 'asc' }
    });
  },

  // Differentials
  async getDifferentials(category?: string) {
    return prisma.differentialDiagnosis.findMany({
      where: category ? { category } : undefined,
      orderBy: { presentingComplaint: 'asc' }
    });
  },

  // Imaging
  async getImagingStudies(modality?: string) {
    return prisma.imagingStudy.findMany({
      where: modality ? { modality } : undefined,
      orderBy: { name: 'asc' }
    });
  },

  // Findings
  async getFindings(system?: string) {
    return prisma.physicalExamFinding.findMany({
      where: system ? { system } : undefined,
      orderBy: { name: 'asc' }
    });
  },

  // Guidelines
  async getGuidelines(category?: string) {
    return prisma.practiceGuideline.findMany({
      where: category ? { category } : undefined,
      orderBy: { name: 'asc' }
    });
  }
};
