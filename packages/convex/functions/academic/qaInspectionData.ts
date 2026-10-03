import { internalQuery } from '../../_generated/server';
import { ConvexError, v } from 'convex/values';
import { DEMO_ACCOUNTS, DEMO_CLASSES, DEMO_STUDENTS, DEMO_SCHOOL_SLUG } from './demoData';

const LIMIT = 1001;
const tagged = (value: string) => /QA-RC-[A-Za-z0-9-]+/i.test(value);
const stable = <T extends { _id: string }>(rows: T[]) => [...rows].sort((a, b) => a._id.localeCompare(b._id));

// Ordinary QA inspection, not a purge inventory or reset-readiness decision.
export const inspectQaFixtureInternal = internalQuery({
  args: {},
  returns: v.object({
    schoolName: v.string(),
    actors: v.array(v.object({ email: v.string(), authId: v.string() })),
    counts: v.object({ students: v.number(), classes: v.number(), studentInvoices: v.number(), assessmentRecords: v.number() }),
    baselineStudents: v.number(), baselineClasses: v.number(),
    activeSession: v.union(v.null(), v.string()), activeTerm: v.union(v.null(), v.string()),
    baselineJson: v.string(), retainedQaClaims: v.number(),
  }),
  handler: async ctx => {
    const schools = await ctx.db.query('schools').take(2);
    const school = schools.find(row => row.slug === DEMO_SCHOOL_SLUG);
    if (schools.length !== 1 || !school || school.name !== 'Demo Academy') throw new ConvexError('QA requires the isolated synthetic school only');
    const schoolId = school._id;
    const runs = await ctx.db.query('demoSeedRuns').withIndex('by_school', q => q.eq('schoolId', schoolId)).take(2);
    const run = runs[0];
    if (runs.length !== 1 || run.seedProfile !== 'demo' || run.status !== 'succeeded' || run.phase !== 'complete' || !run.authIssuer) throw new ConvexError('Original QA fixture run is not verified');
    const authIds = [run.adminAuthId, run.teacherAuthId, run.portalAuthId];
    if (new Set(authIds).size !== 3) throw new ConvexError('QA actor identities are ambiguous');
    const roles = ['admin', 'teacher', 'parent'] as const;
    const emails = Object.values(DEMO_ACCOUNTS).map(account => account.email);
    const actors = [];
    for (let i = 0; i < authIds.length; i++) {
      const users = await ctx.db.query('users').withIndex('by_auth', q => q.eq('authId', authIds[i])).take(2);
      const byEmail = await ctx.db.query('users').withIndex('by_email', q => q.eq('email', emails[i])).take(2);
      const user = users[0];
      if (users.length !== 1 || byEmail.length !== 1 || byEmail[0]._id !== user?._id || !user || user.schoolId !== schoolId || user.role !== roles[i] || user.isArchived || !user.personId || user.authTokenIdentifier !== `${run.authIssuer}|${authIds[i]}`) throw new ConvexError('Original QA account ownership failed');
      const person = await ctx.db.get(user.personId);
      const members = await ctx.db.query('branchMemberships').withIndex('by_person_and_school', q => q.eq('personId', user.personId!)).take(2);
      if (!person || person.primarySchoolId !== schoolId || person.authTokenIdentifier !== user.authTokenIdentifier || members.length !== 1 || members[0].schoolId !== schoolId || members[0].legacyUserId !== user._id || members[0].status !== 'active') throw new ConvexError('Original QA membership is not isolated');
      actors.push({ email: emails[i], authId: authIds[i] });
    }
    const [students, classes, assessments, invoices, issued, sessions, terms, claims, schoolUsers, schoolMembers] = await Promise.all([
      ctx.db.query('students').withIndex('by_school', q => q.eq('schoolId', schoolId)).take(LIMIT),
      ctx.db.query('classes').withIndex('by_school', q => q.eq('schoolId', schoolId)).take(LIMIT),
      ctx.db.query('assessmentRecords').withIndex('by_school', q => q.eq('schoolId', schoolId)).take(LIMIT),
      ctx.db.query('studentInvoices').withIndex('by_school', q => q.eq('schoolId', schoolId)).take(LIMIT),
      ctx.db.query('issuedReportCards').withIndex('by_school', q => q.eq('schoolId', schoolId)).take(LIMIT),
      ctx.db.query('academicSessions').withIndex('by_school', q => q.eq('schoolId', schoolId)).take(LIMIT),
      ctx.db.query('academicTerms').withIndex('by_school', q => q.eq('schoolId', schoolId)).take(LIMIT),
      ctx.db.query('admissionNumberClaims').take(LIMIT),
      ctx.db.query('users').withIndex('by_school', q => q.eq('schoolId', schoolId)).take(LIMIT),
      ctx.db.query('branchMemberships').withIndex('by_school', q => q.eq('schoolId', schoolId)).take(LIMIT),
    ]);
    if (schoolUsers.some(user => user.personId && !authIds.includes(user.authId)) || schoolMembers.length !== 3) throw new ConvexError('Additional canonical accounts require a separately verified fixture protocol');
    if ([students, classes, assessments, invoices, issued, sessions, terms, claims, schoolUsers, schoolMembers].some(rows => rows.length >= LIMIT)) throw new ConvexError('QA fixture inspection is truncated; no readiness claim');
    const baseClasses = DEMO_CLASSES.map(expected => {
      const matches = classes.filter(row => row.gradeName === expected.gradeName && row.classLabel === expected.classLabel &&
        [expected.level, 'Secondary'].includes(row.level) && [expected.name, `${expected.gradeName} - ${expected.classLabel}`].includes(row.name) && !row.isArchived);
      if (matches.length !== 1) throw new ConvexError('Original QA class is missing or ambiguous');
      return matches[0];
    });
    const baseStudents = DEMO_STUDENTS.map(expected => {
      const matches = students.filter(row => row.admissionNumber === expected.admissionNumber && !row.isArchived);
      if (matches.length !== 1 || matches[0].classId !== baseClasses[expected.classIndex]._id) throw new ConvexError('Original QA pupil/class relationship changed');
      return matches[0];
    });
    if (sessions.filter(row => row.isActive).length > 1 || terms.filter(row => row.isActive).length > 1) throw new ConvexError('QA active period is ambiguous');
    const originalIds = new Set(baseStudents.map(row => row._id));
    const originalClassIds = new Set(baseClasses.map(row => row._id));
    for (const klass of classes) if (!originalClassIds.has(klass._id) && !tagged(klass.name)) throw new ConvexError('Additional class is not a run-tagged QA fixture');
    for (const student of students.filter(row => !originalIds.has(row._id))) {
      const klass = classes.find(row => row._id === student.classId);
      const user = await ctx.db.get(student.userId);
      if (!student.admissionNumber.startsWith('QA-RC-') || !klass || !tagged(klass.name) || klass.schoolId !== schoolId || !user || user.schoolId !== schoolId || user.role !== 'student' || user.personId || user.authId !== `student:${schoolId}:${student.admissionNumber.trim().toLowerCase()}`) throw new ConvexError('Additional pupil is not a school-owned placeholder QA fixture');
    }
    for (const claim of claims) if (claim.schoolId !== schoolId || !claim.number.startsWith('QA-RC-') || !students.some(student => student.admissionNumber === claim.number)) throw new ConvexError('Admission claim is not retained run-tagged QA data');
    const originalClassSubjects = [];
    const originalTeacherAssignments = [];
    for (const klass of baseClasses) {
      const [offerings, assignments] = await Promise.all([
        ctx.db.query('classSubjects').withIndex('by_class', q => q.eq('classId', klass._id)).take(101),
        ctx.db.query('teacherAssignments').withIndex('by_class', q => q.eq('classId', klass._id)).take(101),
      ]);
      if (offerings.length > 100 || assignments.length > 100) throw new ConvexError('Original QA class assignment inspection is truncated');
      originalClassSubjects.push(...offerings);
      originalTeacherAssignments.push(...assignments);
    }
    const originalScores = assessments.filter(row => originalIds.has(row.studentId));
    const originalIssued = issued.filter(row => originalIds.has(row.studentId));
    const originalInvoices = invoices.filter(row => originalIds.has(row.studentId));
    return {
      schoolName: school.name, actors,
      counts: { students: students.length, classes: classes.length, studentInvoices: invoices.length, assessmentRecords: assessments.length },
      baselineStudents: baseStudents.length, baselineClasses: baseClasses.length,
      activeSession: sessions.find(row => row.isActive)?.name ?? null,
      activeTerm: terms.find(row => row.isActive)?.name ?? null,
      retainedQaClaims: claims.length,
      baselineJson: JSON.stringify({
        students: stable(baseStudents), users: stable(schoolUsers.filter(user => baseStudents.some(student => student.userId === user._id))),
        // Legacy and UI-normalized names/levels represent the same verified grade/section.
        // Canonicalize only these known forms after checking the actual semantic identity.
        classes: stable(baseClasses.map((klass, index) => {
          const identity = { ...klass, name: DEMO_CLASSES[index].name, level: DEMO_CLASSES[index].level };
          delete (identity as { updatedAt?: number }).updatedAt;
          return identity;
        })),
        classSubjects: stable(originalClassSubjects), teacherAssignments: stable(originalTeacherAssignments),
        assessments: stable(originalScores), issued: stable(originalIssued), invoices: stable(originalInvoices),
      }),
    };
  },
});
