import { z } from 'zod';

// Canonical Zod schema for Gelato SKILL.md frontmatter.
// TEMPLATE.md is the human-readable summary; this file is the source of
// truth. Any mismatch is a bug in TEMPLATE.md.

export const MethodologySource = z.object({
  name: z.string().min(1).max(128),
  authority: z.string().min(1).max(256),
  url: z.string().url(),
  version: z.string().min(1).max(128),
  verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'verified must be YYYY-MM-DD'),
});

// `methodology_source` accepts a single object or an array — the Stage 5
// refinement captured in TEMPLATE.md. Multi-source skills (e.g. rsc-boundary-
// audit) use the array form.
export const MethodologySourceField = z.union([
  MethodologySource,
  z.array(MethodologySource).min(1),
]);

export const EvalMetadata = z.object({
  // All three are runner-owned. `null` is the only allowed hand-written value
  // (for a freshly-scaffolded skill whose eval has never run). Any other
  // hand-edit is rejected by CI via scripts/validate-skills.ts.
  pass_rate: z.number().min(0).max(1).nullable(),
  last_run: z.union([z.string().min(1), z.null()]),
  n_cases: z.union([z.number().int().nonnegative(), z.null()]),
});

// ---------- Cores ----------
//
// Gelato charters six cores (BRIEF.md § The six functions). Core 1 (Web Dev)
// shipped at v0.3.0 with 32 skills. v0.4.0 opens the schema to Cores 2-6 via
// the discriminated union below — each core declares its own subsystem enum
// so cross-core names (Web Dev's `ui` vs Brand & Content's `landing`) cannot
// collide.

export const WebDevSubsystem = z.enum([
  'foundations',
  'data',
  'server',
  'ui',
  'testing',
  'performance',
  'seo',
  'security',
  'observability',
  'analytics',
  'deployment',
]);

export const BrandContentSubsystem = z.enum([
  'identity',
  'positioning',
  'landing',
  'product-copy',
  'content',
  'email',
]);

export const GrowthDistributionSubsystem = z.enum([
  'deliverability',
  'launch',
  'community',
  'analytics',
  'email',
]);

export const FounderOpsSubsystem = z.enum([
  'prioritization',
  'planning',
  'goals',
  'collaboration',
  'ritual',
  'finance',
]);

export const ResearchSynthesisSubsystem = z.enum([
  'discovery',
  'positioning',
  'ethics',
  'ux-research',
  'synthesis',
]);

export const MetaSubsystem = z.enum(['extensibility', 'maintenance', 'distribution']);

// Legacy alias — any caller that imported `Subsystem` from v0.3.0 keeps
// working, because Web Dev was the only live enum through that release.
export const Subsystem = WebDevSubsystem;

export const Phase = z.enum(['build', 'verify', 'run']);

export const SkillType = z.enum(['procedural', 'judgment', 'metric']);

// Shared fields every SKILL.md frontmatter carries regardless of core.
const CommonMetadata = {
  version: z.string().min(1),
  phase: Phase,
  type: SkillType,
  methodology_source: MethodologySourceField,
  stack_assumptions: z.array(z.string().min(1)).min(1),
  eval: EvalMetadata,
  changelog: z.string().min(1),
};

// Discriminated union on `core` — each core's block enforces its own
// subsystem enum. Keeps SKILL.md authors from typing `subsystem: landing`
// under `core: web-dev`.
export const SkillMetadata = z.discriminatedUnion('core', [
  z.object({ ...CommonMetadata, core: z.literal('web-dev'), subsystem: WebDevSubsystem }),
  z.object({
    ...CommonMetadata,
    core: z.literal('brand-content'),
    subsystem: BrandContentSubsystem,
  }),
  z.object({
    ...CommonMetadata,
    core: z.literal('growth-distribution'),
    subsystem: GrowthDistributionSubsystem,
  }),
  z.object({
    ...CommonMetadata,
    core: z.literal('founder-ops'),
    subsystem: FounderOpsSubsystem,
  }),
  z.object({
    ...CommonMetadata,
    core: z.literal('research-synthesis'),
    subsystem: ResearchSynthesisSubsystem,
  }),
  z.object({ ...CommonMetadata, core: z.literal('meta'), subsystem: MetaSubsystem }),
]);

export const SkillFrontmatter = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9-]*$/, 'name must be kebab-case'),
  description: z.string().min(1).max(1024),
  license: z.literal('MIT'),
  metadata: SkillMetadata,
});

// All published cores — stable reference list. Append only; never reorder
// (external JSON-schema consumers may lock indices).
export const CORES = [
  'web-dev',
  'brand-content',
  'growth-distribution',
  'founder-ops',
  'research-synthesis',
  'meta',
] as const;

export type Core = (typeof CORES)[number];

export type MethodologySourceT = z.infer<typeof MethodologySource>;
export type MethodologySourceFieldT = z.infer<typeof MethodologySourceField>;
export type EvalMetadataT = z.infer<typeof EvalMetadata>;
export type WebDevSubsystemT = z.infer<typeof WebDevSubsystem>;
export type BrandContentSubsystemT = z.infer<typeof BrandContentSubsystem>;
export type GrowthDistributionSubsystemT = z.infer<typeof GrowthDistributionSubsystem>;
export type FounderOpsSubsystemT = z.infer<typeof FounderOpsSubsystem>;
export type ResearchSynthesisSubsystemT = z.infer<typeof ResearchSynthesisSubsystem>;
export type MetaSubsystemT = z.infer<typeof MetaSubsystem>;
export type SubsystemT = WebDevSubsystemT; // legacy alias
export type PhaseT = z.infer<typeof Phase>;
export type SkillTypeT = z.infer<typeof SkillType>;
export type SkillMetadataT = z.infer<typeof SkillMetadata>;
export type SkillFrontmatterT = z.infer<typeof SkillFrontmatter>;
