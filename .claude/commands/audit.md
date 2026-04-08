Audit the files that will be touched before making any changes.

Before implementing anything:
1. Read every file that will be modified — note imports, exports, types, patterns
2. Check `prisma/schema.prisma` for any tables you'll query — verify column names exist
3. Check `config/appViews.ts` and `config/lazyComponents.tsx` if adding views
4. Grep for function names you plan to use — they may already exist
5. Report what you found concisely: which files, what patterns, any conflicts

Do NOT write code during this command. Audit only.
