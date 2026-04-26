# T19 Broad Planning Sources Result

## Scope
Support curriculum/cross-topic planning references in the Lesson Knowledge Hub without forcing real topic attachment, and allow teachers to provide a target topic when generating lesson-plan or question-bank drafts from broad sources.

## Implemented
- Planning-library upload can mark a file as a `imported_curriculum` planning reference.
- Curriculum/reference uploads keep the safe planning-library defaults and do not require a real `knowledgeTopics` attachment.
- Lesson-plan workspace source context no longer derives `topicLabel` from `imported_curriculum` sources.
- Question-bank workspace source context no longer derives `topicLabel` from `imported_curriculum` sources.
- Lesson-plan generation API accepts `targetTopicLabel` and uses it for prompt context, snapshots, and saved generated drafts.
- Question-bank generation API accepts `targetTopicLabel` and uses it for prompt context, snapshots, and saved generated drafts.
- Teacher lesson-plan and question-bank pages show a target-topic input when selected sources do not resolve a concrete topic.

## Verification
- `pnpm -C apps/teacher typecheck --noEmit` — passed.
- `pnpm -C packages/convex typecheck --noEmit` — passed.
- `pnpm -C apps/teacher lint` — passed.
- `pnpm -C packages/convex lint` — passed.
- `pnpm lint` — passed clean.
- `pnpm typecheck` — passed clean.
- `pnpm build` — passed clean.
