import React from 'react';
import { countTasks, groupProjects, progressOf } from '@/domain/work/projects';
import { AutoHeight } from '@/ui/AutoHeight';
import { ProgressBar } from '@/ui/ProgressBar';
import { PriorityChip, ProjectStatusChip, shortDate } from '@/features/work/components/chips';
import type { ProjectViewProps } from '@/features/work/components/projectViewTypes';

/** The projects as rows, grouped by status, each with its progress. */
export const ProjectTable: React.FC<ProjectViewProps> = ({ projects, tasksOf, clientOf, onOpen }) => {
  const groups = groupProjects(projects, 'status', clientOf);
  if (groups.length === 0) return <p className="font-mono-main text-[13px] text-ink/40 py-10 text-center">No projects here.</p>;
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.key}>
          <div className="flex items-center gap-3 mb-2.5">
            <ProjectStatusChip status={group.projects[0].status} />
            <span className="font-mono-main text-[12px] text-ink/35 tabular-nums">{group.projects.length}</span>
          </div>
          <AutoHeight>
          <div className="card !p-0 overflow-hidden">
            <div className="hidden md:grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_88px_80px_minmax(0,150px)_44px] gap-4 px-5 py-3 border-b border-ink/10 font-mono-main text-[11px] uppercase tracking-[0.2em] text-ink/35">
              <span>Project</span><span>Client</span><span>Lead</span><span>Date</span><span>Priority</span><span>Progress</span><span className="text-right">Open</span>
            </div>
            {group.projects.map((project) => {
              const tasks = tasksOf(project.id);
              return (
                <div key={project.id} onClick={() => onOpen(project.id)}
                  className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_88px_80px_minmax(0,150px)_44px] items-center gap-x-4 gap-y-2 px-5 py-3.5 border-b border-ink/6 last:border-b-0 cursor-pointer hover:bg-ink/4 transition-colors">
                  <span dir="auto" className="font-sans-main text-[15px] font-bold leading-relaxed truncate text-left">{project.name}</span>
                  <span dir="auto" className="hidden md:block font-mono-main text-[12px] leading-relaxed text-ink/50 truncate text-left">{clientOf(project.id) ?? '—'}</span>
                  <span dir="auto" className="hidden md:block font-mono-main text-[12px] leading-relaxed text-ink/50 truncate text-left">{project.lead ?? '—'}</span>
                  <span className="hidden md:block font-mono-main text-[12px] uppercase tracking-wider text-ink/50">{shortDate(project.date) || '—'}</span>
                  <span className="hidden md:block"><PriorityChip priority={project.priority} /></span>
                  <ProgressBar value={progressOf(tasks)} showValue />
                  <span className="hidden md:block text-right font-mono-main text-[12px] text-ink/50 tabular-nums">{countTasks(tasks).open}</span>
                </div>
              );
            })}
          </div>
          </AutoHeight>
        </div>
      ))}
    </div>
  );
};
