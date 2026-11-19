// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TasksCardBody } from '@/features/home/components/TasksCard';
import { blankTask } from '@/domain/work/tasks';
import type { Task } from '@/domain/work/types';

const task = (title: string): Task => ({ ...blankTask(1, '2026-11-10'), id: title, title });
const body = (over: Partial<React.ComponentProps<typeof TasksCardBody>>) => render(
  <TasksCardBody today={[]} oldTask={null} ready cheer="All of it, finished." projectName={() => null} peopleOf={() => []} onFinish={vi.fn()} {...over} />,
);

describe('TasksCardBody', () => {
  it("lists today's tasks, and nothing else, while there are some", () => {
    body({ today: [task('Write report')], oldTask: task('Old thing') });
    expect(screen.getByText('Write report')).toBeTruthy();
    expect(screen.queryByText('Old thing')).toBeNull();
    expect(screen.queryByText('All of it, finished.')).toBeNull();
  });

  it('with today clear, shows the oldest waiting task under an "old task" label', () => {
    body({ oldTask: task('Old thing') });
    expect(screen.getByText(/old task/i)).toBeTruthy();
    expect(screen.getByText('Old thing')).toBeTruthy();
    expect(screen.queryByText('All of it, finished.')).toBeNull();
  });

  it('with nothing left anywhere, says the encouraging line', () => {
    body({});
    expect(screen.getByText('All of it, finished.')).toBeTruthy();
  });

  it("says nothing until the tasks have loaded — an empty list then isn't 'done' yet", () => {
    body({ ready: false });
    expect(screen.queryByText('All of it, finished.')).toBeNull();
  });
});
