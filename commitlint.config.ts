import type { UserConfig } from '@commitlint/types';

// Gelato commit-message discipline. Source of truth:
// skills/git-hygiene/SKILL.md § Tool Integration.
// Locked type list — extending it requires a `feat(schema):` change to this
// file and updates to skills/git-hygiene/references/conventional-commits-quick-ref.md.
const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 72],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
  },
};

export default config;
