export const DEMO_SCHOOL_SLUG = "demo-school" as const;
export const DEMO_RESET_CONFIRMATION = "RESET demo-school" as const;
export const DEMO_CREATED_AT = Date.UTC(2026, 6, 1, 9, 0, 0);

export const DEMO_ACCOUNTS = {
  admin: {
    name: "Amina Okafor",
    email: "admin@demo-academy.school",
    password: "Admin123!Pass",
  },
  teacher: {
    name: "Daniel Mensah",
    email: "teacher@demo-academy.school",
    password: "Teacher123!Pass",
  },
  portal: {
    name: "Grace Adeyemi",
    email: "parent@demo-academy.school",
    password: "Portal123!Pass",
  },
} as const;

export const DEMO_SUBJECTS = [
  ["Mathematics", "MATH"],
  ["English Language", "ENG"],
  ["Basic Science", "SCI"],
  ["Social Studies", "SOS"],
  ["Computer Studies", "ICT"],
  ["Civic Education", "CIV"],
  ["Creative Arts", "ART"],
] as const;

export const DEMO_CLASSES = [
  { name: "JSS 1A", level: "Junior Secondary", gradeName: "JSS 1", classLabel: "A" },
  { name: "JSS 1B", level: "Junior Secondary", gradeName: "JSS 1", classLabel: "B" },
  { name: "JSS 2A", level: "Junior Secondary", gradeName: "JSS 2", classLabel: "A" },
] as const;

const FIRST_NAMES = [
  "Alice", "Bolu", "Chiamaka", "David", "Efe", "Fatima", "Gabriel", "Hauwa", "Ife", "Jide", "Kemi", "Lekan",
  "Mariam", "Nneka", "Ola", "Pere", "Queen", "Rahma", "Samuel", "Tomi", "Uche", "Victoria", "Wale", "Yinka",
  "Zainab", "Amara", "Bamidele", "Chidera", "Damilola", "Emeka", "Favour", "Godwin", "Halima", "Ibrahim", "Joy", "Kelechi",
] as const;
const LAST_NAMES = ["Johnson", "Okoro", "Bello", "Mensah", "Adebayo", "Nwosu"] as const;

export type DemoStudent = {
  name: string;
  email: string;
  admissionNumber: string;
  classIndex: number;
  familyIndex: number;
  gender: "Female" | "Male";
};

export const DEMO_STUDENTS: DemoStudent[] = FIRST_NAMES.map((firstName, index) => {
  const lastName = LAST_NAMES[index % LAST_NAMES.length];
  return {
    name: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@students.demo-academy.school`,
    admissionNumber: `DA/2026/${String(index + 1).padStart(3, "0")}`,
    classIndex: Math.floor(index / 12),
    familyIndex: Math.floor(index / 2),
    gender: index % 2 === 0 ? "Female" : "Male",
  };
});

export const DEMO_BANDS = [
  { minScore: 0, maxScore: 39, gradeLetter: "F", remark: "Needs support" },
  { minScore: 40, maxScore: 49, gradeLetter: "D", remark: "Developing" },
  { minScore: 50, maxScore: 59, gradeLetter: "C", remark: "Satisfactory" },
  { minScore: 60, maxScore: 69, gradeLetter: "B", remark: "Very good" },
  { minScore: 70, maxScore: 100, gradeLetter: "A", remark: "Excellent" },
] as const;

export function scoreFor(studentIndex: number, subjectIndex: number, termOffset = 0) {
  const total = 47 + ((studentIndex * 7 + subjectIndex * 11 + termOffset * 5) % 49);
  const ca1 = 10 + ((studentIndex + subjectIndex + termOffset) % 10);
  const ca2 = 10 + ((studentIndex * 2 + subjectIndex + termOffset) % 10);
  const ca3 = 10 + ((studentIndex + subjectIndex * 2 + termOffset) % 10);
  const examRawScore = Math.max(0, Math.min(40, total - ca1 - ca2 - ca3));
  return { ca1, ca2, ca3, examRawScore, total: ca1 + ca2 + ca3 + examRawScore };
}

export const DEMO_EVENTS = [
  ["Welcome Back Assembly", "A bright start to the new term with families and staff.", "School Hall", "2026-01-12"],
  ["STEM Discovery Fair", "Student demonstrations, coding challenges, and science exhibits.", "Innovation Lab", "2026-02-06"],
  ["Inter-house Athletics", "Track, field, and house-spirit competitions.", "Main Field", "2026-02-20"],
  ["Reading Week", "Author visit and class reading showcases.", "Library", "2026-03-02"],
  ["Parent Partnership Evening", "Term progress conversations and learning workshops.", "School Hall", "2026-03-13"],
  ["Creative Arts Exhibition", "Music, visual art, and drama performances.", "Arts Studio", "2026-03-20"],
] as const;

export type SchoolSeedProfileKey = "demo" | "judge";

const JUDGE_STUDENT_NAMES = [
  "Terra Okafor", "Luna Mensah", "Sol Adeyemi", "Sora Bello",
] as const;

const JUDGE_STUDENTS: DemoStudent[] = DEMO_STUDENTS.map((student, index) => {
  const name = JUDGE_STUDENT_NAMES[index] ?? student.name;
  const [firstName, lastName] = name.split(" ");
  return {
    ...student,
    name,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@students.codex-academy.school`,
    admissionNumber: `CA/2026/${String(index + 1).padStart(3, "0")}`,
  };
});

export const JUDGE_RESET_CONFIRMATION = "RESET codex-academy" as const;

export const JUDGE_ACCOUNT_IDENTITIES = {
  admin: { name: "Amina Codex", email: "admin@codex-academy.school" },
  teacher: { name: "Ada Terra", email: "teacher@codex-academy.school" },
  portal: { name: "Grace Nova", email: "parent@codex-academy.school" },
} as const;

export function getSchoolSeedProfile(key: SchoolSeedProfileKey) {
  if (key === "judge") {
    return {
      key,
      schoolName: "Codex Academy",
      schoolSlug: "codex-academy",
      createdAt: DEMO_CREATED_AT,
      accounts: JUDGE_ACCOUNT_IDENTITIES,
      extraTeachers: [
        { name: "Tobi Vector", email: "tobi.vector@codex-academy.school" },
        { name: "Nneka Canvas", email: "nneka.canvas@codex-academy.school" },
      ],
      subjects: DEMO_SUBJECTS,
      classes: DEMO_CLASSES,
      students: JUDGE_STUDENTS,
      bands: DEMO_BANDS,
      events: [
        ["Codex Welcome Assembly", "A new term begins with curiosity, care, and creative problem-solving.", "School Hall", "2026-01-12"],
        ["Terra Science Fair", "Student experiments, coding challenges, and practical demonstrations.", "Innovation Lab", "2026-02-06"],
        ["Luna Reading Week", "Book circles, author visits, and class reading showcases.", "Library", "2026-03-02"],
        ["Sora Creative Exhibition", "Music, visual art, film, and drama performances.", "Arts Studio", "2026-03-20"],
      ] as const,
      authPrefix: "codex",
      schoolCode: "CA",
      familyLabel: "Codex",
      portalFamilyName: "Nova Family",
      cityName: "Innovation City",
    } as const;
  }

  return {
    key,
    schoolName: "Demo Academy",
    schoolSlug: DEMO_SCHOOL_SLUG,
    createdAt: DEMO_CREATED_AT,
    accounts: DEMO_ACCOUNTS,
    extraTeachers: [
      { name: "Sade Adeyemi", email: "sade.adeyemi@demo-academy.school" },
      { name: "Chinedu Okoro", email: "chinedu.okoro@demo-academy.school" },
    ],
    subjects: DEMO_SUBJECTS,
    classes: DEMO_CLASSES,
    students: DEMO_STUDENTS,
    bands: DEMO_BANDS,
    events: DEMO_EVENTS,
    authPrefix: "demo",
    schoolCode: "DA",
    familyLabel: "Demo",
    portalFamilyName: "Adeyemi Family",
    cityName: "Demo City",
  } as const;
}
