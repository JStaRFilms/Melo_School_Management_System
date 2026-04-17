# T21 School Website Template Library and Page Composition

## Objective

Create a flexible school-website template and section-composition system in `apps/sites` so public websites can feel intentionally different without requiring a fully custom codebase every time.

## Why This Exists

The desired model is not just “same site, different text.”

We want the ability to:
- start schools from strong template families
- add more templates over time
- support different page mixes and section arrangements
- still keep the system maintainable

## Requested Scope

- define the initial template system for school public websites
- support a `templateKey`-style rendering contract
- support optional per-page section composition and ordering
- define how new pages can be added for specific schools without destabilizing the whole system
- make room for both standard template use and more custom variations later

## Minimum Target

Create an initial plan for at least **5 school-site templates** over time, even if implementation starts smaller.

Example directions:
- premium modern independent school
- classic institutional school
- nursery/primary focused school
- secondary/college focused school
- faith-based or traditional tone

## Composition Requirements

Support at least the idea of:
- page templates
- optional sections
- section ordering
- page visibility toggles
- school-specific page additions later

Examples:
- one school may need `/gallery`
- another may need `/boarding`
- another may need `/cambridge-programme`
- another may only need a minimal site

## Acceptance Criteria

- [x] The public-site system supports more than one template family.
- [x] A school can be assigned a template key without code duplication.
- [x] Page/section composition can vary by school in a structured way.
- [x] The design allows new templates to be added over time.
- [x] The design allows new pages to be introduced for specific school needs without turning the app into one-off chaos.

## Notes

- This should not become a full no-code website builder immediately.
- The first goal is structured flexibility, not infinite freeform editing.
- Truly bespoke school websites can exist later as a premium/custom lane, but should not be the baseline implementation path.
