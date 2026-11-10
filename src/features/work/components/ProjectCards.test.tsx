// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { normalizeProject } from '@/domain/work/sharing';

// Dragging itself is the library's; what is tested is what a drop does, so the drag context is replaced by one that hands over its handlers.
const drag = vi.hoisted(() => ({ props: null as null | { onDragStart: (e: unknown) => void; onDragEnd: (e: unknown) => void } }));
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, ...props }: { children: React.ReactNode; onDragStart: (e: unknown) => void; onDragEnd: (e: unknown) => void }) => { drag.props = props; return <>{children}</>; },
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PointerSensor: class {}, TouchSensor: class {},
  useSensor: () => ({}), useSensors: () => [],
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, isDragging: false }),
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
}));

import { ProjectCards } from '@/features/work/components/ProjectCards';

const projects = [
  normalizeProject({ id: 'p1', name: 'Planned thing', status: 'planning' }),
  normalizeProject({ id: 'p2', name: 'Running thing', status: 'active' }),
];

const show = (over: Partial<React.ComponentProps<typeof ProjectCards>> = {}) => {
  const onMoveStatus = vi.fn();
  const onMoveClient = vi.fn();
  render(<ProjectCards projects={projects} tasksOf={() => []} clientOf={() => null} onOpen={() => {}} clients={['Acme']} onMoveClient={onMoveClient} onMoveStatus={onMoveStatus} {...over} />);
  return { onMoveStatus, onMoveClient };
};
const drop = (id: string, over: string) => act(() => { drag.props!.onDragEnd({ active: { id }, over: { id: over } }); });

describe('dragging a project between stages', () => {
  it('gives a planning project the status of the stage it is dropped on, and shows it there at once', () => {
    const { onMoveStatus, onMoveClient } = show();
    drop('p1', 'status:active');
    expect(onMoveStatus).toHaveBeenCalledWith('p1', 'active');
    expect(onMoveClient).not.toHaveBeenCalled();
    const inProgress = screen.getByText('In progress').closest('section') as HTMLElement;
    expect(within(inProgress).getByText('Planned thing')).toBeTruthy();
  });

  it('makes a project dropped on a client\'s card a planning project of that client', () => {
    const { onMoveStatus, onMoveClient } = show();
    drop('p2', 'client:Acme');
    expect(onMoveStatus).toHaveBeenCalledWith('p2', 'planning');
    expect(onMoveClient).toHaveBeenCalledWith('p2', 'Acme');
  });

  it('does nothing for a drop on the stage it is already in, or outside everything', () => {
    const { onMoveStatus } = show();
    drop('p2', 'status:active');
    act(() => { drag.props!.onDragEnd({ active: { id: 'p2' }, over: null }); });
    expect(onMoveStatus).not.toHaveBeenCalled();
  });

  it('shows every stage as a place to drop while a project is held', () => {
    show();
    expect(screen.queryByText('Done')).toBeNull();
    act(() => { drag.props!.onDragStart({ active: { id: 'p1' } }); });
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.getAllByText('Drop a project here').length).toBeGreaterThan(0);
  });

  it('changes no status where it is not allowed (no handler)', () => {
    const { onMoveStatus } = show({ onMoveStatus: undefined });
    drop('p1', 'status:active');
    expect(onMoveStatus).not.toHaveBeenCalled();
  });
});
