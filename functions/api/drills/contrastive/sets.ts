
import { json } from '@remix-run/cloudflare';
import { prisma } from '../../../../lib/prisma'; // Adjust import based on your project structure

export async function onRequestGet({ request, env }: any) {
    const url = new URL(request.url);
    const symptom = url.searchParams.get('symptom');
    const system = url.searchParams.get('system');
    const highYield = url.searchParams.get('highYield') === 'true';

    const where: any = {};
    if (symptom) where.symptom = symptom;
    if (system) where.system = system;
    if (highYield) where.highYield = highYield;

    const sets = await prisma.contrastiveSet.findMany({
        where,
        orderBy: { symptom: 'asc' },
    });

    return json({ sets, total: sets.length });
}
