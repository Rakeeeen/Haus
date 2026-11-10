import React, { useMemo } from 'react';
import { isWorkedOn, monthStarts, progressOf, projectSpan, spreadMonthLabels } from '@/domain/work/projects';
import { addDays, daysBetween, dayKey } from '@/domain/work/tasks';
import { useWheelToSide } from '@/ui/useWheelToSide';
import type { ProjectViewProps } from '@/features/work/components/projectViewTypes';

const PX_PER_DAY = 3;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 30;
/** Room under the rows for the "Today" label, so it never sits on a month label above. */
const FOOTER_HEIGHT = 26;
const NAMES_WIDTH = 176;

/**
 * The projects on a time line: a bar from when each started to its last task (and to today while it is being worked on).
 * The names are a fixed column on the left, each in line with its bar, so a name never wanders in the chart whatever
 * language it is in.
 */
export const ProjectTimeline: React.FC<ProjectViewProps> = ({ projects, tasksOf, onOpen }) => {
  const chartRef = useWheelToSide();
  const today = dayKey(new Date());
  const rows = useMemo(() => projects
    .map((project) => ({ project, span: projectSpan(project, tasksOf(project.id), today), progress: progressOf(tasksOf(project.id)) }))
    .sort((a, b) => (a.span.from < b.span.from ? -1 : a.span.from > b.span.from ? 1 : 0)),
  [projects, tasksOf, today]);

  if (rows.length === 0) return <p className="font-mono-main text-[13px] text-ink/40 py-10 text-center">No projects here.</p>;

  const from = addDays(rows[0].span.from, -14);
  const to = addDays(rows.reduce((max, r) => (r.span.to > max ? r.span.to : max), today), 60);
  const width = (daysBetween(from, to) + 1) * PX_PER_DAY;
  const x = (day: string) => daysBetween(from, day) * PX_PER_DAY;
  // A label is about 60 px wide; leave out the ones that would overprint their neighbour.
  const months = monthStarts(from, to);
  const labelled = new Set(spreadMonthLabels(months, Math.ceil(70 / PX_PER_DAY)).map((m) => m.key));
  const height = HEADER_HEIGHT + rows.length * ROW_HEIGHT + FOOTER_HEIGHT;

  return (
    <div ref={chartRef} className="card !p-0 overflow-x-auto">
      <div className="flex" style={{ width: NAMES_WIDTH + width, height }}>
        <div className="sticky left-0 z-20 shrink-0 bg-paper-dark border-r border-ink/10" style={{ width: NAMES_WIDTH }}>
          {rows.map(({ project }, i) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onOpen(project.id)}
              dir="auto"
              style={{ position: 'absolute', top: HEADER_HEIGHT + i * ROW_HEIGHT, height: ROW_HEIGHT, width: NAMES_WIDTH }}
              className="px-4 text-left font-sans-main text-[14px] font-semibold leading-relaxed truncate hover:underline"
            >{project.name}</button>
          ))}
        </div>
        <div className="relative shrink-0" style={{ width }}>
          {months.map((m) => (
            <div key={m.key} className="absolute top-0 bottom-0 border-l border-ink/8" style={{ left: Math.max(0, m.offset * PX_PER_DAY) }}>
              {labelled.has(m.key) && <span className="absolute top-2 left-2 font-mono-main text-[11px] uppercase tracking-widest text-ink/35 whitespace-nowrap">{m.label}</span>}
            </div>
          ))}
          {/* The today line starts under the month labels, so it never cuts through one. */}
          <div className="absolute bottom-0 w-px bg-rust/70 z-10" style={{ left: x(today), top: HEADER_HEIGHT - 6 }}>
            <span className="absolute bottom-1.5 left-1.5 font-mono-main text-[11px] uppercase tracking-widest text-rust">Today</span>
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
