import React, { useEffect, useMemo, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { countTasks, groupProjects, isWorkedOn, monthStarts, progressOf, projectSpan } from '@/domain/work/projects';
import { addDays, daysBetween, dayKey } from '@/domain/work/tasks';
import type { Project, Task } from '@/domain/work/types';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { IconPlus as Plus } from '@/ui/icons';
import { ProgressBar } from '@/ui/ProgressBar';
import { PriorityChip, ProjectStatusChip, shortDate } from '@/features/work/components/chips';

interface ViewProps {
  projects: readonly Project[];
  tasksOf: (projectId: string) => readonly Task[];
  clientOf: (projectId: string) => string | null;
  onOpen: (projectId: string) => void;
}

const ProjectCard: React.FC<{ project: Project; tasks: readonly Task[]; draggable: boolean; onOpen: () => void; overlay?: boolean }> = ({ project, tasks, draggable, onOpen, overlay = false }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: project.id, disabled: !draggable || overlay });
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={onOpen}
      style={{ opacity: isDragging ? 0 : 1, touchAction: 'manipulation' }}
      className={`rounded-box border border-ink/12 bg-paper-dark p-3.5 cursor-pointer select-none transition-colors ${overlay ? 'rotate-1' : 'hover:border-ink/35'}`}
    >
      <p dir="auto" className="font-sans-main text-[14px] font-bold leading-relaxed mb-2.5 text-left break-words">{project.name}</p>
      <div className="flex flex-wrap items-center gap-2 mb-3"><ProjectStatusChip status={project.status} /><PriorityChip priority={project.priority} /></div>
      <ProgressBar value={progressOf(tasks)} showValue />
    </div>
  );
};

const ClientColumn: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={`w-[270px] shrink-0 rounded-card p-3 flex flex-col gap-2.5 min-h-[120px] transition-colors ${isOver ? 'bg-ink/8' : 'bg-ink/4'}`}>{children}</div>;
};

/**
 * The projects as cards, a column for each client (what the Notion "Plan" board did). With `onMoveClient`, a card is
 * dragged to another column to change whose project it is — it moves at once, before the change is saved.
 */
export const ProjectCards: React.FC<ViewProps & { onNew?: (client: string | null) => void; onMoveClient?: (projectId: string, client: string | null) => void }> = ({ projects, tasksOf, clientOf, onOpen, onNew, onMoveClient }) => {
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState<Project | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );
  // A moved card lets go of its override once the saved client matches it.
  useEffect(() => {
    setMoved((m) => {
      const keep = Object.entries(m).filter(([id, client]) => (clientOf(id) ?? '') !== client);
      return keep.length === Object.keys(m).length ? m : Object.fromEntries(keep);
    });
  }, [clientOf]);
  const shownClientOf = (id: string) => (id in moved ? moved[id] || null : clientOf(id));
  const groups = groupProjects(projects, 'client', shownClientOf);
  // While dragging, every client (and "no client") is a place to drop, even one with no projects left in it.
  const allClients = [...new Set([...groups.map((g) => g.key), ...(onMoveClient ? [''] : [])])];
  const columns = allClients.map((key) => groups.find((g) => g.key === key) ?? { key, label: key || 'No client', projects: [] as Project[] });

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const id = String(e.active.id);
    const to = e.over ? String(e.over.id).replace(/^client:/, '') : null;
    if (to === null || !onMoveClient || (shownClientOf(id) ?? '') === to) return;
    setMoved((m) => ({ ...m, [id]: to }));
    onMoveClient(id, to || null);
  };

  if (groups.length === 0) return <p className="font-mono-main text-[11px] text-ink/40 py-10 text-center">No projects here.</p>;
  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragging(projects.find((p) => p.id === e.active.id) ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="flex gap-4 overflow-x-auto pb-3 items-start">
        {columns.map((group) => (
          <ClientColumn key={group.key} id={`client:${group.key}`}>
            {/* A guest sees no clients, so their one group needs no heading. */}
            {!(columns.length === 1 && group.key === '' && !onNew) && (
              <div className="flex items-center justify-between px-1 pb-1">
                <Chip tone={group.key ? 'ink' : 'neutral'}>{group.label}</Chip>
                <span className="font-mono-main text-[10px] text-ink/35 tabular-nums">{group.projects.length}</span>
              </div>
            )}
            {group.projects.map((project) => (
              <ProjectCard key={project.id} project={project} tasks={tasksOf(project.id)} draggable={!!onMoveClient} onOpen={() => onOpen(project.id)} />
            ))}
            {onNew && <Button tone="ghost" size="sm" onClick={() => onNew(group.key || null)} className="justify-start !px-2"><Plus size={12} /> New project</Button>}
          </ClientColumn>
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging && <ProjectCard project={dragging} tasks={tasksOf(dragging.id)} draggable={false} overlay onOpen={() => {}} />}
      </DragOverlay>
    </DndContext>
  );
};

/** The projects as rows, grouped by status, each with its progress. */
export const ProjectTable: React.FC<ViewProps> = ({ projects, tasksOf, clientOf, onOpen }) => {
  const groups = groupProjects(projects, 'status', clientOf);
  if (groups.length === 0) return <p className="font-mono-main text-[11px] text-ink/40 py-10 text-center">No projects here.</p>;
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.key}>
          <div className="flex items-center gap-3 mb-2.5">
            <ProjectStatusChip status={group.projects[0].status} />
            <span className="font-mono-main text-[10px] text-ink/35 tabular-nums">{group.projects.length}</span>
          </div>
          <div className="card !p-0 overflow-hidden">
            <div className="hidden md:grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_88px_80px_minmax(0,150px)_44px] gap-4 px-5 py-3 border-b border-ink/10 font-mono-main text-[9px] uppercase tracking-[0.2em] text-ink/35">
              <span>Project</span><span>Client</span><span>Lead</span><span>Date</span><span>Priority</span><span>Progress</span><span className="text-right">Open</span>
            </div>
            {group.projects.map((project) => {
              const tasks = tasksOf(project.id);
              return (
                <div key={project.id} onClick={() => onOpen(project.id)}
                  className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_88px_80px_minmax(0,150px)_44px] items-center gap-x-4 gap-y-2 px-5 py-3.5 border-b border-ink/6 last:border-b-0 cursor-pointer hover:bg-ink/4 transition-colors">
                  <span dir="auto" className="font-sans-main text-[13px] font-bold leading-relaxed truncate text-left">{project.name}</span>
                  <span dir="auto" className="hidden md:block font-mono-main text-[10px] leading-relaxed text-ink/50 truncate text-left">{clientOf(project.id) ?? '—'}</span>
                  <span dir="auto" className="hidden md:block font-mono-main text-[10px] leading-relaxed text-ink/50 truncate text-left">{project.lead ?? '—'}</span>
                  <span className="hidden md:block font-mono-main text-[10px] uppercase tracking-wider text-ink/50">{shortDate(project.date) || '—'}</span>
                  <span className="hidden md:block"><PriorityChip priority={project.priority} /></span>
                  <ProgressBar value={progressOf(tasks)} showValue />
                  <span className="hidden md:block text-right font-mono-main text-[10px] text-ink/50 tabular-nums">{countTasks(tasks).open}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const PX_PER_DAY = 3;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 30;
const NAMES_WIDTH = 176;

/**
 * The projects on a time line: a bar from when each started to its last task (and to today while it is being worked on).
 * The names are a fixed column on the left, each in line with its bar, so a name never wanders in the chart whatever
 * language it is in.
 */
export const ProjectTimeline: React.FC<ViewProps> = ({ projects, tasksOf, onOpen }) => {
  const today = dayKey(new Date());
  const rows = useMemo(() => projects
    .map((project) => ({ project, span: projectSpan(project, tasksOf(project.id), today), progress: progressOf(tasksOf(project.id)) }))
    .sort((a, b) => (a.span.from < b.span.from ? -1 : a.span.from > b.span.from ? 1 : 0)),
  [projects, tasksOf, today]);

  if (rows.length === 0) return <p className="font-mono-main text-[11px] text-ink/40 py-10 text-center">No projects here.</p>;

  const from = addDays(rows[0].span.from, -14);
  const to = addDays(rows.reduce((max, r) => (r.span.to > max ? r.span.to : max), today), 60);
  const width = (daysBetween(from, to) + 1) * PX_PER_DAY;
  const x = (day: string) => daysBetween(from, day) * PX_PER_DAY;
  const months = monthStarts(from, to);
  const height = HEADER_HEIGHT + rows.length * ROW_HEIGHT + 12;

  return (
    <div className="card !p-0 overflow-x-auto">
      <div className="flex" style={{ width: NAMES_WIDTH + width, height }}>
        <div className="sticky left-0 z-20 shrink-0 bg-paper-dark border-r border-ink/10" style={{ width: NAMES_WIDTH }}>
          {rows.map(({ project }, i) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onOpen(project.id)}
              dir="auto"
              style={{ position: 'absolute', top: HEADER_HEIGHT + i * ROW_HEIGHT, height: ROW_HEIGHT, width: NAMES_WIDTH }}
              className="px-4 text-left font-sans-main text-[12px] font-semibold leading-relaxed truncate hover:underline"
            >{project.name}</button>
          ))}
        </div>
        <div className="relative shrink-0" style={{ width }}>
          {months.map((m) => (
            <div key={m.key} className="absolute top-0 bottom-0 border-l border-ink/8" style={{ left: Math.max(0, m.offset * PX_PER_DAY) }}>
              <span className="absolute top-2 left-2 font-mono-main text-[9px] uppercase tracking-widest text-ink/35 whitespace-nowrap">{m.label}</span>
            </div>
          ))}
          <div className="absolute top-0 bottom-0 w-px bg-rust/70 z-10" style={{ left: x(today) }}>
            <span className="absolute top-2 left-1.5 font-mono-main text-[9px] uppercase tracking-widest text-rust">Today</span>
          </div>
          {rows.map(({ project, span, progress }, i) => (
            <div key={project.id} onClick={() => onOpen(project.id)} data-tip={project.name} className="absolute cursor-pointer" style={{ top: HEADER_HEIGHT + i * ROW_HEIGHT + (ROW_HEIGHT - 24) / 2, left: x(span.from) }}>
              <div className={`relative h-6 rounded-full overflow-hidden ${isWorkedOn(project) ? 'bg-sepia/25' : 'bg-ink/12'}`} style={{ width: Math.max(PX_PER_DAY * 4, (daysBetween(span.from, span.to) + 1) * PX_PER_DAY) }}>
                <div className="absolute inset-y-0 left-0 bg-sepia/60" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
