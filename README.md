# Autonomous Coding Agent

Devin-style autonomous coding agent that turns GitHub issues into tested pull requests.

**Pipeline:** Issue → Plan → Code → Test → Reflect & Self-Correct → PR

**Backend:** LangGraph + Docker sandbox + GitHub API  
**Frontend:** Professional light-theme control panel

## Repository Contents

```
docs/
  PRD.md
  ARCHITECTURE.md
  TOOL_SCHEMA.md
  SELF_DEBUGGING_LOOP.md
  SANDBOX_STRATEGY.md
  EVALUATION_METRICS.md
  DOCUMENT_TRACKER.md
  FRONTEND_PAGES.md
backend/
  agent/
  sandbox/
  tools/
frontend/
  src/
    components/
    pages/
    styles/
    hooks/
```

All product and design documentation lives inside this repository.

## Design System

The control panel uses a strict light theme only. Dark mode is not supported in the initial release.

### Visual Language

Three complementary techniques are combined:

1. **Glassmorphism**  
   Translucent surfaces with backdrop blur, soft borders, and subtle inner glow. Used for cards, side panels, and floating action bars.

2. **Soft Neumorphism**  
   Soft extruded or inset elements with dual shadows (light and dark). Used for buttons, input fields, and metric tiles.

3. **Claymorphism**  
   Rounded, softly 3D shapes with inner and outer shadows that give a clay-like tactile feel. Used for status badges, avatars, and primary action buttons.

### Color Palette (Light Only)

| Token | Value | Usage |
|-------|-------|-------|
| --bg-base | #F5F7FA | Page background |
| --bg-elevated | #FFFFFF | Cards and panels |
| --bg-glass | rgba(255, 255, 255, 0.72) | Glass surfaces |
| --border-soft | rgba(0, 0, 0, 0.06) | Subtle borders |
| --text-primary | #1A1D26 | Primary text |
| --text-secondary | #5C6370 | Secondary text |
| --accent | #3B82F6 | Primary actions and links |
| --accent-soft | #DBEAFE | Accent backgrounds |
| --success | #10B981 | Success states |
| --warning | #F59E0B | Warning states |
| --danger | #EF4444 | Error and abort states |
| --shadow-light | rgba(255, 255, 255, 0.8) | Neumorphic highlight |
| --shadow-dark | rgba(163, 177, 198, 0.35) | Neumorphic shadow |

### Typography

- Primary: Inter (system fallback: system-ui)
- Monospace: JetBrains Mono / ui-monospace
- Scale: 12 / 14 / 16 / 20 / 24 / 32 px with tight tracking on headings

### Spacing and Radius

- Base unit: 4 px
- Card radius: 16 px (clay) or 12 px (glass)
- Button radius: 12 px
- Badge radius: 999 px

### Component Tokens

```css
.glass-card {
  background: var(--bg-glass);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-soft);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
}

.soft-button {
  background: var(--bg-elevated);
  border-radius: 12px;
  box-shadow:
    6px 6px 12px var(--shadow-dark),
    -6px -6px 12px var(--shadow-light);
}

.soft-button:active {
  box-shadow:
    inset 4px 4px 8px var(--shadow-dark),
    inset -4px -4px 8px var(--shadow-light);
}

.clay-badge {
  border-radius: 999px;
  padding: 4px 12px;
  box-shadow:
    2px 2px 4px var(--shadow-dark),
    -2px -2px 4px var(--shadow-light),
    inset 1px 1px 2px rgba(255, 255, 255, 0.6);
}
```

### Page Inventory

See `docs/FRONTEND_PAGES.md` for detailed specifications of:

- Dashboard
- Active Sessions
- Session Detail
- Repository Settings
- Evaluation
- History

### Figma Designs

Design file: https://www.figma.com/design/jMMcvPdKO8KWJ5iNwJ0Hur

Contains Dashboard, Active Sessions, and Session Detail frames using the light-theme glass + soft neu + clay design system.

### Accessibility

- Minimum contrast ratio 4.5:1 for all text
- Visible focus rings on every interactive element
- Keyboard navigation for all primary flows
- Reduced-motion preference respected for blur and shadow transitions

## Quick Start (Development)

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn agent.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## License

Proprietary. All rights reserved.
