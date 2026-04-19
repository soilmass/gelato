import { z } from 'zod';

// Canonical Zod schema for Gelato SKILL.md frontmatter.
// TEMPLATE.md v1.0 is the human-readable summary; this file is the source of
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

export const Subsystem = z.enum([
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

export const Phase = z.enum(['build', 'verify', 'run']);

export const SkillType = z.enum(['procedural', 'judgment', 'metric']);

export const SkillMetadata = z.object({
  version: z.string().min(1),
  core: z.literal('web-dev'),
  subsystem: Subsystem,
  phase: Phase,
  type: SkillType,
  methodology_source: MethodologySourceField,
  stack_assumptions: z.array(z.string().min(1)).min(1),
  eval: EvalMetadata,
  changelog: z.string().min(1),
});

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

export type MethodologySourceT = z.infer<typeof MethodologySource>;
export type MethodologySourceFieldT = z.infer<typeof MethodologySourceField>;
export type EvalMetadataT = z.infer<typeof EvalMetadata>;
export type SubsystemT = z.infer<typeof Subsystem>;
export type PhaseT = z.infer<typeof Phase>;
export type SkillTypeT = z.infer<typeof SkillType>;
export type SkillMetadataT = z.infer<typeof SkillMetadata>;
export type SkillFrontmatterT = z.infer<typeof SkillFrontmatter>;
