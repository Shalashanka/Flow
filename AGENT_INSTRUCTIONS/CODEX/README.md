# Codex Task System

Codex executes assigned work from `CODEX/tasks/`.

Every task must produce a matching result report in `CODEX/reports/`. Reports must be detailed enough for the planner to understand what changed, what worked, what failed, and what should happen next.

Codex must not silently skip errors. Any failed command, missing file, unexpected repository state, or blocker must be recorded in the task result report.

Codex must not jump ahead to future tasks. Each task should be completed only to the scope described in its task file.
