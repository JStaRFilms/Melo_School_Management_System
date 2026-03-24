# Global Sitemap: School Management System

**Date:** 2026-03-15  
**Status:** Approved  
**Apps Covered:** `www`, `admin`, `teacher`, `portal`

## Overview

This document defines the complete page inventory for all four application surfaces in the School Management System. Each app serves distinct user groups with role-specific workflows.

---

## App 1: `www` — Public Marketing Website

**Purpose:** Public-facing marketing site and admissions portal for prospective families.  
**Base Path:** `/`  
**Auth Required:** No

### 1.1 Homepage
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/` | Landing page | Hero section, school highlights, call-to-action, testimonials, contact info |

### 1.2 About Section
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/about` | School history and mission | Timeline, leadership bios, values |
| `/facilities` | Campus and infrastructure | Photo gallery, virtual tour |
| `/staff` | Faculty and staff directory | Searchable list, profiles |

### 1.3 Academics
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/academics` | Academic overview | Curriculum, approach, achievements |
| `/curriculum` | Detailed curriculum info | Subject breakdown by level |
| `/calendar` | Academic calendar | Events, term dates |

### 1.4 Admissions
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/admissions` | Admissions landing | Requirements, process overview |
| `/apply` | Application form | Multi-step form, document upload |
| `/fees` | Fee structure | Tuition, payments, FAQs |
| `/visit` | Schedule a visit | Calendar booking, contact form |

### 1.5 News & Events
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/news` | News and announcements | Blog listing, filters |
| `/news/[slug]` | News detail | Article, images, share |
| `/events` | School events | Calendar view, registration |
| `/gallery` | Photo/video gallery | Albums, lightbox |

### 1.6 Contact
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/contact` | Contact page | Form, map, contact details |

### 1.7 Auth (Shared)
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/login` | User login | Email/password, social login |
| `/register` | New user signup | Registration form |
| `/forgot-password` | Password recovery | Email input |

---

## App 2: `admin` — School Administration Console

**Purpose:** Full operational control for school admins, bursars, and super admins.  
**Base Path:** `/admin`  
**Auth Required:** Yes (School Admin, Bursar, Super Admin roles)

### 2.1 Dashboard
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/admin` | Main dashboard | Stats widgets, quick actions, notifications, activity feed |
| `/admin/overview` | Executive summary | KPIs, charts, alerts |

### 2.2 School Setup
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/admin/school` | School profile | Logo, name, contact, branding |
| `/admin/school/branding` | White-label settings | Theme colors, fonts, templates |
| `/admin/school/terms` | Academic calendar | Sessions, terms, holidays |
| `/admin/school/settings` | Global settings | Config flags, preferences |

### 2.3 Users & Access
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/admin/users` | User directory | Search, filters, bulk actions |
| `/admin/users/staff` | Staff management | Teachers, admins list |
| `/admin/users/students` | Student roster | Class filtering, profiles |
| `/admin/users/parents` | Parent accounts | Family linking, access |
| `/admin/users/invite` | Invite new users | Email invite form |
| `/admin/permissions` | Role & permissions | Permission matrix editor |

### 2.4 Academic Structure
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/admin/academics` | Academic dashboard | Overview, quick navigation |
| `/admin/academics/classes` | Class management | Create, edit, assign teachers |
| `/admin/academics/subjects` | Subject catalog | Subject list, teachers |
| `/admin/academics/assignments` | Teacher-class mapping | Bulk assignments |
| `/admin/academics/class-subjects` | Class-subject linking | Subject allocation |

### 2.5 Enrollments
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/admin/enrollments` | Enrollment dashboard | Stats, recent enrollments |
| `/admin/enrollments/new` | New enrollment | Student form, class selection |
| `/admin/enrollments/bulk` | Bulk import | CSV upload, mapping |
| `/admin/enrollments/[id]` | Enrollment detail | Full student profile |
| `/admin/enrollments/families` | Family management | Parent-student linking |

### 2.6 Assessments
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/admin/assessments` | Assessment overview | Terms, statuses |
| `/admin/assessments/setup` | Assessment config | CA weights, grading rules |
| `/admin/assessments/setup/exam-recording` | Exam recording settings | School exam mode, policy summary |
| `/admin/assessments/setup/grading-bands` | Grading band editor | Min/max bands, grade letter, remark validation |
| `/admin/assessments/results` | All results | Filter by class, term |
| `/admin/assessments/results/entry` | Admin bulk score entry | Session, term, class, subject selectors and roster grid |
| `/admin/assessments/results/[id]` | Result detail | Student scores, edit |
| `/admin/assessments/approval` | Result moderation | Approve/reject workflow |
| `/admin/assessments/publish` | Publish results | Bulk publish, notifications |

### 2.7 Report Cards
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/admin/reports` | Report cards dashboard | Generation status |
| `/admin/reports/generate` | Generate reports | Class/term selection |
| `/admin/reports/[studentId]` | Individual report | Full academic record |
| `/admin/reports/print` | Print queue | Bulk print, PDF download |
| `/admin/reports/templates` | Report templates | Branding, layout config |

### 2.8 Billing & Finance
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/admin/billing` | Finance dashboard | Revenue, outstanding, charts |
| `/admin/billing/fee-plans` | Fee plan management | Create, edit plans |
| `/admin/billing/invoices` | Invoice management | List, filters, status |
| `/admin/billing/invoices/new` | Create invoice | Student selection, items |
| `/admin/billing/invoices/[id]` | Invoice detail | Line items, payments |
| `/admin/billing/payments` | Payment records | All transactions |
| `/admin/billing/payments/manual` | Manual entry | Record cash/cheque |
| `/admin/billing/reconciliation` | Payment matching | Bank vs system |
| `/admin/billing/waivers` | Fee waivers | Discounts, exemptions |
| `/admin/billing/reports` | Financial reports | Collections, aging, export |

### 2.9 Communications
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/admin/communications` | Message center | Inbox, sent, drafts |
| `/admin/communications/compose` | Send message | Template, recipients |
| `/admin/communications/templates` | Email/SMS templates | Editor, variables |
| `/admin/communications/history` | Delivery history | Status, opens, clicks |

### 2.10 Teacher Tools (Admin View)
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/admin/teachers/lessons` | Lesson plan overview | School-wide view |
| `/admin/teachers/ai-tools` | AI tool management | OCR, quiz generation |

### 2.11 Support & Settings
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/admin/settings` | Admin settings | Profile, preferences |
| `/admin/audit` | Audit logs | User actions, changes |
| `/admin/support` | Support panel | Help, tickets |
| `/admin/api-keys` | API management | Key generation, usage |

---

## App 3: `teacher` — Teacher Workspace

**Purpose:** Classroom tools for lesson planning, assessments, and grading.  
**Base Path:** `/teacher`  
**Auth Required:** Yes (Teacher role)

### 3.1 Dashboard
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/teacher` | Main dashboard | My classes, upcoming lessons, alerts |
| `/teacher/today` | Today's schedule | Periods, classes, quick actions |

### 3.2 Classes & Students
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/teacher/classes` | My classes | Class list with subjects |
| `/teacher/classes/[id]` | Class detail | Student roster, stats |
| `/teacher/classes/[id]/attendance` | Take attendance | Mark present/absent |

### 3.3 Lesson Planning
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/teacher/lessons` | Lesson plans | Calendar, list view |
| `/teacher/lessons/new` | Create lesson | Subject, class, objectives |
| `/teacher/lessons/[id]` | Lesson detail | Full plan, resources |
| `/teacher/lessons/templates` | Lesson templates | Reusable formats |
| `/teacher/lessons/ocr` | OCR scan handwritten | Upload, extract text |

### 3.4 Assessments & Results
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/teacher/assessments` | My assessments | CA and exam scores |
| `/teacher/assessments/entry` | Score entry | Class, subject, students |
| `/teacher/assessments/exams/entry` | Exam recording sheet | Session, term, class, subject selectors and roster grid |
| `/teacher/assessments/[id]/edit` | Edit scores | Update, save |
| `/teacher/assessments/submit` | Submit for approval | Lock and submit |
| `/teacher/results` | My results | Published, pending |

### 3.5 Report Cards
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/teacher/reports` | Report generation | Class selection |
| `/teacher/reports/[classId]` | Class reports | Generate, preview |
| `/teacher/reports/comments` | Teacher comments | Bulk comment entry |

### 3.6 AI Tools
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/teacher/ai` | AI assistant | Chat, suggestions |
| `/teacher/ai/quiz` | Generate quiz | AI quiz from topic |
| `/teacher/ai/cbt` | Create CBT | Auto-generate questions |

### 3.7 Communications
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/teacher/messages` | Messages | Inbox, compose |
| `/teacher/notifications` | Notifications | Alerts, reminders |

### 3.8 Profile
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/teacher/profile` | My profile | Bio, contact, subjects |
| `/teacher/settings` | Preferences | Notifications, theme |

---

## App 4: `portal` — Parent & Student Portal

**Purpose:** Academic view for parents and students to track progress, results, and payments.  
**Base Path:** `/portal`  
**Auth Required:** Yes (Parent, Student roles)

### 4.1 Dashboard
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/portal` | Main dashboard | Welcome, quick stats, alerts |
| `/portal/overview` | Academic summary | Current term, attendance |

### 4.2 Academic Records
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/portal/academics` | Academic overview | All subjects, terms |
| `/portal/academics/results` | View results | By term, subject |
| `/portal/academics/[termId]` | Term results | Full report card |
| `/portal/academics/transcript` | Official transcript | Download, history |

### 4.3 Report Cards
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/portal/reports` | Available reports | Term list |
| `/portal/reports/[termId]` | View report card | Interactive view |
| `/portal/reports/print` | Print report | Print-optimized layout |
| `/portal/reports/download` | PDF download | Save locally |

### 4.4 Attendance
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/portal/attendance` | Attendance record | Calendar view |
| `/portal/attendance/history` | Full history | All terms |

### 4.5 Timetable
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/portal/timetable` | Class schedule | Weekly view |
| `/portal/timetable/exam` | Exam timetable | Upcoming exams |

### 4.6 Billing & Payments
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/portal/billing` | Billing dashboard | Balance, due dates |
| `/portal/billing/invoices` | My invoices | List, status |
| `/portal/billing/invoices/[id]` | Invoice detail | Line items |
| `/portal/billing/pay` | Make payment | Online payment flow |
| `/portal/billing/history` | Payment history | All transactions |
| `/portal/billing/receipts` | Receipts | Download, print |

### 4.7 Communications
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/portal/messages` | Messages from school | Inbox |
| `/portal/messages/compose` | Contact school | Send to admin |
| `/portal/notifications` | All notifications | List, mark read |

### 4.8 Profile
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/portal/profile` | My profile | Student info |
| `/portal/profile/students` | Linked students | For parents |
| `/portal/settings` | Account settings | Password, preferences |

### 4.9 Support
| Route | Page Purpose | Key Components |
|-------|---------------|-----------------|
| `/portal/support` | Help & support | FAQ, contact |

---

## Route Groupings Summary

```mermaid
flowchart TB
    subgraph "www - Public Site"
        WWW[Homepage<br/>- /]
        WWW_About[About<br/>- /about<br/>- /facilities<br/>- /staff]
        WWW_Academics[Academics<br/>- /academics<br/>- /curriculum<br/>- /calendar]
        WWW_Admissions[Admissions<br/>- /admissions<br/>- /apply<br/>- /fees<br/>- /visit]
        WWW_News[News & Events<br/>- /news<br/>- /events<br/>- /gallery]
        WWW_Contact[Contact<br/>- /contact]
    end

    subgraph "admin - School Admin"
        ADMIN[Dashboard<br/>- /admin]
        ADMIN_Setup[Setup<br/>- /admin/school<br/>- /admin/school/branding]
        ADMIN_Users[Users<br/>- /admin/users<br/>- /admin/users/staff<br/>- /admin/users/students<br/>- /admin/users/parents]
        ADMIN_Academics[Academics<br/>- /admin/academics/classes<br/>- /admin/academics/subjects]
        ADMIN_Enroll[Enrollments<br/>- /admin/enrollments<br/>- /admin/enrollments/new]
        ADMIN_Assess[Assessments<br/>- /admin/assessments<br/>- /admin/assessments/results<br/>- /admin/assessments/approval]
        ADMIN_Reports[Reports<br/>- /admin/reports<br/>- /admin/reports/generate<br/>- /admin/reports/print]
        ADMIN_Billing[Billing<br/>- /admin/billing<br/>- /admin/billing/invoices<br/>- /admin/billing/payments<br/>- /admin/billing/reconciliation]
        ADMIN_Comm[Communications<br/>- /admin/communications<br/>- /admin/communications/compose]
    end

    subgraph "teacher - Teacher Workspace"
        TEACH[Dashboard<br/>- /teacher]
        TEACH_Classes[Classes<br/>- /teacher/classes<br/>- /teacher/classes/[id]]
        TEACH_Lessons[Lessons<br/>- /teacher/lessons<br/>- /teacher/lessons/new]
        TEACH_Assess[Assessments<br/>- /teacher/assessments/entry<br/>- /teacher/assessments/submit]
        TEACH_Reports[Reports<br/>- /teacher/reports<br/>- /teacher/reports/comments]
        TEACH_AI[AI Tools<br/>- /teacher/ai<br/>- /teacher/ai/quiz<br/>- /teacher/ai/cbt]
    end

    subgraph "portal - Parent/Student"
        PORT[Dashboard<br/>- /portal]
        PORT_Academics[Academics<br/>- /portal/academics/results<br/>- /portal/academics/[termId]]
        PORT_Reports[Reports<br/>- /portal/reports<br/>- /portal/reports/print<br/>- /portal/reports/download]
        PORT_Attendance[Attendance<br/>- /portal/attendance]
        PORT_Timetable[Timetable<br/>- /portal/timetable]
        PORT_Billing[Billing<br/>- /portal/billing/invoices<br/>- /portal/billing/pay<br/>- /portal/billing/history]
    end
```

---

## Key Cross-Cutting Routes

| Pattern | Description |
|---------|-------------|
| `/[app]/404` | Custom not-found page |
| `/[app]/500` | Error boundary page |
| `/[app]/loading` | Loading skeleton |
| `/[app]/support` | Help center |

---

## Verification Checklist

- [x] **www (Public Site):** 7 route groups, ~15 pages
- [x] **admin (School Admin):** 10 route groups, ~35 pages  
- [x] **teacher (Teacher Workspace):** 8 route groups, ~20 pages
- [x) **portal (Parent/Student):** 9 route groups, ~20 pages
- [x] **Billing paths included:** admin/billing, portal/billing, payments, invoices
- [x] **Report card paths included:** admin/reports, teacher/reports, portal/reports
- [x] **Support panels included:** admin/support, portal/support
- [x] **Print views included:** report card print, invoice print
- [x] **Payment history included:** payment records, receipts

---

*This sitemap serves as the design-to-build contract for all mockup and implementation work.*
