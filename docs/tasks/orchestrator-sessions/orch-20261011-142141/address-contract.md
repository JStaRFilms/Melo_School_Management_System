# Residential address addition
The user asked for residential address entry followed by same/different address choices when adding other parents and guardians.
Use a household residential address plus explicit member inheritance/override. Same means resolved reference, not a stale contact copy. Different shows a custom address.
Preserve existing students.address values and unreviewed legacy guardian text. Linking a new student into an existing household must not overwrite that household's address implicitly.
Expose a scoped explicit household-address editing operation and effective address/source in profile/family reads, with existing client compatibility. Verify inherited contact addresses follow explicit household updates while custom overrides do not.
This is part of B1 backend and B2 frontend, not a separate unrelated address-management project.
