# Architectural Cartographer

This suite is a top-down architecture map for Novu, written for a product owner who wants to become dangerous in the good engineering sense: able to trace behavior, review changes, debug calmly, and explain why the system is shaped the way it is.

Use the files in this order:

1. `JOURNAL.md` to see how the repo was inspected and what a senior reader noticed first.
2. `00-reading-map.md` to get the whole-system reading route.
3. `01-junior-engineer.md` to learn setup, folders, entry points, components, and route anatomy.
4. `02-mid-level-engineer.md` to trace a real full-stack feature and read contracts.
5. `03-senior-engineer.md` to practice critique, performance, security, tests, and ownership.
6. `04-reference-suite.md` when you are actively reviewing, debugging, changing, or explaining the system.

Checkpoints are not pauses. Read the questions, answer out loud or in notes, then immediately compare with the self-grading rubric. Strong answers should name concrete files and line ranges, because this codebase rewards evidence over vibes.

This suite is self-contained. It uses the contexts feature as a main teaching thread because it crosses dashboard routing, React components, React Query, HTTP wrappers, Nest controllers, DTOs, use cases, repositories, and Mongo indexes in a compact path: `apps/dashboard/src/main.tsx:286-309`, `apps/dashboard/src/components/contexts/context-list.tsx:140-281`, `apps/dashboard/src/api/contexts.ts:10-142`, `apps/api/src/app/contexts/contexts.controller.ts:39-205`, `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:11-90`, and `libs/dal/src/repositories/context/context.schema.ts:5-69`.
