import { Drug } from '@prisma/client';

// Fallback to static drug registry when database API is unavailable
async function getStaticDrugs(): Promise<Drug[]> {
  try {
    const { getAllDrugs } = await import('../drugRegistry');
    const drugMetas = getAllDrugs();
    
    // Convert DrugMeta[] to Drug[] format expected by consumers
    return drugMetas.map((meta) => ({
      id: `drug_${meta.genericName.toLowerCase().replace(/\s+/g, '_')}`,
      genericName: meta.genericName,
      brandName: meta.brandName || null,
      drugClass: meta.drugClass,
      mechanismOfAction: meta.mechanismOfAction || null,
      indications: meta.indications || [],
      contraindications: meta.contraindications || [],
      sideEffects: meta.commonSideEffects || [],
      interactions: [],
      dosing: null,
      displayName: meta.displayName || meta.genericName,
      aliases: meta.aliases || [],
      tags: [],
      isHighYield: meta.isHighYield,
      clinicalNotes: null,
      antidote: null,
      metabolism: null,
      elimination: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  } catch (error) {
    console.error('Failed to load static drug registry:', error);
    return [];
  }
}

export const drugService = {
  getAll: async (limit?: number): Promise<Drug[]> => {
    try {
      const query = limit ? `?limit=${limit}` : '';
      const response = await fetch(`/api/drugs${query}`);
      
      // Check if response is OK and is JSON
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Database API unavailable, using static drug registry');
    }
    
    // Fallback to static registry
    const staticDrugs = await getStaticDrugs();
    return limit ? staticDrugs.slice(0, limit) : staticDrugs;
  },

  getRandom: async (count: number = 10): Promise<Drug[]> => {
    try {
      const response = await fetch(`/api/drugs/random?count=${count}`);
      
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Database API unavailable, using static drug registry');
    }
    
    // Fallback to static registry with random selection
    const staticDrugs = await getStaticDrugs();
    const shuffled = staticDrugs.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  },
  
  search: async (query: string): Promise<Drug[]> => {
    try {
      const response = await fetch(`/api/drugs/search?q=${encodeURIComponent(query)}`);
      
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Database API unavailable, using static drug registry');
    }
    
    // Fallback to static registry with client-side search
    const staticDrugs = await getStaticDrugs();
    const lowerQuery = query.toLowerCase();
    return staticDrugs.filter(drug => 
      drug.genericName.toLowerCase().includes(lowerQuery) ||
      drug.brandName?.toLowerCase().includes(lowerQuery) ||
      drug.aliases.some(alias => alias.toLowerCase().includes(lowerQuery)) ||
      drug.drugClass.some(cls => cls.toLowerCase().includes(lowerQuery))
    );
  }
};
