# Admin and Owner Manual

## Main tools
- all portal modules
- `Settings`
- `Audit Log`
- `Master Data`
- user and role management

## Core responsibilities
- manage role access
- verify routing and module visibility
- oversee pricing, statuses, personnel, and system settings
- review audit trails
- correct bad operational state when users make mistakes

## High-impact checks
- confirm the correct user has the correct role
- confirm messaging is enabled only where intended
- confirm estimator and job visibility rules are behaving correctly
- confirm shared job IDs are not fragmenting into duplicates

## Workflow corrections admins can perform
- reassign work
- review or correct settings and personnel mappings
- inspect RFQ/quote/deal state issues
- revert mistaken quote-to-deal conversions
- filter `Quote Log` by estimator assignee in either `log` or `pipeline` mode
- use `Opportunities` filters to review owner and estimator load across the CRM workspace
- review dealer-facing project state from `/dealer-log` using stage, search, and table/cards views without exposing hidden duplicates or internal cost-file detail

## Best practices
- use admin visibility to audit, not to bypass normal workflow discipline
- check the tool change log after deployments or major merges
- use `docs/WORKFLOW_COMPLETION_PHASE_2_RELEASE_CHECKLIST.md` before deployment when workflow-completion features are in scope
- keep the dealer and vendor experience clean by avoiding unnecessary manual overrides
