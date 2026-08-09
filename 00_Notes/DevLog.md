# School Management System - Development Log

**Project spawned:** 2026-03-14  
**Client:** N/A

## Technical Specs

- Language:
- Framework:

### How to Run

Run the admin dev server:

```bash
pnpm --filter @school/admin dev
```

## Completed Notes

- [x] Create project

- [x] I should be able to edit teachers names and emails later and reset their passwords

- [x] I should be able to edit subjects and edit the subject names even

- [x] I should be able to edit session details, like changing which session is active. There should be some limits, but I should still be able to do it. For example, when I create a new session and save it, if I untick "set as active session," I can't find any way to make that session active again. I don't see it in the UI. Maybe a trigger will appear later, but it hasn't yet.

- [x] Okay, so here in Nigeria it's common to have many classes. For example, I could have primary four, but the school might call that class Olive Blossom. Do you understand? With the current setup I can only configure the class name, so we need to adjust that.

- [x] /academic/students
  I noticed that when I'm on the student route, the academic student route, I have to manually click on all the subjects one by one. I strongly believe that if I've already clicked on the subjects for a class, like I'm in a class and sorting out that class right now for a class student, I should have the option - I should have like a small button that is select all or something like that. So select all and then deselect the ones that child is not offering. That way it's easier - do you understand accounting - it's easier for me to handle. Do you get it? Yeah. IT'S BETER UX

- [x] I should be able to cleanly edit the details of a student not just their subjects

- [x] The admin and switch-areas pages need a single unified nav bar. Right now it's patchy: some options appear, others vanish, and you get yanked around to different places. Build one shared nav bar that works for admin, students, and teachers.

- [x] We need to set up archive-only deletion for subjects, sessions, teachers, and classes: instead of deleting, archive the records so sensitive data is never lost. Make sure error handling covers all cases. Also, I should be able to edit the students' details later.

- [x] I can also add a dedicated "archived records" admin view next, so archived subjects/classes/teachers/sessions are browsable without restoring delete behavior.

- [x] Each teacher should only see the classes they're assigned to. They can't see or edit other classes in the drop-down menu.

- [x] Alright, I've implemented the results the way I like them. There are a few changes I need you to make, though. Look at the fields: teacher name, teacher's comment, and head teacher's comment. We don't expose teacher's comment or head teacher's comment in Convex or anywhere in the UI yet, so we need a clean, intuitive way to input them. Every student gets their own head-teacher comment and class-teacher comment. For now, just expose two separate inputs in the admin panel, one for the teacher's comment and one for the head teacher's comment. I'll tweak the flow later.

- [x] Also, we don't yet expose "next term begins" in Convex. For this iteration, let's add a manual date picker that sets the next-term start date and reflects it for every student in that term.
## Pending Notes

- [x] You can set a finalizing date. Once it's set, nobody can edit after that point. You could also set it so people can only edit the exams between certain dates. The admin controls that, so it's secure. Nobody can just edit it. It's an option they can turn on or off.

- [x] All right, here's the thing. We've already done the heavy lifting on how the results work: examinations, grades, the lot. But every school tacks on its own extras. One school might want three extra sections: attendance counts, an affective-domain rubric (punctuality, neatness, honesty... A, E scale), Sakamoto skills, creative activities. Another school will want five completely different blocks.

  I don't want to hard-wire this for one client; I want a global solution. The admin should be able to build any number of "add-on" bundles and pin them to levels, nursery gets one set, primary five another, secondary yet another. Teachers then see only the relevant fields, cleanly laid out.

  The current student-onboarding flow, create teacher, class, subject, enrol kids, fill bio data, already fills a page. Crowding Sakamoto skills onto the same screen will feel like an afterthought. Let's give these extras their own real estate: a dedicated admin page to configure the bundles, and a separate teacher page that surfaces only the fields each class needs.

  /academic/students I saw the form on the admin academic student page that lets you edit student info. We need a separate page just for onboarding a student. Instead of the usual flow, go to a class, pick the student, you'd start on a student page, pick the student, then pick the class. The two approaches run side-by-side. I'll list the fields we need: first name, last name, admission number, class, house, gender, date of birth, guardian name, guardian phone, address, and more.

  We need to map this out properly so the UX stays sane on both the admin and teacher sides, and anywhere else it touches.

- [x] School admins should be able to create other sub admins likewise the platform super-admin can create school admins. So there's a first school super-admin, right? That first admin is the one who can create other school admins and also archive them. And if that person leaves the school, they should be able to pass their supremeness to another admin to lead the others. All admins can create sub-admins, but only the supreme admin in that school can archive or "delete" other admins.

- [x] Some schools use an aggregation system where they merge certain subjects under one umbrella subject. A school might say, “For classes A, B, C, D, these subjects are grouped to form one subject,” say, Population Studies, which could include Home Economics, Agric, and others. The children still write separate exams for each component subject. Sometimes they sit the exams on the same day and split the marks 20/20; sometimes each full exam stays at 40 and Home Economics stays at 40, then you combine everything for the final score. We need the system to handle not just two subjects but any number merged, while still letting the Kusab subjects stand alone in other classes. It’s class-activated: the admin decides which classes get this treatment.

## Pending Notes

- [-] We need to work on debloating all the pages and working on UI generally

- [x] We need to add photo editor

- [x] Now I realize something, it's minor, nothing crazy, but when I'm signed in as staff for a particular school, I can't tell which school it is. The dashboard doesn't say; the logo up top is still the default one. Even in the side panel or the browser tab, there's nothing like "OBHIS Teacher Portal" or "Admin Portal OBHIS." Could we add dynamic page metadata so each school gets its own branding? The whole UI should feel like it belongs to that school. This will matter a lot once parents start logging in, because we need them to know instantly which school they're connected to. and then we could make it more complicated: a parent might have kids in different schools, so when they log in they should see all of them. they could also log in with a kid's email, but that's separate. different parents, different kids, different schools, our system needs to handle those edge cases.

- [x] WE need to re work on the printing screen and scalling stuff to fit the screen and what not hehe...
- [x] I already implemented the printing feature for a single student at a time, but when I tried the multiple‑student printing available on the admin and teacher portals, it didn't work well. I don't want to tamper with the existing functionality, so I plan to duplicate the shared functions and components and create a new version for the other use case. That should make it easier to get it working. We'll create a dedicated feature for printing multiple students at once, so printing everyone in a class becomes simpler.

- [x] UI fixes for the billing page, the portal and then the main website and the templates

- [x] We need to modularize the student portal page. I think it's too monolithic as it stands, and as we start to expand later, it might become a problem.

- [x] There needs to be a proper way for schools to check and print invoices. They should be able to print invoices that include links and a QR code, and display the QR code in the UI. Schools should also be able to print a statement, like a bank statement, to show when people pay. Additionally, they should be able to see payment dates and times in the UI.

- [x] There are several UI issues on the knowledge templates page in the admin portal. One problem is the many duplicate entries; we need a cleaning option. When I click on a monitor, specifically the designer monitor, and change the template catalog, it returns me to the designer view. It should stay on the page I was on before clicking. Does that make sense?

- [x] In future builds, if we create a study app later on, it would be nice for the app to work independently to some extent while still being able to use features from Melo, if available. That way, students whose schools have Melo can use their portal and access all the features, and students whose schools don’t have Melo can use it as a standalone, join a community of students, share resources, study together, and see their game scores and other metrics.

- [x] We need to confirm whether promotions are sorted out, like a child moving from one class to another. Does that actually work?

- [x] We need to work on the following:

1. Academic Students page, improve how it loads parents and children, assigns emails, and handles editable fields.
2. Knowledge Library on the admin page.
3. Template Studio on the admin page.
4. Assessment Profiles on the admin page.

Next batch:

- Teachers page library and all its subpages, including the video page.
- Portal: the entire knowledge system at the bottom.

- [ ] we need to upgrade the PDF parser cuz rn it's too mid

---

 - [x] On the admin academic students page, updating a student's record currently uses an inline save notificatoins instead of the toast system we created. This is annoying and needs to be fixed. Thank you.

  - [ ] on /academic/students we need to add a nice search feature that searches across the whole school and then we can click on a student and it will open the students class and select the student
 
 - [ ] The main website is mostly just words we need to clean it up and make sure I actually like it and it means something and it's functional and allt he links work and the user flow makes sense including the sub pages.

 - [ ] Make the Book demo stuff actually work

 - [ ] Work on SEO of the main site

 - [ ] We need a logo for the platform that we will use as the default for the browser previews and the default text that shows as meta data when you share a link to the site, I am not sure if we can get an automatic one incase we are sharing something about a school like student sharing pages or admins sharing urls between eachother so the the about changes, it's not really necceary but I would like to push it to the extreme without any major downside hehe

 - [ ] Make the App icon on the browser and the name change depending on what school is signed in

 - [ ] I should consider making a youtube video about the App

 - [ ] make the default entry page for the teacher app to be /planning

 - [ ] I need clarification on how the promotion stuff works

 - [ ] Future UX cleanup: move the student promotion/rollover flow out of the normal `/academic/students` roster page into a dedicated workspace, e.g. `/academic/students/promotions` or `/academic/sessions/rollover`. The current inline panel is okay for MVP because it only appears when cumulative annual mode is active, but long term the Students page should only show a compact banner/CTA like "End-of-session promotion is available". The dedicated page should handle review steps, promotion history, audit visibility, safer bulk-action confirmation, and keep everyday roster/subject management uncluttered.

 - [ ] Fix the /admin/dashboard UI of the admin page

 - [ ] Figure out the customization of the emails that are used for the students by default esspecially the fact that it's .local lmao, look at the possiblility of making it a real email i.e if they can actualy have a real inbox and what not, can we make it customizeable so that if a school had aother email provider they can easily do it, tbh I don't know how to make it normally like what's the standard and what not

 - [ ] We need to come up with a proper attendance system that can easily mere with the present system and isn't eaily editable kinda so that nobody can jut rig it persay or something I want it to be easily scalable, because later we might add hardware, e.g., scanning an ID card to activate something. We don’t want the current system where you can simply record how many times a child attended class, although that should still be possible. Ideally the teacher, not the student, would adjust it. Maybe we’ll make it so that when hardware is used, the number of swipes appears on the student’s dashboard, while the report card reflects whatever the teacher sets, which could be higher than the student’s count.

 - [ ] The school should be able to set the payment date and the due date and the number of installments and how the installments are calculated and the method of payment for the installments, i.e., installments can be paid using the app via stripe

 - [ ] We need to come up with a system to check if parents have paid their fees, the system should notify parents if they have not paid their fees, and the system should notify the school if the parents have not paid their fees, and the system should notify the school if the parents have paid their fees, and the system should notify the parents if the parents have not paid their fees, and the system should notify the school if the parents have paid their fees

 - [ ] "3. Website Engine & Future Client Architecture (How Sites are Made)
According to the architecture specifications (SharedCoreBespokeSchoolWebsiteArchitecture.md), the public website engine (apps/sites) is a single multi-tenant Next.js application that handles domain/host resolution dynamically.

Here is the exact plan for current and future clients:

Pattern A: Managed Bespoke Sites (e.g., OBHIS) The school wants their website hosted on the platform. The platform handles custom DNS and serving, but instead of using a rigid layout builder template, they get a custom React layout module under apps/sites/lib/renderers/obhis-v1. The factual content (contacts, photos, programs) is fetched from Convex (drafts editable in the admin portal), but the visual rendering code is fully developer-controlled. This keeps the design premium and fast. For future managed clients, a developer simply scaffolds a new folder (e.g., renderers/client-x-v1) and registers it in registry.ts.
Pattern B: External Sites (Clients with existing websites) The platform does not host their website or manage their DNS. The school simply links their existing website's "Apply Now" buttons directly to their school-scoped canonical application URL (e.g., https://apply.schoolplatform.com/s/<schoolSlug>). No DNS delegation or iframes are needed.
Pattern C: No Website For schools with no web presence, they share their direct application link across messaging/social media channels."
So I was going through this and I couldn't help but notice that the links need to be search engine optimized with custom banners if needed, or just a nice one. Do you understand? That they say, "Apply for so and so." Whatever information, maybe the information of the name of the form that the admin creates or something like that. I don't know. I just thought about it.
