/**
 * Lightweight guards for common PANaCEa footguns.
 */
export default async () => {
  return {
    "tool.execute.before": async (input: { tool?: string }, output: { args?: Record<string, unknown> }) => {
      const tool = String(input?.tool ?? "")
      const args = output?.args ?? {}

      if (tool !== "edit" && tool !== "write") return

      const filePath = String(args.filePath ?? args.path ?? "")
      const content = String(args.content ?? args.newString ?? args.new_string ?? "")

      if (!filePath && !content) return

      const inFunctions = /(?:^|\/)functions\//.test(filePath)
      const inFrontend =
        /\.(tsx|jsx)$/.test(filePath) &&
        !filePath.includes("functions/") &&
        !filePath.includes("lib/services/")

      if (inFunctions && /process\.env\./.test(content)) {
        throw new Error(
          "panacea-safety: refuse process.env in functions/. Use context.env.* instead.",
        )
      }

      if (
        inFrontend &&
        (/from ['"]@prisma\/client['"]/.test(content) ||
          /from ['"][^'"]*prisma-edge[^'"]*['"]/.test(content) ||
          /new PrismaClient/.test(content))
      ) {
        throw new Error(
          "panacea-safety: refuse Prisma client usage in frontend modules.",
        )
      }

      // Rule 3: No @ts-ignore / @ts-expect-error in functions/ (edge runtime)
      if (inFunctions && /@ts-ignore|@ts-expect-error/.test(content)) {
        throw new Error(
          "panacea-safety: refuse @ts-ignore in functions/. Fix the type properly.",
        )
      }

      // Rule 4: No empty catch blocks in functions/
      if (inFunctions && /catch\s*\([^)]*\)\s*\{\s*\}/.test(content)) {
        throw new Error(
          "panacea-safety: refuse empty catch block in functions/. Log or rethrow.",
        )
      }

      // Rule 5: No Hard/Easy FSRS ratings (binary Again/Good only)
      if (/rating\s*===?\s*['"]hard['"]|rating\s*===?\s*['"]easy['"]/.test(content)) {
        throw new Error(
          "panacea-safety: refuse Hard/Easy FSRS ratings. Binary Again/Good only.",
        )
      }
    },
  }
}
