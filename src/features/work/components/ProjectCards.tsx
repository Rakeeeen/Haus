import React, { useEffect, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { progressOf } from '@/domain/work/projects';
import type { Project, ProjectStatus, Task } from '@/domain/work/types';
import { AutoHeight } from '@/ui/AutoHeight';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { IconPlus as Plus } from '@/ui/icons';
import { ProgressBar } from '@/ui/ProgressBar';
import { useWheelToSide } from '@/ui/useWheelToSide';
import { PriorityChip, ProjectStatusChip } from '@/features/work/components/chips';
import type { ProjectViewProps } from '@/features/work/components/projectViewTypes';

const ProjectCard: React.FC<{ project: Project; tasks: readonly Task[]; client?: string | null; draggable: boolean; onOpen: () => void; overlay?: boolean }> = ({ project, tasks, client = null, draggable, onOpen, overlay = false }) => {
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
      <p dir="auto" className="font-sans-main text-[16px] font-bold leading-relaxed mb-2.5 text-left break-words">{project.name}</p>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* The status is the heading of the block the card is in, so it is not repeated here. */}
        <PriorityChip priority={project.priority} />
        {client && <Chip tone="ink"><span dir="auto" className="truncate max-w-[140px]">{client}</span></Chip>}
      </div>
      <ProgressBar value={progressOf(tasks)} showValue />
    </div>
  );
};

const ClientColumn: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={`w-[270px] shrink-0 rounded-card p-3 flex flex-col gap-2.5 min-h-[120px] transition-colors ${isOver ? 'bg-ink/8' : 'bg-ink/4'}`}>{children}</div>;
};

/** The blocks under the client cards, in the order a project moves through them. */
const BLOCKS: ReadonlyArray<ProjectStatus> = ['active', 'maintenance', 'paused', 'done'];

/**
 * The projects as cards, in two parts. On top, a card for each client holding the projects still being planned (a card
 * stays even with none, so a project can be dragged into it). Below, a block for each stage a project is in — in
 * progress, maintenance, on hold, done. Dragging a project onto a client's card changes whose project it is; it
 * moves at once, before the change is saved. A guest sees no clients, so their planning projects get a block too.
 */
export const ProjectCards: React.FC<ProjectViewProps & {
  clients?: readonly string[];
  onNew?: (client: string | null) => void;
  onMoveClient?: (projectId: string, client: string | null) => void;
}> = ({ projects, tasksOf, clientOf, onOpen, clients = [], onNew, onMoveClient }) => {
  const clientsRowRef = useWheelToSide();
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
  const shownClientOf = (id: string): string | null => (id in moved ? moved[id] || null : clientOf(id));
  const withClients = !!onMoveClient || !!onNew;

  const planning = projects.filter((p) => p.status === 'planning');
  const columnKeys = [...new Set([...clients, ...planning.map((p) => shownClientOf(p.id) ?? ''), ''])].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
  const blocks: ReadonlyArray<ProjectStatus> = withClients ? BLOCKS : ['planning', ...BLOCKS];

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const id = String(e.active.id);
    const to = e.over ? String(e.over.id).replace(/^client:/, '') : null;
    if (to === null || !onMoveClient || (shownClientOf(id) ?? '') === to) return;
    setMoved((m) => ({ ...m, [id]: to }));
    onMoveClient(id, to || null);
  };

  if (projects.length === 0 && !withClients) return <p className="font-mono-main text-[13px] text-ink/40 py-10 text-center">No projects here.</p>;
  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragging(projects.find((p) => p.id === e.active.id) ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="flex flex-col gap-8">
        {withClients && (
          <div ref={clientsRowRef} className="flex gap-4 overflow-x-auto pb-3 items-start">
            {columnKeys.map((key) => {
              const mine = planning.filter((p) => (shownClientOf(p.id) ?? '') === key);
              return (
                <ClientColumn key={key} id={`client:${key}`}>
                  <div className="flex items-center justify-between px-1 pb-1">
                    <Chip tone={key ? 'ink' : 'neutral'}><span dir="auto" className="truncate max-w-[170px]">{key || 'No client'}</span></Chip>
                    <span className="font-mono-main text-[13px] text-ink/40 tabular-nums">{mine.length}</span>
                  </div>
                  <AutoHeight>
                    <div className="flex flex-col gap-2.5">
                      {mine.map((project) => (
                        <ProjectCard key={project.id} project={project} tasks={tasksOf(project.id)} draggable={!!onMoveClient} onOpen={() => onOpen(project.id)} />
                      ))}
                      {onNew && <Button tone="ghost" size="sm" onClick={() => onNew(key || null)} className="justify-start !px-2"><Plus size={12} /> New project</Button>}
                    </div>
                  </AutoHeight>
                </ClientColumn>
              );
            })}
          </div>
        )}

        {blocks.map((status) => {
          const list = projects.filter((p) => p.status === status);
          if (list.length === 0) return null;
          return (
            <section key={status}>
              <div className="flex items-center gap-3 mb-3">
                <ProjectStatusChip status={status} />
                <span className="font-mono-main text-[13px] text-ink/40 tabular-nums">{list.length}</span>
              </div>
              <AutoHeight>
                <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
                  {list.map((project) => (
                    <ProjectCard key={project.id} project={project} tasks={tasksOf(project.id)} client={withClients ? shownClientOf(project.id) : null} draggable={!!onMoveClient} onOpen={() => onOpen(project.id)} />
                  ))}
                </div>
              </AutoHeight>
            </section>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging && <ProjectCard project={dragging} tasks={tasksOf(dragging.id)} draggable={false} overlay onOpen={() => {}} />}
      </DragOverlay>
    </DndContext>
  );
};

