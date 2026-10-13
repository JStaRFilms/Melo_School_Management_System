# Subject edits after session promotion

## Observed behavior
User's promoted students appear in new class roster but CLEAR/subject selection fails "Student is not enrolled in this class". Manually choosing Active Class, confirming assignment and Save Identity makes it work. This manual identity mutation is not acceptable.

## Source confirmation
Current B1 working studentEnrollment.ts setStudentSubjectSelections near lines 2339-2344 still asserts student.classId === args.classId, rather than effective membership for args.sessionId.
Current studentClassMembership.ts exports isStudentEnrolledInClassForSession and getStudentClassForSession using incoming promotion and base fallback.

## Required fix
Validate selected school/class/session and use authoritative effective session membership for subject writes as roster does. Preserve teacher/admin and subject-class controls. No automatic blind migration of base class, no production data write, no term-based re-promotion.
Regression: incoming promotion changes effective class while base class remains old; clear/reselect/all must work in promoted class without any Save Identity. Wrong class/foreign/archived cases deny. Historical/source-session semantics and issued snapshots remain unchanged.
B1 steered with exact guard evidence; B2 should test promoted roster interaction and B3 history must remain intact.
