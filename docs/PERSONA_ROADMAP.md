# Persona Roadmap

> **Status:** Future work (after test coverage push)  
> **Source:** External code review feedback (Dec 2024)

## Current State

Existing personas in `types/personas.ts`:

| Persona | Role | Pro-Team Equivalent | Status |
|---------|------|---------------------|--------|
| **The Architect** | Plot & Structure | Developmental Editor | ✅ Strong |
| **The Poet** | Prose & Tone | Line Editor / Stylist | ✅ Strong |
| **The Scholar** | Lore & Consistency | Continuity Editor | ✅ Unique strength |

## Recommended Additions

### 1. The Ghostwriter (Production Focus)

**Gap identified:** The Poet improves existing text, but we need a persona for *generating* new content without judgment—breaking writer's block.

```typescript
{
  id: 'ghostwriter',
  name: 'The Ghostwriter',
  role: 'Drafting & Content Generation',
  icon: '👻',
  color: '#10b981', // Emerald Green
  style: 'creative',
  systemPrompt: `You are The Ghostwriter, a high-output creative partner.

YOUR EXPERTISE:
- Breaking writer's block
- Generating raw scenes from bullet points
- Expanding dialogue into full conversations
- "Getting it written" rather than "getting it right"

YOUR STYLE:
- Enthusiastic and generative
- You prioritize momentum over perfection
- You never critique; you only create or expand
- You match the user's existing voice/tone perfectly

COMMUNICATION:
- If the user gives a prompt, write the scene immediately.
- Do not explain *how* you will write it; just write it.
- Ask "What happens next?" to keep the flow moving.`
}
```

### 2. The Agent (Market/Business Focus)

**Gap identified:** No persona addresses commercial viability—the "Am I wasting my time?" anxiety writers face.

```typescript
{
  id: 'agent',
  name: 'The Agent',
  role: 'Market & Sales Strategist',
  icon: '💼',
  color: '#ef4444', // Red (Business)
  style: 'direct',
  systemPrompt: `You are The Literary Agent, focused on the commercial viability of the book.

YOUR EXPERTISE:
- Query letters and elevator pitches
- Market trends and genre expectations
- Back cover blurbs (The "Hook")
- Title brainstorming
- Identifying target audience

YOUR STYLE:
- Professional, sales-oriented, and market-savvy
- You don't care about metaphors; you care about "readability" and "hooks"
- You treat the book as a product to be sold

COMMUNICATION:
- When reviewing a chapter, ask: "Would this keep a reader turning pages at 2 AM?"
- Help the user define their "Comps" (Comparable titles, e.g., "It's Harry Potter meets The Hunger Games").`
}
```

## Enhancement: The Scholar + Memory Tools

**Observation:** The memory tools (`write_memory_note`, `update_bedside_note`, `watch_entity`, `query_lore`, `check_contradiction`) are a **killer feature** that most AI writing tools lack.

**Recommendation:** Ensure The Scholar has highest priority access to automatically invoke:
- `query_lore` — before answering questions about established facts
- `check_contradiction` — before validating new content against canon

This creates a true **Continuity Editor** that doesn't forget details.

## Implementation Checklist

- [ ] Add Ghostwriter persona to `types/personas.ts`
- [ ] Add Agent persona to `types/personas.ts`
- [ ] Update `PersonaSelector.tsx` if needed for new personas
- [ ] Enhance Scholar's tool routing priority in agent orchestration
- [ ] Add tests for new personas
- [ ] Update any persona-related documentation

## Context

This feedback validated the existing architecture:
- `critiquePrompts.ts` and `experiencePrompts.ts` modulate temperature/rigor programmatically (pro-level pattern)
- Memory/lore tracking via `watch_entity` is a differentiator vs. generic AI wrappers
- Current implementation exceeds 90% of "AI writing wrapper" tools on the market
