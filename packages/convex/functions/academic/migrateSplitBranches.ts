import { internalMutation, internalQuery } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";

export const previewSplitMigrationInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const sourceSchool = await ctx.db
      .query("schools")
      .filter((q) => q.eq(q.field("slug"), "olive-blessed"))
      .first();

    if (!sourceSchool) {
      throw new ConvexError("Source school 'olive-blessed' not found");
    }

    const classes = await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", sourceSchool._id))
      .collect();

    const students = await ctx.db
      .query("students")
      .withIndex("by_school", (q) => q.eq("schoolId", sourceSchool._id))
      .collect();

    const activeClasses = classes.filter((c) => !c.isArchived);

    const rugaClasses = activeClasses.filter(
      (c) => c.name.includes("Olive Fountain") || c.name.includes("Olive Blaze")
    );

    const fedrahClasses = activeClasses.filter(
      (c) => !c.name.includes("Olive Fountain") && !c.name.includes("Olive Blaze")
    );

    const rugaStudentCount = students.filter(
      (s) => !s.isArchived && rugaClasses.some((c) => c._id === s.classId)
    ).length;

    const fedrahStudentCount = students.filter(
      (s) => !s.isArchived && fedrahClasses.some((c) => c._id === s.classId)
    ).length;

    return {
      sourceSchool: sourceSchool.name,
      fedrah: {
        targetName: "Olive Blessed Crest Academy (Fedrah, Abuja)",
        targetSlug: "obhis-fedrah",
        leadAdmin: "admin.fedrah@oliveblessed.com",
        classes: fedrahClasses.map((c) => c.name),
        studentCount: fedrahStudentCount,
      },
      ruga: {
        targetName: "Olive Blessed Crest Academy (Ruga, Nasarawa)",
        targetSlug: "obhis-ruga",
        leadAdmin: "admin.ruga@oliveblessed.com",
        classes: rugaClasses.map((c) => c.name),
        studentCount: rugaStudentCount,
      },
    };
  },
});

export const executeSplitMigrationInternal = internalMutation({
  args: {
    fedrahAuthId: v.string(),
    rugaAuthId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    fedrahSchoolId: Id<"schools">;
    rugaSchoolId: Id<"schools">;
    movedClasses: string[];
    movedStudentCount: number;
    fedrahAdminEmail: string;
    rugaAdminEmail: string;
  }> => {
    const now = Date.now();

    const fedrahSchool = await ctx.db
      .query("schools")
      .filter((q) => q.eq(q.field("slug"), "olive-blessed"))
      .first();

    if (!fedrahSchool) {
      throw new ConvexError("Original school 'olive-blessed' not found");
    }

    const fedrahSchoolId = fedrahSchool._id;

    // 1. Update Fedrah School Metadata & Activate
    await ctx.db.patch(fedrahSchoolId, {
      name: "Olive Blessed Crest Academy (Fedrah, Abuja)",
      slug: "obhis-fedrah",
      status: "active",
      updatedAt: now,
    });

    // 2. Create / Get Ruga School
    let rugaSchool = await ctx.db
      .query("schools")
      .filter((q) => q.eq(q.field("slug"), "obhis-ruga"))
      .first();

    let rugaSchoolId: Id<"schools">;
    if (!rugaSchool) {
      rugaSchoolId = await ctx.db.insert("schools", {
        name: "Olive Blessed Crest Academy (Ruga, Nasarawa)",
        slug: "obhis-ruga",
        status: "active",
        motto: fedrahSchool.motto ?? "Excellence and Integrity",
        theme: fedrahSchool.theme,
        features: fedrahSchool.features ?? {
          billing: true,
          curriculum: true,
          knowledgeLibrary: true,
          admissions: false,
        },
        logoStorageId: fedrahSchool.logoStorageId,
        logoFileName: fedrahSchool.logoFileName,
        logoContentType: fedrahSchool.logoContentType,
        logoUpdatedAt: fedrahSchool.logoUpdatedAt,
        contactEmail: "admin.ruga@oliveblessed.com",
        address: "Ruga, Nasarawa State",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      rugaSchoolId = rugaSchool._id;
      await ctx.db.patch(rugaSchoolId, {
        name: "Olive Blessed Crest Academy (Ruga, Nasarawa)",
        status: "active",
        updatedAt: now,
      });
    }

    // 3. Clone Sessions and Terms to Ruga
    const fedrahSessions = await ctx.db
      .query("academicSessions")
      .withIndex("by_school", (q) => q.eq("schoolId", fedrahSchoolId))
      .collect();

    const sessionMap = new Map<string, Id<"academicSessions">>();
    const termMap = new Map<string, Id<"academicTerms">>();

    for (const s of fedrahSessions) {
      let rSession = await ctx.db
        .query("academicSessions")
        .withIndex("by_school", (q) => q.eq("schoolId", rugaSchoolId))
        .filter((q) => q.eq(q.field("name"), s.name))
        .first();

      let rSessionId: Id<"academicSessions">;
      if (!rSession) {
        rSessionId = await ctx.db.insert("academicSessions", {
          schoolId: rugaSchoolId,
          name: s.name,
          startDate: s.startDate,
          endDate: s.endDate,
          isActive: s.isActive,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        rSessionId = rSession._id;
      }
      sessionMap.set(String(s._id), rSessionId);

      const fedrahTerms = await ctx.db
        .query("academicTerms")
        .withIndex("by_session", (q) => q.eq("sessionId", s._id))
        .collect();

      for (const t of fedrahTerms) {
        let rTerm = await ctx.db
          .query("academicTerms")
          .withIndex("by_session", (q) => q.eq("sessionId", rSessionId))
          .filter((q) => q.eq(q.field("name"), t.name))
          .first();

        let rTermId: Id<"academicTerms">;
        if (!rTerm) {
          rTermId = await ctx.db.insert("academicTerms", {
            schoolId: rugaSchoolId,
            sessionId: rSessionId,
            name: t.name,
            startDate: t.startDate,
            endDate: t.endDate,
            isActive: t.isActive,
            reportCardCalculationMode: t.reportCardCalculationMode,
            createdAt: now,
            updatedAt: now,
          });
        } else {
          rTermId = rTerm._id;
        }
        termMap.set(String(t._id), rTermId);
      }
    }

    // 4. Identify Classes to Move (Primary 4 - Olive Fountain & JSS 1 - Olive Blaze)
    const fedrahClasses = await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", fedrahSchoolId))
      .collect();

    const rugaClasses = fedrahClasses.filter(
      (c) => c.name.includes("Olive Fountain") || c.name.includes("Olive Blaze")
    );

    const movedClassIds = new Set(rugaClasses.map((c) => String(c._id)));

    for (const c of rugaClasses) {
      await ctx.db.patch(c._id, {
        schoolId: rugaSchoolId,
        formTeacherId: undefined, // Ruga classes start with unassigned form teachers as requested
        updatedAt: now,
      });
    }

    // 5. Move Students and Related Records
    const allFedrahStudents = await ctx.db
      .query("students")
      .withIndex("by_school", (q) => q.eq("schoolId", fedrahSchoolId))
      .collect();

    const movedStudents = allFedrahStudents.filter((s) =>
      movedClassIds.has(String(s.classId))
    );

    let movedStudentCount = 0;
    for (const student of movedStudents) {
      movedStudentCount++;
      // Move student record
      await ctx.db.patch(student._id, {
        schoolId: rugaSchoolId,
        updatedAt: now,
      });

      // Move student's user account
      const studentUser = await ctx.db.get(student.userId);
      if (studentUser) {
        await ctx.db.patch(studentUser._id, {
          schoolId: rugaSchoolId,
          updatedAt: now,
        });
      }

      // Move student's invoices & payments
      const studentInvoices = await ctx.db
        .query("studentInvoices")
        .withIndex("by_student", (q) => q.eq("studentId", student._id))
        .collect();

      for (const inv of studentInvoices) {
        await ctx.db.patch(inv._id, {
          schoolId: rugaSchoolId,
          updatedAt: now,
        });
      }

      // Move assessment records
      const assessments = await ctx.db
        .query("assessmentRecords")
        .withIndex("by_school", (q) => q.eq("schoolId", fedrahSchoolId))
        .filter((q) => q.eq(q.field("studentId"), student._id))
        .collect();

      for (const a of assessments) {
        const nextTermId = termMap.get(String(a.termId)) ?? a.termId;
        await ctx.db.patch(a._id, {
          schoolId: rugaSchoolId,
          termId: nextTermId,
          updatedAt: now,
        });
      }

      // Move historical term totals
      const historicalTotals = await ctx.db
        .query("historicalTermTotals")
        .withIndex("by_school", (q) => q.eq("schoolId", fedrahSchoolId))
        .filter((q) => q.eq(q.field("studentId"), student._id))
        .collect();

      for (const h of historicalTotals) {
        const nextTermId = termMap.get(String(h.termId)) ?? h.termId;
        await ctx.db.patch(h._id, {
          schoolId: rugaSchoolId,
          termId: nextTermId,
          updatedAt: now,
        });
      }
    }

    // 6. Move Class Offerings & Teacher Assignments for Ruga Classes
    for (const classId of movedClassIds) {
      const offerings = await ctx.db
        .query("classSubjects")
        .withIndex("by_class", (q) => q.eq("classId", classId as Id<"classes">))
        .collect();

      for (const o of offerings) {
        await ctx.db.patch(o._id, {
          schoolId: rugaSchoolId,
          teacherId: undefined, // Reset assigned teachers to unassigned
        });
      }

      const assignments = await ctx.db
        .query("teacherAssignments")
        .withIndex("by_class", (q) => q.eq("classId", classId as Id<"classes">))
        .collect();

      for (const a of assignments) {
        await ctx.db.delete(a._id);
      }
    }

    // 7. Setup Fedrah Admin (Anposola Oluleke-Oke / admin.fedrah@oliveblessed.com)
    let fedrahAdmin = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", fedrahSchoolId))
      .filter((q) => q.eq(q.field("email"), "admin.fedrah@oliveblessed.com"))
      .first();

    if (!fedrahAdmin) {
      const existingObhi = await ctx.db
        .query("users")
        .withIndex("by_school", (q) => q.eq("schoolId", fedrahSchoolId))
        .filter((q) => q.eq(q.field("email"), "obhischool@gmail.com"))
        .first();

      if (existingObhi) {
        fedrahAdmin = existingObhi;
        await ctx.db.patch(fedrahAdmin._id, {
          email: "admin.fedrah@oliveblessed.com",
          authId: args.fedrahAuthId,
          name: "Anposola Oluleke-Oke",
          role: "admin",
          isSchoolAdmin: true,
          isArchived: false,
          updatedAt: now,
        });
      } else {
        const newId = await ctx.db.insert("users", {
          schoolId: fedrahSchoolId,
          authId: args.fedrahAuthId,
          name: "Anposola Oluleke-Oke",
          email: "admin.fedrah@oliveblessed.com",
          role: "admin",
          isSchoolAdmin: true,
          createdAt: now,
          updatedAt: now,
        });
        fedrahAdmin = await ctx.db.get(newId);
      }
    } else {
      await ctx.db.patch(fedrahAdmin._id, {
        authId: args.fedrahAuthId,
        name: "Anposola Oluleke-Oke",
        role: "admin",
        isSchoolAdmin: true,
        isArchived: false,
        updatedAt: now,
      });
    }

    // Ensure Fedrah Lead Admin Leadership
    if (fedrahAdmin) {
      await ctx.runMutation(
        internal.functions.academic.adminLeadershipHelpers.ensureSchoolLeadAdminInternal,
        {
          schoolId: fedrahSchoolId,
          leadAdminUserId: fedrahAdmin._id,
          updatedBy: fedrahAdmin._id,
        }
      );
    }

    // 8. Setup Ruga Admin (Anposola Oluleke-Oke / admin.ruga@oliveblessed.com)
    let rugaAdmin = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", rugaSchoolId))
      .filter((q) => q.eq(q.field("email"), "admin.ruga@oliveblessed.com"))
      .first();

    if (!rugaAdmin) {
      const newId = await ctx.db.insert("users", {
        schoolId: rugaSchoolId,
        authId: args.rugaAuthId,
        name: "Anposola Oluleke-Oke",
        email: "admin.ruga@oliveblessed.com",
        role: "admin",
        isSchoolAdmin: true,
        createdAt: now,
        updatedAt: now,
      });
      rugaAdmin = await ctx.db.get(newId);
    } else {
      await ctx.db.patch(rugaAdmin._id, {
        authId: args.rugaAuthId,
        name: "Anposola Oluleke-Oke",
        role: "admin",
        isSchoolAdmin: true,
        isArchived: false,
        updatedAt: now,
      });
    }

    // Ensure Ruga Lead Admin Leadership
    if (rugaAdmin) {
      await ctx.runMutation(
        internal.functions.academic.adminLeadershipHelpers.ensureSchoolLeadAdminInternal,
        {
          schoolId: rugaSchoolId,
          leadAdminUserId: rugaAdmin._id,
          updatedBy: rugaAdmin._id,
        }
      );
    }

    // 9. Remove / Archive John (johnoke2005@gmail.com)
    const johnUser = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", fedrahSchoolId))
      .filter((q) => q.eq(q.field("email"), "johnoke2005@gmail.com"))
      .first();

    if (johnUser) {
      await ctx.db.patch(johnUser._id, {
        isArchived: true,
        archivedAt: now,
        archivedBy: fedrahAdmin?._id,
        updatedAt: now,
      });
    }

    return {
      success: true,
      fedrahSchoolId,
      rugaSchoolId,
      movedClasses: rugaClasses.map((c) => c.name),
      movedStudentCount,
      fedrahAdminEmail: "admin.fedrah@oliveblessed.com",
      rugaAdminEmail: "admin.ruga@oliveblessed.com",
    };
  },
});
