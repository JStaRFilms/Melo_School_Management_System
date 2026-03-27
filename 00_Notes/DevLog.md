# School Management System — Development Log

**Project spawned:** 2026-03-14  
**Client:** N/A

## Technical Specs

- Language: 
- Framework: 

## Log

### 2026-03-14 - Initial Setup
- [x] Create project
- [ ] 


[x] I should be able to edit teachers names and emails later and reset their passwords
[x] I should be able to edit subjects and edit the subject names even
[x] I should be able to edit session details, like changing which session is active. There should be some limits, but I should still be able to do it. For example, when I create a new session and save it, if I untick “set as active session,” I can’t find any way to make that session active again. I don’t see it in the UI. Maybe a trigger will appear later, but it hasn’t yet.
[x] Okay, so here in Nigeria it's common to have many classes. For example, I could have primary four, but the school might call that class Olive Blossom. Do you understand? With the current setup I can only configure the class name, so we need to adjust that.

---

[x] /academic/students
I noticed that when I'm on the student route, the academic student route, I have to manually click on all the subjects one by one. I strongly believe that if I've already clicked on the subjects for a class, like I'm in a class and sorting out that class right now for a class student, I should have the option - I should have like a small button that is select all or something like that. So select all and then deselect the ones that child is not offering. That way it's easier - do you understand accounting - it's easier for me to handle. Do you get it? Yeah. IT'S BETER UX

[x] I should be able to cleanly edit the details of a student not just their subjects

[x] The admin and switch-areas pages need a single unified nav bar. Right now it’s patchy: some options appear, others vanish, and you get yanked around to different places. Build one shared nav bar that works for admin, students, and teachers.

[ ] We need to set up archive-only deletion for subjects, sessions, teachers, and classes: instead of deleting, archive the records so sensitive data is never lost. Make sure error handling covers all cases. Also, I should be able to edit the students' details later.

[ ] You can set a finalizing date. Once it's set, nobody can edit after that point. You could also set it so people can only edit the exams between certain dates. The admin controls that, so it's secure. Nobody can just edit it. It's an option they can turn on or off.

[ ] I can also add a dedicated “archived records” admin view next, so archived subjects/classes/teachers/sessions are browsable without restoring delete behavior.

[x] Each teacher should only see the classes they're assigned to. They can't see or edit other classes in the drop-down menu.

[x] Alright, I've implemented the results the way I like them. There are a few changes I need you to make, though. Look at the fields: teacher name, teacher's comment, and head teacher's comment. We don't expose teacher's comment or head teacher's comment in Convex or anywhere in the UI yet, so we need a clean, intuitive way to input them. Every student gets their own head-teacher comment and class-teacher comment. For now, just expose two separate inputs in the admin panel, one for the teacher's comment and one for the head teacher's comment. I'll tweak the flow later.

Also, we don't yet expose "next term begins" in Convex. For this iteration, let’s add a manual date picker that sets the next-term start date and reflects it for every student in that term.

[ ] /academic/students I saw the form on the admin academic student page that lets you edit student info. We need a separate page just for onboarding a student. Instead of the usual flow, go to a class, pick the student, you’d start on a student page, pick the student, then pick the class. The two approaches run side-by-side. I’ll list the fields we need: first name, last name, admission number, class, house, gender, date of birth, guardian name, guardian phone, address, and more.

[ ] We need to work on debloadting all the pages and working on UI generally

[ ] We need to add photo editor 