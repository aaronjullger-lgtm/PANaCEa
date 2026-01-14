import { json } from '@remix-run/cloudflare';
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { prisma } from '../../../../../lib/prisma';
import { z } from 'zod';

const UpdateParentSchema = z.object({
    parentId: z.string().optional(),
    relationshipType: z.enum(['subtype', 'complication', 'manifestation', 'variant']).optional(),
});

export async function action({ request, params }: ActionFunctionArgs) {
    if (request.method !== 'PATCH') {
        return json({ error: 'Method not allowed' }, { status: 405 });
    }

    const { id } = params;
    if (!id) {
        return json({ error: 'Condition ID is required' }, { status: 400 });
    }

    try {
        const data = await request.json();
        const result = UpdateParentSchema.safeParse(data);

        if (!result.success) {
            return json({ error: 'Invalid input', details: result.error.flatten() }, { status: 400 });
        }

        const { parentId, relationshipType } = result.data;

        // Check if condition exists
        const condition = await prisma.medicalContent.findUnique({
            where: { id }
        });

        if (!condition) {
            return json({ error: 'Condition not found' }, { status: 404 });
        }

        // If setting a parentId, check if parent exists
        let canonicalName = condition.canonicalName;

        if (parentId) {
            const parent = await prisma.medicalContent.findUnique({
                where: { id: parentId }
            });

            if (!parent) {
                return json({ error: 'Parent condition not found' }, { status: 404 });
            }

            // Inherit canonical name from parent (or use parent's own canonical name if set)
            canonicalName = parent.canonicalName || parent.condition;
        } else if (parentId === null) {
            // Clearing parent
            canonicalName = null;
        }

        // Update condition
        const updated = await prisma.medicalContent.update({
            where: { id },
            data: {
                parentId,
                relationshipType,
                canonicalName
            }
        });

        return json({ success: true, condition: updated });

    } catch (error) {
        console.error('Error updating parent relationship:', error);
        return json({ error: 'Failed to update relationship' }, { status: 500 });
    }
}
