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

- [ ] We need to add photo editor

- [ ] Now I realize something, it's minor, nothing crazy, but when I'm signed in as staff for a particular school, I can't tell which school it is. The dashboard doesn't say; the logo up top is still the default one. Even in the side panel or the browser tab, there's nothing like "OBHIS Teacher Portal" or "Admin Portal OBHIS." Could we add dynamic page metadata so each school gets its own branding? The whole UI should feel like it belongs to that school. This will matter a lot once parents start logging in, because we need them to know instantly which school they're connected to. and then we could make it more complicated: a parent might have kids in different schools, so when they log in they should see all of them. they could also log in with a kid's email, but that's separate. different parents, different kids, different schools, our system needs to handle those edge cases.

- [x] WE need to re work on the printing screen and scalling stuff to fit the screen and what not hehe...
- [ ] I already implemented the printing feature for a single student at a time, but when I tried the multiple‑student printing available on the admin and teacher portals, it didn't work well. I don't want to tamper with the existing functionality, so I plan to duplicate the shared functions and components and create a new version for the other use case. That should make it easier to get it working. We'll create a dedicated feature for printing multiple students at once, so printing everyone in a class becomes simpler.

- [x] UI fixes for the billing page, the portal and then the main website and the templates

- [ ] We need to modularize the student portal page. I think it's too monolithic as it stands, and as we start to expand later, it might become a problem.

- [ ] There needs to be a proper way for schools to check and print invoices. They should be able to print invoices that include links and a QR code, and display the QR code in the UI. Schools should also be able to print a statement, like a bank statement, to show when people pay. Additionally, they should be able to see payment dates and times in the UI.

- [ ] There are several UI issues on the knowledge templates page in the admin portal. One problem is the many duplicate entries; we need a cleaning option. When I click on a monitor, specifically the designer monitor, and change the template catalog, it returns me to the designer view. It should stay on the page I was on before clicking. Does that make sense?

- [ ] In future builds, if we create a study app later on, it would be nice for the app to work independently to some extent while still being able to use features from Melo, if available. That way, students whose schools have Melo can use their portal and access all the features, and students whose schools don’t have Melo can use it as a standalone, join a community of students, share resources, study together, and see their game scores and other metrics.