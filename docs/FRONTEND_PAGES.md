# Frontend Page Specifications

All pages follow the light-theme design system defined in the README. Glassmorphism, soft neumorphism, and claymorphism are combined for depth while remaining clean and professional.

## Global Layout

- Top navigation bar with logo, primary links, and user avatar.
- Left sidebar for secondary navigation on large screens; collapses to icons on medium screens.
- Main content area with generous padding and soft background gradient.
- Persistent status indicator for the currently selected session (when applicable).

## 1. Dashboard

Purpose: High-level health and recent activity.

Sections:

- KPI cards (success rate, active sessions, average time to PR, escalations today)
- Activity feed of recent session state changes
- Quick actions: Start new session from issue URL, view evaluation report
- Mini chart of success rate over the last 14 days

## 2. Active Sessions

Purpose: Monitor running and recently completed agent runs.

- Filterable table or card grid: session id, repository, issue title, status, iteration, elapsed time
- Status badges with soft clay colors (planning, coding, testing, reflecting, pr_ready, failed, completed)
- Click to open Session Detail
- Bulk actions: pause, abort

## 3. Session Detail

Purpose: Full observability and human intervention for a single run.

Layout:

- Left column: live event stream and tool-call log
- Center: current plan (editable), reflection history, latest diffs
- Right column: test output panel, sandbox resource gauges, action buttons (approve plan, inject guidance, force PR, abort)

Real-time updates via WebSocket. Diff viewer supports side-by-side and unified modes.

## 4. Repository Settings

Purpose: Configure which repositories the agent may act on and their policies.

- List of connected repositories with status (enabled / disabled)
- Per-repository settings:
  - Allowed base images
  - Network allow-list additions
  - Secret references
  - Max iterations and confidence thresholds
  - Automatic plan approval toggle
  - Label that triggers the agent

## 5. Evaluation

Purpose: View evaluation suite results and trends.

- Summary cards for primary metrics
- Table of recent evaluation runs with pass/fail counts
- Drill-down into individual task results with links to the corresponding agent sessions
- Regression alerts panel

## 6. History

Purpose: Searchable archive of all past sessions.

- Full-text search across issue titles, plan summaries, and reflection hypotheses
- Date range and status filters
- Export of session transcripts

## Component Library Notes

Reusable components used across pages:

- GlassCard: translucent background with blur and subtle border
- SoftButton: neumorphic raised or inset variants
- ClayBadge: rounded, softly extruded status indicators
- MetricTile: large number with label and optional trend arrow
- LogStream: monospace, auto-scrolling, filterable by event type
- DiffViewer: syntax-highlighted, collapsible hunks

All interactive elements have visible focus states and sufficient contrast for accessibility.
