# PRPs (Pull Request Proposals)

## What is a PRP?

A PRP (Pull Request Proposal) is a structured document that defines a specific task, feature, or fix before implementation. It serves as both a specification and a checklist for development.

## Directory Structure

```
PRPs/
├── templates/          # Reusable PRP templates
│   ├── prp-base-template.md
│   ├── prp-bug-template.md
│   └── prp-refactor-template.md
└── features/          # Your actual PRPs for this project
    └── (your PRPs go here)
```

## How to Use PRPs

### Creating a New PRP

1. Choose an appropriate template from `templates/`
2. Copy it to `features/` with a descriptive name
3. Fill out all sections completely
4. Reference the PRP when implementing

### PRP Naming Convention

- Feature: `prp-feature-[feature-name].md`
- Bug Fix: `prp-bug-[issue-description].md`
- Refactor: `prp-refactor-[component-name].md`

### Example Workflow

```bash
# Create a new feature PRP
cp PRPs/templates/prp-base-template.md PRPs/features/prp-feature-user-auth.md

# Edit the PRP with your specifications
# Then implement based on the PRP
```

## Benefits

- **Clear Scope**: Each task has defined boundaries
- **Better Planning**: Think through implementation before coding
- **Documentation**: PRPs serve as project documentation
- **AI-Friendly**: Structured format helps AI assistants understand context

## Project-Specific PRPs

Add your Justice Watch app PRPs to the `features/` directory. Some suggested PRPs:

- `prp-feature-court-scraping.md` - Scraping court data
- `prp-feature-case-tracking.md` - Case management system
- `prp-feature-notifications.md` - Alert system for case updates
- `prp-bug-navigation-flow.md` - Fix scraper navigation issues