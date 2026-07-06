import type { ReportCardSheetData } from "@school/shared";
import type {
  PortalBillingData,
  PortalHistoryItem,
  PortalStudentOption,
  PortalWorkspaceArgs,
  PortalWorkspaceData,
} from "@/portal-types";

const school = {
  id: "school_greenwood_demo",
  name: "Greenwood Academy",
  logoUrl: null,
  theme: {
    primaryColor: "#020617",
    accentColor: "#2563eb",
  },
};

const viewer = {
  userId: "parent_john_sunday",
  name: "John Sunday",
  role: "parent" as const,
  schoolId: school.id,
};

const students: PortalStudentOption[] = [
  {
    studentId: "student_sarah_sunday",
    userId: "user_sarah_sunday",
    name: "Sarah Sunday",
    admissionNumber: "GA/PRI/0051",
    classId: "class_grade_5a",
    className: "Grade 5 A",
    schoolId: school.id,
    schoolName: school.name,
    schoolLogoUrl: school.logoUrl,
    relationship: "Daughter",
    photoUrl: "https://i.pravatar.cc/180?img=32",
    isActive: true,
  },
  {
    studentId: "student_david_sunday",
    userId: "user_david_sunday",
    name: "David Sunday",
    admissionNumber: "GA/PRI/0084",
    classId: "class_grade_2b",
    className: "Grade 2 B",
    schoolId: school.id,
    schoolName: school.name,
    schoolLogoUrl: school.logoUrl,
    relationship: "Son",
    photoUrl: "https://i.pravatar.cc/180?img=12",
    isActive: false,
  },
];

const sessions = [
  { id: "session_2025_2026", name: "2025/2026" },
  { id: "session_2024_2025", name: "2024/2025" },
];

const terms = [
  { id: "term_first", name: "First Term" },
  { id: "term_third", name: "Third Term" },
  { id: "term_second", name: "Second Term" },
];

const generatedAt = Date.UTC(2026, 3, 18, 9, 30);

function moneyDate(month: number, day: number) {
  return Date.UTC(2026, month, day, 10, 0);
}

function buildHistory(student: PortalStudentOption): PortalHistoryItem[] {
  const base = student.studentId === "student_sarah_sunday"
    ? [
        { term: terms[0], session: sessions[0], average: 88.3, total: 530, recorded: 6, pending: 0 },
        { term: terms[1], session: sessions[1], average: 84.1, total: 589, recorded: 7, pending: 0 },
        { term: terms[2], session: sessions[1], average: 81.7, total: 572, recorded: 7, pending: 0 },
      ]
    : [
        { term: terms[0], session: sessions[0], average: 91.2, total: 456, recorded: 5, pending: 0 },
        { term: terms[1], session: sessions[1], average: 87.4, total: 437, recorded: 5, pending: 0 },
        { term: terms[2], session: sessions[1], average: 85.8, total: 429, recorded: 5, pending: 1 },
      ];

  return base.map((item) => ({
    sessionId: item.session.id,
    termId: item.term.id,
    sessionName: item.session.name,
    termName: item.term.name,
    classId: student.classId,
    className: student.className,
    generatedAt,
    totalSubjects: item.recorded + item.pending,
    recordedSubjects: item.recorded,
    pendingSubjects: item.pending,
    averageScore: item.average,
    totalScore: item.total,
    resultCalculationMode: "standalone",
    href: `/report-cards?studentId=${student.studentId}&sessionId=${item.session.id}&termId=${item.term.id}`,
    note: item.pending > 0 ? "One subject is awaiting moderation." : null,
  }));
}

function buildReportCard(student: PortalStudentOption, historyItem: PortalHistoryItem): ReportCardSheetData {
  const isSarah = student.studentId === "student_sarah_sunday";
  const results = (isSarah
    ? [
        ["mathematics", "Mathematics", "MTH", 18, 18, 19, 35, "A", "Excellent"],
        ["english", "English Language", "ENG", 17, 16, 18, 31, "A", "Excellent"],
        ["basic_science", "Basic Science", "BSC", 16, 17, 16, 32, "A", "Excellent"],
        ["ict", "ICT", "ICT", 19, 18, 19, 38, "A", "Outstanding"],
        ["social_studies", "Social Studies", "SOS", 15, 17, 16, 30, "B", "Very Good"],
        ["creative_arts", "Creative Arts", "ART", 18, 17, 18, 34, "A", "Excellent"],
      ]
    : [
        ["mathematics", "Mathematics", "MTH", 19, 18, 18, 36, "A", "Excellent"],
        ["english", "English Language", "ENG", 17, 18, 17, 34, "A", "Excellent"],
        ["basic_science", "Basic Science", "BSC", 18, 17, 18, 35, "A", "Excellent"],
        ["phonics", "Phonics", "PHO", 16, 17, 17, 33, "A", "Excellent"],
        ["number_work", "Number Work", "NUM", 19, 19, 18, 37, "A", "Outstanding"],
      ]
  ).map(([subjectId, subjectName, subjectCode, ca1, ca2, ca3, examScore, gradeLetter, remark]) => ({
    subjectId: String(subjectId),
    subjectName: String(subjectName),
    subjectCode: String(subjectCode),
    ca1: Number(ca1),
    ca2: Number(ca2),
    ca3: Number(ca3),
    examScore: Number(examScore),
    total: Number(ca1) + Number(ca2) + Number(ca3) + Number(examScore),
    gradeLetter: String(gradeLetter),
    remark: String(remark),
    isRecorded: true,
    calculationMode: "standalone" as const,
  }));

  return {
    schoolName: school.name,
    schoolAddress: "12 Palm Avenue, Lagos",
    schoolContact: "hello@greenwood.example · +234 800 555 0199",
    schoolLogoUrl: school.logoUrl,
    schoolMotto: "Learning with confidence",
    sessionName: historyItem.sessionName,
    termName: historyItem.termName,
    classId: student.classId,
    className: student.className,
    generatedAt,
    assessmentConfig: {
      ca1Max: 20,
      ca2Max: 20,
      ca3Max: 20,
      examMax: 40,
    },
    resultCalculationMode: "standalone",
    student: {
      _id: student.studentId,
      name: student.name,
      displayName: student.name,
      firstName: student.name.split(" ")[0] ?? null,
      lastName: student.name.split(" ").slice(1).join(" ") || null,
      admissionNumber: student.admissionNumber,
      gender: isSarah ? "Female" : "Male",
      dateOfBirth: Date.UTC(isSarah ? 2015 : 2018, isSarah ? 8 : 4, isSarah ? 12 : 7),
      guardianName: viewer.name,
      guardianPhone: "+234 803 555 0110",
      address: "24 Maple Close, Lagos",
      houseName: isSarah ? "Blue House" : "Green House",
      nextTermBegins: Date.UTC(2026, 4, 6),
      photoUrl: student.photoUrl,
    },
    summary: {
      totalSubjects: historyItem.totalSubjects,
      recordedSubjects: historyItem.recordedSubjects,
      pendingSubjects: historyItem.pendingSubjects,
      averageScore: historyItem.averageScore,
      totalScore: historyItem.totalScore,
    },
    results,
    extras: [
      {
        bundleId: "bundle_character",
        bundleName: "Character and habits",
        sections: [
          {
            sectionId: "habits",
            sectionLabel: "Learning habits",
            items: [
              { fieldId: "punctuality", label: "Punctuality", type: "scale", printValue: "Excellent" },
              { fieldId: "participation", label: "Class participation", type: "scale", printValue: "Very good" },
              { fieldId: "conduct", label: "Conduct", type: "scale", printValue: "Excellent" },
            ],
          },
        ],
      },
    ],
    classTeacherName: isSarah ? "Mrs. Tolani Ajayi" : "Ms. Blessing Edet",
    classTeacherComment: isSarah
      ? "Sarah is confident, attentive, and consistently completes her assignments."
      : "David participates eagerly and is building excellent number confidence.",
    headTeacherComment: "A strong term. Keep up the steady progress.",
  };
}

export function getMockPortalWorkspaceData(args: PortalWorkspaceArgs = {}): PortalWorkspaceData {
  const selectedStudent =
    students.find((student) => student.studentId === args.studentId) ?? students[0];
  const history = buildHistory(selectedStudent);
  const selectedHistory =
    history.find((item) => item.sessionId === args.sessionId && item.termId === args.termId) ?? history[0];
  const historyLimit = args.historyLimit ?? history.length;
  const selectedReportCard = selectedHistory ? buildReportCard(selectedStudent, selectedHistory) : null;

  return {
    school,
    viewer,
    students: students.map((student) => ({
      ...student,
      isActive: student.studentId === selectedStudent.studentId,
    })),
    selectedStudentId: selectedStudent.studentId,
    selectedSessionId: selectedHistory?.sessionId ?? null,
    selectedTermId: selectedHistory?.termId ?? null,
    selectedStudent,
    activeSession: sessions[0],
    activeTerm: terms[0],
    selectedReportCard,
    history: history.slice(0, historyLimit),
    notifications: [
      {
        id: "notice_report_published",
        title: "First term report card published",
        body: `${selectedStudent.name.split(" ")[0]}'s report card is ready for review.`,
        tone: "success",
        href: `/report-cards?studentId=${selectedStudent.studentId}`,
      },
      {
        id: "notice_pta",
        title: "PTA meeting reminder",
        body: "Parents are invited on Thursday at 4:00 PM in the multipurpose hall.",
        tone: "warning",
        href: null,
      },
      {
        id: "notice_club",
        title: "Science club exhibition",
        body: "Students will display class projects next Friday after assembly.",
        tone: "info",
        href: null,
      },
    ],
  };
}

export function getMockPortalBillingData(studentId?: string | null): PortalBillingData {
  const selectedStudentId = studentId ?? students[0].studentId;
  const selectedStudent = students.find((student) => student.studentId === selectedStudentId) ?? students[0];
  const isSarah = selectedStudent.studentId === "student_sarah_sunday";
  const invoices = isSarah
    ? [
        {
          invoiceId: "invoice_sarah_term_2",
          studentId: selectedStudent.studentId,
          invoiceNumber: "INV-2026-00421",
          feePlanName: "Second Term Tuition",
          currency: "NGN",
          totalAmount: 450000,
          amountPaid: 330000,
          balanceDue: 120000,
          dueDate: moneyDate(4, 30),
          issuedAt: moneyDate(3, 18),
          status: "partially_paid" as const,
          canPayOnline: true,
          lineItems: [
            { id: "tuition", label: "Tuition", amount: 320000, category: "tuition", order: 1 },
            { id: "books", label: "Books and learning materials", amount: 80000, category: "materials", order: 2 },
            { id: "activities", label: "Clubs and activities", amount: 50000, category: "activities", order: 3 },
          ],
          notes: "Part payment received by bank transfer.",
        },
      ]
    : [
        {
          invoiceId: "invoice_david_term_2",
          studentId: selectedStudent.studentId,
          invoiceNumber: "INV-2026-00408",
          feePlanName: "Second Term Tuition",
          currency: "NGN",
          totalAmount: 380000,
          amountPaid: 380000,
          balanceDue: 0,
          dueDate: moneyDate(4, 30),
          issuedAt: moneyDate(3, 14),
          status: "paid" as const,
          canPayOnline: false,
          lineItems: [
            { id: "tuition", label: "Tuition", amount: 280000, category: "tuition", order: 1 },
            { id: "books", label: "Books and learning materials", amount: 60000, category: "materials", order: 2 },
            { id: "activities", label: "Clubs and activities", amount: 40000, category: "activities", order: 3 },
          ],
          notes: null,
        },
      ];
  const payments = [
    {
      paymentId: "payment_93821",
      invoiceId: invoices[0].invoiceId,
      invoiceNumber: invoices[0].invoiceNumber,
      reference: "PAY-93821",
      gatewayReference: "PSK-DEMO-93821",
      provider: "Paystack",
      paymentMethod: "card",
      amountApplied: isSarah ? 330000 : 380000,
      amountReceived: isSarah ? 330000 : 380000,
      status: "successful",
      reconciliationStatus: "matched",
      receivedAt: moneyDate(3, isSarah ? 18 : 15),
      notes: null,
    },
  ];
  const totalInvoiced = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const totalPaid = invoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
  const outstandingBalance = invoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0);

  return {
    selectedStudentId: selectedStudent.studentId,
    school: {
      id: school.id,
      name: school.name,
    },
    settings: {
      allowOnlinePayments: true,
      preferredProvider: "paystack",
      defaultCurrency: "NGN",
    },
    householdSummary: {
      studentCount: students.length,
      invoiceCount: invoices.length,
      totalInvoiced,
      totalPaid,
      outstandingBalance,
    },
    studentSummary: {
      invoiceCount: invoices.length,
      totalInvoiced,
      totalPaid,
      outstandingBalance,
    },
    invoices,
    payments,
  };
}

export function getMockPortalTopicIndexData() {
  return {
    classId: students[0].classId,
    className: students[0].className,
    topics: [
      {
        _id: "topic_fractions",
        title: "Fractions in everyday life",
        summary: "Practice equivalent fractions, comparisons, and simple word problems.",
        subjectId: "subject_math",
        subjectName: "Mathematics",
        level: "Grade 5",
        status: "active" as const,
      },
      {
        _id: "topic_reading_comprehension",
        title: "Reading comprehension strategies",
        summary: "Use context clues, summaries, and inference to understand passages.",
        subjectId: "subject_english",
        subjectName: "English Language",
        level: "Grade 5",
        status: "active" as const,
      },
      {
        _id: "topic_energy",
        title: "Forms of energy",
        summary: "Explore light, heat, sound, and electrical energy with class examples.",
        subjectId: "subject_basic_science",
        subjectName: "Basic Science",
        level: "Grade 5",
        status: "active" as const,
      },
    ],
  };
}

export function getMockPortalTopicPageData(topicId: string) {
  const index = getMockPortalTopicIndexData();
  const topic = index.topics.find((item) => item._id === topicId) ?? index.topics[0];

  return {
    topic,
    classId: index.classId,
    className: index.className,
    canUploadSupplemental: true,
    approvedMaterials: [
      {
        _id: `${topic._id}_guide`,
        title: `${topic.title} study guide`,
        description: "Teacher-approved revision notes for home practice.",
        sourceType: "file_upload" as const,
        visibility: "student_approved" as const,
        reviewStatus: "approved" as const,
        externalUrl: null,
        topicId: topic._id,
        classId: index.classId,
        sourceProof: {
          originalFileState: "available" as const,
          originalFileUrl: "#",
          originalFileContentType: "application/pdf",
          originalFileSize: 240000,
          originalFileNotice: null,
          extractedTextPreview: "This resource introduces the key ideas, worked examples, and short revision questions for the topic.",
          extractedTextChunkCount: 4,
          indexedPageSummary: "Revision guide with examples and practice prompts.",
        },
      },
      {
        _id: `${topic._id}_video`,
        title: "Classroom recap video",
        description: "Short approved video recap for parents and students.",
        sourceType: "youtube_link" as const,
        visibility: "student_approved" as const,
        reviewStatus: "approved" as const,
        externalUrl: "https://example.com/demo-video",
        topicId: topic._id,
        classId: index.classId,
        sourceProof: {
          originalFileState: "missing" as const,
          originalFileUrl: null,
          originalFileContentType: null,
          originalFileSize: null,
          originalFileNotice: "External video link approved by the class teacher.",
          extractedTextPreview: null,
          extractedTextChunkCount: 0,
          indexedPageSummary: null,
        },
      },
    ],
  };
}

export const mockPortalSchoolBranding = {
  name: school.name,
  logoUrl: school.logoUrl,
  theme: school.theme,
};

export const mockPortalSession = {
  user: {
    id: viewer.userId,
    email: "john.sunday@example.com",
    name: viewer.name,
    role: viewer.role,
    schoolId: school.id,
    image: "https://i.pravatar.cc/120?img=68",
  },
  session: {
    id: "session_video_parent",
    userId: viewer.userId,
    expiresAt: new Date(Date.UTC(2027, 0, 1)).toISOString(),
  },
};
