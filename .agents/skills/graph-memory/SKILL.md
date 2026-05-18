---
name: graph-memory
description: Use this skill when working on graph memory, entity/relation extraction, knowledge graph schemas, graph traversal, GraphRAG, prerequisite graphs, or graph-backed learning paths.
---

# Graph Memory

Use this skill when working on graph memory, entity/relation extraction, knowledge graph schemas, graph traversal, GraphRAG, prerequisite graphs, or graph-backed learning paths.

## First Files

- `prisma/schema.prisma`
- `services/graph/GraphBuilder.ts`
- `services/graph/RelationshipExtractor.ts`
- `lib/services/search/graphRag.ts`
- `functions/api/graph/expand.ts`
- `functions/api/graph/network/[conditionId].ts`
- `functions/api/analytics/knowledge-graph.ts`
- `services/domain/pathFinderService.ts`
- `services/domain/knowledgeGraphService.ts`
- `lib/services/prerequisiteGraphService.ts`

## Loop

extract entities -> extract relations -> update graph -> validate graph consistency -> run traversal tests -> compare against expected answers -> document graph gaps

## Checks

- Edge enum matches relation intent.
- Selected fields match extractor logic.
- No orphan nodes or edges.
- Incoming and outgoing traversal both work.
- Path weights are calculated from actual path edges.
- Low-confidence relation candidates are not promoted without review.
- GraphRAG comments match implementation.

## Commands

- `npm test -- tests/graph/GraphBuilder.test.ts`
- `npm test -- tests/graph/RelationshipExtractor.test.ts`
- `npm test -- lib/services/search/graphRag.test.ts`
- `npm test -- tests/api/graph/path.test.ts`
- `npm test -- tests/api/graph/search.test.ts`
- `npm test -- tests/api/graph/confidence.test.ts`
- `npm run test:memory`
