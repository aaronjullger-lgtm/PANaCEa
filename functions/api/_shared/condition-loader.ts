
interface ConditionContentData {
  overview?: string;
  etiologyPathophysiology?: string;
  epidemiology?: string;
  clinicalPresentation?: string;
  symptoms?: string[];
  examFindings?: string[];
  riskFactors?: string[];
  diagnostics?: {
    notes: string;
  };
  treatment?: string[];
  management?: string[];
  complications?: string[];
  prognosis?: string;
}

export interface LoadedConditionData {
  conditionId: string;
  name: string;
  system: string;
  subcategory: string;
  content: ConditionContentData;
}

export async function loadConditionData(prisma: any, queryText: string): Promise<LoadedConditionData | null> {
  try {
    // Simple search strategy: exact match or contains
    // In production, use full text search or vector search
    
    let record = await prisma.medicalContent.findFirst({
      where: {
        OR: [
          { condition: { equals: queryText, mode: 'insensitive' } },
          { condition: { contains: queryText, mode: 'insensitive' } }
        ],
        status: 'published'
      }
    });

    if (!record) {
      return null;
    }

    const content: ConditionContentData = {
      overview: record.overview || undefined,
      etiologyPathophysiology: [
        record.etiology ? `**Etiology**\n\n${record.etiology}` : null,
        record.pathophysiology ? `**Pathophysiology**\n\n${record.pathophysiology}` : null
      ].filter(Boolean).join('\n\n') || undefined,
      epidemiology: record.epidemiology || undefined,
      symptoms: record.symptoms.length > 0 ? record.symptoms : undefined,
      examFindings: record.physicalExam.length > 0 ? record.physicalExam : undefined,
      riskFactors: record.riskFactors.length > 0 ? record.riskFactors : undefined,
      diagnostics: record.diagnostics && typeof record.diagnostics === 'object' ? (record.diagnostics as any) : undefined,
      treatment: record.treatment && Array.isArray(record.treatment) ? (record.treatment as string[]) : undefined,
      prognosis: record.prognosis || undefined,
      complications: record.complications.length > 0 ? record.complications : undefined,
    };

    return {
      conditionId: record.conditionId,
      name: record.condition,
      system: record.system,
      subcategory: record.subcategory,
      content
    };
  } catch (error) {
    console.error('Error loading condition data:', error);
    return null;
  }
}
