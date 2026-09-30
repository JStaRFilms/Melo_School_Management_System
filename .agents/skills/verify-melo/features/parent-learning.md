# Parent learning topics

A Parent opens learning topics for the linked synthetic pupil, filters the list, and reaches the topic detail through its card.

## Sub-features

- `linked-pupil`: the workspace identifies Alice Johnson.
- `search-match`: Fractions matches Fractions in Everyday Life.
- `search-empty`: an unmatched query gives an explicit empty state.
- `search-clear`: clearing restores the list.
- `detail-link`: the topic card opens its detail and survives reload.
- `mobile-list`: the learning list stays within a narrow page viewport.
- Child switching, Student-only menu navigation, uploads, assessment attempts, and resource downloads require their own checks.

## How to get to it (user POV)

- Parent workspace at `/`, then the learning list at `/learning/topics` for the active linked pupil.
- Topic cards open `/learning/topics/<topic-id>` through their actual link; follow the card instead of inventing an ID.
- Learning Topics navigation is Student-role specific in the current nav. The Parent direct route does not verify that Student entry point.

## Driving it with qa

Preconditions: the Portal app is owned and the synthetic Parent account links to Alice Johnson. Her class has the Fractions in Everyday Life topic.

Run `pnpm qa:roles --roles parent`. Expect the linked pupil, matching and empty search states, clear behavior, successful topic-card navigation/reload, and mobile list evidence.

For the exploratory mechanism, run `pnpm qa:explore --role parent --script scripts/qa/explore-example.mjs`. It uses real UI controls to assert matching and clearing; all four reported checks must pass. Extend the module for the feature being implemented rather than relabeling this example as full coverage.

## Gotchas

- Parents can have multiple pupils. A result for the default pupil is not proof of child switching or another class.
- A topic title is not proof that protected downloads or uploads work. Exercise those controls and their effects when they are in scope.
- This recipe does not verify grades, billing, new narrative issuance, or class-result publication.
