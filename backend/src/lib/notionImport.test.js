import { describe, it, expect } from 'vitest';
import { buildWork, csvObjects, parseCsv, parseNotionDate, parsePage, parseRelation, priorityOf, projectStatusOf, taskStatusOf } from './notionImport.js';

describe('parseCsv', () => {
  it('reads quoted fields, doubled quotes and newlines inside quotes', () => {
    expect(parseCsv('a,b\n"x, y","he said ""hi""\nthere"\n')).toEqual([['a', 'b'], ['x, y', 'he said "hi"\nthere']]);
  });
  it('drops a BOM and blank lines, and reads CRLF', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('turns rows into objects by the header', () => {
    expect(csvObjects('Name,Status\nA,Done\nB,\n')).toEqual([{ Name: 'A', Status: 'Done' }, { Name: 'B', Status: '' }]);
  });
});

describe('parseNotionDate', () => {
  it('reads ISO, English and Arabic dates', () => {
    expect(parseNotionDate('2026-11-09')).toBe('2026-11-09');
    expect(parseNotionDate('November 9, 2026')).toBe('2026-11-09');
    expect(parseNotionDate('Nov 9, 2026 3:32 PM')).toBe('2026-11-09');
    expect(parseNotionDate('9 نوفمبر 2026')).toBe('2026-11-09');
    expect(parseNotionDate('٩ نوفمبر ٢٠٢٦')).toBe('2026-11-09');
    expect(parseNotionDate('22 سبتمبر 2026')).toBe('2026-09-22');
  });
  it('takes the start of a range', () => {
    expect(parseNotionDate('November 9, 2026 → November 12, 2026')).toBe('2026-11-09');
  });
  it('is null when empty or not understood', () => {
    expect(parseNotionDate('')).toBeNull();
    expect(parseNotionDate('someday')).toBeNull();
  });
});

describe('parseRelation', () => {
  it('lists the names, without their links', () => {
    expect(parseRelation('ماكنزي (المشاريع/ماكنزي 123.md)')).toEqual(['ماكنزي']);
    expect(parseRelation('One (a/b.md), Two (https://www.notion.so/x)')).toEqual(['One', 'Two']);
  });
  it('keeps a plain value as it is, and nothing as nothing', () => {
    expect(parseRelation('Hamed')).toEqual(['Hamed']);
    expect(parseRelation('')).toEqual([]);
  });
});

describe('statuses and priorities', () => {
  it('maps the Arabic and English names', () => {
    expect(taskStatusOf('خلصت')).toBe('done');
    expect(taskStatusOf('لسه')).toBe('todo');
    expect(taskStatusOf('اترمت')).toBe('dropped');
    expect(taskStatusOf('In progress')).toBe('doing');
    expect(projectStatusOf('تحت التشغيل')).toBe('active');
    expect(projectStatusOf('علي جنب')).toBe('paused');
    expect(projectStatusOf('على جنب')).toBe('paused');
    expect(projectStatusOf('تحت الصيانه بعد العصريه')).toBe('maintenance');
    expect(projectStatusOf('تحت الصيانة بعد العصرية')).toBe('maintenance');
    expect(projectStatusOf('تحت التخطيط')).toBe('planning');
    expect(priorityOf('High')).toBe('high');
    expect(priorityOf('')).toBeNull();
  });
});

describe('parsePage', () => {
  it('splits the title, the property lines and the body', () => {
    const page = parsePage('# اشتغل على الوحدة\n\nTask ID: 609\nالحاله: لسه\n\nالتفاصيل هنا\nوسطر تاني\n');
    expect(page.title).toBe('اشتغل على الوحدة');
    expect(page.properties).toEqual({ 'Task ID': '609', 'الحاله': 'لسه' });
    expect(page.body).toBe('التفاصيل هنا\nوسطر تاني');
  });
  it('has an empty body when there is only a header', () => {
    expect(parsePage('# T\n\nTask ID: 1\n').body).toBe('');
  });
});

describe('buildWork', () => {
  const projectRows = [
    { 'اسم المشروع': 'ماكنزي', Lead: 'Hamed ', Status: 'تحت التشغيل', Tags: 'مذاكره', 'التاريخ': 'September 22, 2026', 'الضروره': 'High' },
    { 'اسم المشروع': 'غزل', Lead: '', Status: 'علي جنب', Tags: 'ركين', 'التاريخ': '', 'الضروره': '' },
  ];
  const taskRows = [
    { 'اسم المهمه': 'اشتغل على الوحدة', 'Task ID': '609', 'الحاله': 'لسه', 'التاريخ': '9 نوفمبر 2026', 'الضروره': 'Medium', 'المشروع': 'ماكنزي (المشاريع/ماكنزي.md)', 'ل مين ؟': 'Hamed', 'بتاعة اي !': 'كورس, مذاكره' },
    { 'اسم المهمه': 'خلّصت', 'Task ID': '584', 'الحاله': 'خلصت', 'التاريخ': '2026-11-10', 'المشروع': 'مشروع مجهول (x.md)' },
  ];
  const taskPages = [{ title: 'اشتغل على الوحدة', properties: { 'Task ID': '609' }, body: 'وصف المهمة' }];
  const built = buildWork({ projectRows, taskRows, noteRows: [], taskPages });

  it('builds projects with the client kept apart', () => {
    expect(built.projects).toHaveLength(2);
    expect(built.projects[0]).toMatchObject({ name: 'ماكنزي', status: 'active', priority: 'high', lead: 'Hamed', date: '2026-09-22' });
    expect(built.projects[1]).toMatchObject({ status: 'paused', lead: null, date: null });
    expect(built.privates).toEqual([{ id: built.projects[0].id, client: 'مذاكره' }, { id: built.projects[1].id, client: 'ركين' }]);
  });
  it('builds tasks, linked to their project and given their page text', () => {
    expect(built.tasks[0]).toMatchObject({
      id: 't_609', no: 609, title: 'اشتغل على الوحدة', status: 'todo', priority: 'medium', date: '2026-11-09',
      projectId: built.projects[0].id, assignee: 'Hamed', tags: ['كورس', 'مذاكره'], description: 'وصف المهمة', doneAt: null,
    });
    expect(built.tasks[1]).toMatchObject({ status: 'done', doneAt: '2026-11-10T00:00:00.000Z', projectId: null });
  });
  it('warns about what it could not place', () => {
    expect(built.warnings).toEqual(['Task #584: no project named "مشروع مجهول"']);
  });
  it('gives the same ids every time, so a second import only updates', () => {
    expect(buildWork({ projectRows, taskRows, noteRows: [], taskPages }).projects.map((p) => p.id)).toEqual(built.projects.map((p) => p.id));
  });
});
