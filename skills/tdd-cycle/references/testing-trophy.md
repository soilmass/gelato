# Testing Trophy

Kent C. Dodds' model for distributing tests across levels. Replaces the older "pyramid" and roughly inverts it — the most tests live at **integration**, not **unit**.

```
           ┌──────────────┐
           │     End      │   few
           │   -to-end    │
           ├──────────────┤
           │              │
           │ Integration  │   most
           │              │
           ├──────────────┤
           │    Unit      │   some
           ├──────────────┤
           │   Static     │   foundation (TS, eslint)
           └──────────────┘
```

## What belongs at each level

- **Static** — TypeScript, ESLint/Biome, strict mode. Catches type errors, unreachable code, missing returns. Free after setup.
- **Unit** — pure-logic functions (`toSlug`, `formatCurrency`, reducers). A unit test is fast and targets one small thing.
- **Integration** — a component rendered through React + its hooks + a fake fetch, exercised from the user's POV (click, type, read screen output). Kent's "sweet spot" — the most bugs live in the seams between units.
- **End-to-end** — full-stack flow through a real browser. `playwright-e2e` owns this level. Few tests because each is expensive and slow.

## Why the inversion

Classic pyramid advice (many unit, few integration) optimizes for speed. But most real-world bugs are integration bugs — a well-tested `toSlug` + a well-tested `PostCard` + a well-tested `fetchPosts` can still combine into a broken page. Integration tests catch those.

## What this skill enforces vs. encourages

The deterministic classifier flags the four most common *shape* anti-patterns — missing assertions, implementation-detail coupling, Enzyme-style APIs, undocumented skips. The *count ratio* between unit and integration is not enforced; that's a team judgment call and depends on the codebase's shape.

## Further reading (outside Gelato scope)

- Kent C. Dodds' original Testing Trophy post — the primary source this skill cites
- Testing Library docs' "Guiding Principles" — the "test the way users use the app" principle that underlies rule #7 in the skill
