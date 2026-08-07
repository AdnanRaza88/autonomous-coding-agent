# Frontend Page Specifications

All pages use a single design system: Clean Soft SaaS (light theme only).

- White elevated cards with subtle border and soft shadow
- Blue primary accent
- Pill status badges
- No neumorphism, claymorphism, or multi-style mixing

## Global Layout

- Sticky top navigation with logo and primary links
- Centered main content (max-width 1200px)
- Consistent page titles and section labels

## Pages

### 1. Dashboard
KPI tiles (success rate, active sessions, avg time to PR, escalations) and recent activity card.

### 2. Active Sessions
List of session cards: issue title, repo, id, iteration, status badge. Click opens Session Detail.

### 3. Session Detail
Two-column grid: Plan and Test Output; full-width Event Stream; action row (Approve Plan, Inject Guidance, Force PR, Abort).

### 4. Repository Settings
Connected repositories and policy controls (sandbox image, network allow-list, iteration limits).

### 5. Evaluation
Primary metric tiles and recent evaluation runs summary.

### 6. History
Search input and archive list of past sessions.

## CSS Classes

| Class | Use |
|-------|-----|
| .card | Panels and list rows |
| .btn / .btn-primary | Actions |
| .badge / .badge-* | Status |
| .metric-tile | KPI blocks |
| .input | Search and forms |
