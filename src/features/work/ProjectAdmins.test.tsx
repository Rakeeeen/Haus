// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Invitation } from '@/domain/access';
import { normalizeProject } from '@/domain/work/sharing';
import { ProjectModal } from '@/features/work/components/ProjectModal';
import { TaskModal } from '@/features/work/components/TaskModal';

vi.mock('@/data/useWork', () => ({ useComments: () => ({ comments: [], add: vi.fn(), remove: vi.fn() }) }));

const guests: Invitation[] = [
  { email: 'sara@x.co', active: true, name: 'Sara', uid: 'g1', photoUrl: undefined },
  { email: 'omar@x.co', active: true, name: 'Omar', uid: 'g2' },
];
const owner = { name: 'Hamed', photoUrl: null };

describe('choosing a project\'s admins', () => {
  it('offers the admin list only once someone is on the project, and saves who they are with their names', async () => {
    const onSave = vi.fn(async () => {});
    render(<ProjectModal editing={{ kind: 'edit', project: normalizeProject({ id: 'p', name: 'Brand' }), client: null }} clients={[]} guests={guests} owner={owner}
      onClose={() => {}} onSave={onSave} onDelete={async () => {}} />);
    expect(screen.queryByRole('button', { name: 'Admins of this project' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Guests on this project' }));
    await userEvent.click(await screen.findByRole('option', { name: /Sara/ }));
    await userEvent.click(screen.getByRole('option', { name: /Omar/ }));
    await userEvent.keyboard('{Escape}');

    await userEvent.click(await screen.findByRole('button', { name: 'Admins of this project' }));
    await userEvent.click(await screen.findByRole('option', { name: /Omar/ }));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const draft = (onSave.mock.calls[0] as unknown as [unknown, { adminUids: string[]; memberUids: string[]; memberProfiles: Record<string, { name: string }> }])[1];
    expect(draft.memberUids).toEqual(['g1', 'g2']);
    expect(draft.adminUids).toEqual(['g2']);
    expect(draft.memberProfiles).toMatchObject({ owner: { name: 'Hamed' }, g1: { name: 'Sara' }, g2: { name: 'Omar' } });
  });

  it('shows an admin only the project\'s own fields', () => {
    render(<ProjectModal editing={{ kind: 'edit', project: normalizeProject({ id: 'p', name: 'Brand' }), client: null }} clients={[]} guests={[]} owner={owner} limited
      onClose={() => {}} onSave={async () => {}} onDelete={async () => {}} />);
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.queryByText('Client')).toBeNull();
    expect(screen.queryByText('Lead')).toBeNull();
    expect(screen.queryByText('Guests on this project')).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
  });
});

describe('giving a task to someone as a project admin', () => {
  const project = normalizeProject({ id: 'p', name: 'Brand', memberUids: ['g1', 'g2'] });
  const people = [{ key: 'owner', name: 'Hamed' }, { key: 'g1', name: 'Sara' }, { key: 'g2', name: 'Omar' }];
  const draftTask = { kind: 'new' as const, defaults: { projectId: 'p', projectIds: ['p'] } };

  it('shows the "For" field for the members when the guest runs the project', async () => {
    render(<TaskModal editing={draftTask} projects={[project]} author="Sara" guestUid="g1" canEdit canDelete={false}
      assigneesFor={(id) => (id === 'p' ? people : [])} onClose={() => {}} onCreate={async () => {}} onUpdate={async () => {}} onDelete={async () => {}} />);
    expect(await screen.findByRole('button', { name: 'For' })).toBeTruthy();
  });

  it('hides it where the guest does not run the project', async () => {
    render(<TaskModal editing={draftTask} projects={[project]} author="Sara" guestUid="g1" canEdit canDelete={false}
      assigneesFor={() => []} onClose={() => {}} onCreate={async () => {}} onUpdate={async () => {}} onDelete={async () => {}} />);
    await screen.findByText('Title');
    expect(screen.queryByRole('button', { name: 'For' })).toBeNull();
  });
});
