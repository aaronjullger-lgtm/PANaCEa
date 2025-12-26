# Repository Organization Plan

## New Folder Structure

```
StudyPANaCEa/
├── docs/                          # All documentation
│   ├── architecture/              # System architecture docs
│   ├── deployment/                # Deployment guides
│   ├── development/               # Developer guides
│   ├── features/                  # Feature implementation docs
│   ├── guides/                    # User/setup guides
│   └── archive/                   # Old/deprecated docs
├── scripts/
│   ├── generators/                # Content generators (already exists)
│   ├── maintenance/               # Maintenance scripts (already exists)
│   ├── automation/                # Automated tasks (already exists)
│   ├── db/                        # Database scripts (already exists)
│   ├── utils/                     # Utility scripts (already exists)
│   ├── migration/                 # Migration scripts (new)
│   ├── seed/                      # Database seeding (new)
│   └── deprecated/                # Old scripts to be removed
├── config/                        # Configuration files
├── backup/                        # Database backups (rename from backups)
└── (keep existing src/, components/, etc.)
```

## Files to Organize

### Documentation (move to docs/)
- All *.md files from root
- Organize by category

### Scripts (organize in scripts/)
- Seed scripts → scripts/seed/
- Migration scripts → scripts/migration/
- Deprecated scripts → scripts/deprecated/

### Registry Files
- Keep in root (they're imported directly)
- These are active code files

### To Delete
- *.backup files
- *.DEPRECATED files
- *.DELETED files
- Duplicate/old scripts
