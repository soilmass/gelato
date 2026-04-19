# Chris Beams — Seven Rules of a Great Git Commit Message

Canonical essay: <https://cbea.ms/git-commit/>

1. **Separate subject from body with a blank line.**
2. **Limit the subject line to 50 characters.** Gelato extends to 72 to accommodate the Conventional Commits `<type>(<scope>):` prefix. Stay under 50 for the *meaningful* part where possible.
3. **Capitalize the subject line.** In Conventional Commits that means capitalizing the first word *after* the colon: `feat(skills): Add core-web-vitals-audit skill`.
4. **Do not end the subject line with a period.**
5. **Use the imperative mood in the subject line.** *"Add auth middleware"*, not *"Added auth middleware"* or *"Adds auth middleware"*. Read the subject as the instruction a maintainer would give: *"If applied, this commit will …"*.
6. **Wrap the body at 72 characters.** Hard-wrap so `git log` displays cleanly in an 80-column terminal.
7. **Use the body to explain what and why vs. how.** The diff already shows *what* and *how*; the body exists for *why* — the motivation, the constraints, the consequences.

## Applied to Gelato

- Rules 1, 4, 5, 6 are enforced mechanically by Commitlint (`header-max-length`, `body-max-line-length`, imperative-mood heuristic in the eval).
- Rules 2, 3 are tuned to Conventional Commits (subject length 72, capitalization *after* the type:scope prefix).
- Rule 7 is the high-leverage one for future readers. A commit body that says *"Cuts Anthropic API spend per CI run by ~60%"* explains a decision a future you will forget. A body that says *"Update the cache key"* is noise.
