# Auto-Author Quick Reference

## 🚀 Quick Start

```bash
# Generate content for missing conditions (production)
npm run generate:missing-content

# Test the system (no database changes)
npm run test:auto-author

# Preview what would be processed
tsx scripts/generateMissingContent.ts --dry-run
```

## 📋 Common Commands

| Command                                                     | Description                                      |
| ----------------------------------------------------------- | ------------------------------------------------ |
| `npm run generate:missing-content`                          | Generate content for all conditions missing data |
| `npm run test:auto-author`                                  | Test AI generation without database              |
| `tsx scripts/generateMissingContent.ts --dry-run`           | Preview conditions that need content             |
| `tsx scripts/generateMissingContent.ts --max-conditions=25` | Process only 25 conditions                       |
| `tsx scripts/generateMissingContent.ts --extended`          | Include extended fields (epidemiology, etc.)     |
| `tsx scripts/generateMissingContent.ts --delay=3000`        | Increase delay to 3 seconds                      |

## 🎯 Typical Workflow

```bash
# 1. Sync registries (adds new conditions)
npm run sync:all-registries

# 2. Check what needs content
tsx scripts/generateMissingContent.ts --dry-run

# 3. Generate content (start small)
tsx scripts/generateMissingContent.ts --max-conditions=25

# 4. Review in database
npm run db:studio

# 5. Generate more if needed
npm run generate:missing-content
```

## 🔧 Configuration

### Environment Variables

```bash
# Required
export GEMINI_API_KEY=your_key_here

# Optional
export DATABASE_URL=postgresql://...
export DIRECT_DATABASE_URL=postgresql://...
```

### Command-Line Flags

- `--max-conditions=N` - Process at most N conditions (default: 100)
- `--delay=MS` - Delay between API calls in ms (default: 2000)
- `--dry-run` - Preview only, no database changes
- `--extended` - Include extended fields (epidemiology, complications)

## 📊 Content Structure

```typescript
// Core fields (always generated)
overview: string
symptoms: string[]
riskFactors: string[]
diagnosis: string
treatment: string
clinicalPearls: string[]

// Extended fields (with --extended)
etiologyPathophysiology?: string
epidemiology?: string
examFindings?: string[]
complications?: string[]
prognosis?: string
differentialDiagnosis?: string[]
```

## ⚡ Performance Tips

- **Start small**: Use `--max-conditions=25` for first run
- **Rate limiting**: Keep `--delay` at 2000ms or higher
- **Cost**: ~$0.001 per condition (100 conditions ≈ $0.10)
- **Speed**: ~3-5 seconds per condition

## 🐛 Troubleshooting

| Error               | Solution                                            |
| ------------------- | --------------------------------------------------- |
| Missing API key     | Set `GEMINI_API_KEY` env var                        |
| Database connection | Check `DATABASE_URL` in `.env`                      |
| Rate limit exceeded | Increase `--delay` or reduce `--max-conditions`     |
| Invalid JSON        | Script retries automatically                        |
| No conditions found | All content already exists (check with `--dry-run`) |

## 📁 File Locations

```
lib/services/autoAuthor/
├── index.ts              # Main orchestrator
├── types.ts              # TypeScript interfaces
├── contentGenerator.ts   # AI generation
└── databaseService.ts    # Database operations

scripts/
├── generateMissingContent.ts  # Production runner
└── testAutoAuthor.ts          # Test script

docs/
├── AUTO_AUTHOR_GUIDE.md           # Full documentation
└── AUTO_AUTHOR_IMPLEMENTATION.md  # Implementation details
```

## 🔗 Integration Examples

### With Registry Sync

```bash
npm run sync:all-registries && npm run generate:missing-content
```

### Scheduled Automation

```typescript
import { autoAuthorMissingContent } from '../lib/services/autoAuthor';

await autoAuthorMissingContent(apiKey, {
  maxConditions: 50,
  includeExtendedFields: true,
});
```

## 📈 Monitoring

```bash
# Check database stats
npm run db:studio

# View content completion
SELECT
  system,
  COUNT(*) as total,
  COUNT(CASE WHEN content->>'overview' IS NOT NULL THEN 1 END) as complete
FROM "Condition"
GROUP BY system;
```

## 🎓 Best Practices

1. ✅ Always start with `--dry-run` to preview
2. ✅ Process 25-50 conditions at a time initially
3. ✅ Monitor API costs in Google Cloud Console
4. ✅ Review generated content periodically in Prisma Studio
5. ✅ Keep `--delay` at 2000ms+ to avoid rate limits
6. ⚠️ Never commit API keys to version control

## 🆘 Need Help?

- Full docs: `AUTO_AUTHOR_GUIDE.md`
- Implementation: `AUTO_AUTHOR_IMPLEMENTATION.md`
- Test connectivity: `npm run test:auto-author`
- Database review: `npm run db:studio`
