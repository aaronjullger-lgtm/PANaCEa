import { json } from '@remix-run/cloudflare';
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { prisma } from '../../../../lib/prisma';

export async function loader({ request, params }: LoaderFunctionArgs) {
    const { canonicalName } = params;

    if (!canonicalName) {
        return json({ error: 'Canonical name is required' }, { status: 400 });
    }

    try {
        const decodedName = decodeURIComponent(canonicalName);

        // Find all members of this family
        const members = await prisma.medicalContent.findMany({
            where: {
                canonicalName: { equals: decodedName, mode: 'insensitive' }
            },
            select: {
                id: true,
                condition: true,
                canonicalName: true,
                relationshipType: true,
                parentId: true
            }
        });

        if (members.length === 0) {
            return json({ error: 'Family not found' }, { status: 404 });
        }

        // Identify parent (no parentId, or id matches parentId of others, or explicitly matches canonical name)
        const parent = members.find(m =>
            m.condition.toLowerCase() === decodedName.toLowerCase() ||
            (m.canonicalName === m.condition) ||
            !m.parentId
        );

        return json({
            canonicalName: decodedName,
            parent,
            members: members.filter(m => m.id !== parent?.id)
        });

    } catch (error) {
        console.error('Error fetching condition family:', error);
        return json({ error: 'Failed to fetch condition family' }, { status: 500 });
    }
}
