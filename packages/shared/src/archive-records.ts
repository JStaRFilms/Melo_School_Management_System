// @ts-check

import { db } from 'convex/node';
import { z } from 'zod';
import { isSchoolAdmin } from '@school/auth';

// Archive record types
export const ArchiveRecordSchema = z.object({
  _id: z.string(),
  _creationTime: z.number(),
  schoolId: z.string(),
  type: z.enum(['subject', 'class', 'teacher', 'session']),
  recordId: z.string(),
  recordType: z.string(),
  recordName: z.string(),
  archivedBy: z.string(),
  archivedAt: z.number(),
  context: z.object({
    sessionId: z.string().optional(),
    classId: z.string().optional(),
    teacherId: z.string().optional(),
    studentId: z.string().optional(),
    subjectId: z.string().optional(),
  }).optional(),
});

export type ArchiveRecord = z.infer<typeof ArchiveRecordSchema>;

// Archive query parameters
export const ArchiveQuerySchema = z.object({
  type: z.enum(['subject', 'class', 'teacher', 'session']).optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

export type ArchiveQuery = z.infer<typeof ArchiveQuerySchema>;

// Archive summary types
export const ArchiveSummarySchema = z.object({
  type: z.enum(['subject', 'class', 'teacher', 'session']),
  count: z.number(),
  lastArchivedAt: z.number(),
});

export type ArchiveSummary = z.infer<typeof ArchiveSummarySchema>;

// Archive detail types
export const ArchiveDetailSchema = z.object({
  _id: z.string(),
  type: z.enum(['subject', 'class', 'teacher', 'session']),
  recordId: z.string(),
  recordType: z.string(),
  recordName: z.string(),
  archivedBy: z.string(),
  archivedAt: z.number(),
  context: z.object({
    sessionId: z.string().optional(),
    classId: z.string().optional(),
    teacherId: z.string().optional(),
    studentId: z.string().optional(),
    subjectId: z.string().optional(),
  }).optional(),
  details: z.any(),
});

export type ArchiveDetail = z.infer<typeof ArchiveDetailSchema>;

// Archive functions
export function listArchivedRecords(query: ArchiveQuery = {}) {
  return db.query`
    with archived as (
      select *
      from ArchiveRecords
      where schoolId = ${db.currentUser.schoolId}
      ${query.type ? db.sql`a.type = ${query.type}` : db.sql`true`}
      order by archivedAt desc
      ${query.limit ? db.sql`limit ${query.limit}` : db.sql`null`}
      ${query.offset ? db.sql`offset ${query.offset}` : db.sql`null`}
    )
    select a.*, 
           (select name from Subjects where _id = a.recordId) as subjectName,
           (select name from Classes where _id = a.recordId) as className,
           (select name from Teachers where _id = a.recordId) as teacherName,
           (select name from AcademicSessions where _id = a.recordId) as sessionName
    from archived a
  `;
}

export function getArchivedRecordSummary() {
  return db.query`
    select type,
           count(*) as count,
           max(archivedAt) as lastArchivedAt
    from ArchiveRecords
    where schoolId = ${db.currentUser.schoolId}
    group by type
    order by lastArchivedAt desc
  `;
}

export function getArchivedRecordDetail(recordId: string) {
  return db.query`
    select a.*, 
           (select name from Subjects where _id = a.recordId) as subjectName,
           (select name from Classes where _id = a.recordId) as className,
           (select name from Teachers where _id = a.recordId) as teacherName,
           (select name from AcademicSessions where _id = a.recordId) as sessionName
    from ArchiveRecords a
    where a._id = ${recordId} and a.schoolId = ${db.currentUser.schoolId}
  `;
}

export function getArchivedRecordsByType(type: 'subject' | 'class' | 'teacher' | 'session') {
  return db.query`
    select a.*, 
           (select name from Subjects where _id = a.recordId) as subjectName,
           (select name from Classes where _id = a.recordId) as className,
           (select name from Teachers where _id = a.recordId) as teacherName,
           (select name from AcademicSessions where _id = a.recordId) as sessionName
    from ArchiveRecords a
    where a.schoolId = ${db.currentUser.schoolId}
      and a.type = ${type}
    order by archivedAt desc
  `;
}

// Archive mutations
export function createArchiveRecord(record: ArchiveRecord) {
  return db.insert('ArchiveRecords', record);
}

export function deleteArchiveRecord(recordId: string) {
  return db.delete('ArchiveRecords', recordId);
}

// Archive validation
export function validateArchiveRecord(record: ArchiveRecord) {
  return ArchiveRecordSchema.parse(record);
}

// Archive utilities
export function formatArchiveTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function getArchiveRecordTypeDisplayName(type: 'subject' | 'class' | 'teacher' | 'session'): string {
  const typeMap: Record<string, string> = {
    subject: 'Subject',
    class: 'Class',
    teacher: 'Teacher',
    session: 'Academic Session',
  };
  return typeMap[type] || 'Record';
}

export function getArchiveRecordContextSummary(context: ArchiveRecord['context']): string {
  if (!context) return 'No context available';
  
  const parts: string[] = [];
  if (context.sessionId) parts.push('Session context available');
  if (context.classId) parts.push('Class context available');
  if (context.teacherId) parts.push('Teacher context available');
  if (context.studentId) parts.push('Student context available');
  if (context.subjectId) parts.push('Subject context available');
  
  return parts.length > 0 ? parts.join(', ') : 'No context available';
}