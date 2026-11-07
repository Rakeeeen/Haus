import React from 'react';
import { IconButton } from '@/ui/Button';
import { IconPencil as Pencil, IconTrash2 as Trash2 } from '@/ui/icons';

/** The small round edit / delete pair; only the bin warms to rust on hover. */
const EditButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <IconButton tone="ghost" size="sm" onClick={onClick} aria-label="Edit"><Pencil size={13} /></IconButton>
);
export const DeleteButton: React.FC<{ onClick: () => void; tip?: string }> = ({ onClick, tip }) => (
  <IconButton tone="ghost" size="sm" onClick={onClick} aria-label="Delete" data-tip={tip} className="hover:!text-rust"><Trash2 size={13} /></IconButton>
);

/** Edit / delete floating at the right edge of a card row (the row must be `group relative`). */
export const RowActions: React.FC<{ onEdit?: () => void; onRemove: () => void }> = ({ onEdit, onRemove }) => (
  <div className="absolute inset-y-0 right-4 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
    {onEdit && <EditButton onClick={onEdit} />}
    <DeleteButton onClick={onRemove} />
  </div>
);

/** One card holding a list: rows sit edge to edge, separated by a hairline. */
export const ListCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="card overflow-hidden !p-0">{children}</div>
);

/** A row of a ListCard: content on the left, a trailing slot (amount, actions) on the right. */
export const ListRow: React.FC<{ first?: boolean; children: React.ReactNode }> = ({ first = false, children }) => (
  <div className={`group flex items-center gap-6 px-8 py-6 ${first ? '' : 'border-t border-ink/12'}`}>
    {children}
  </div>
);

/** Edit / delete at the end of a ListRow — shown on hover. */
export const InlineActions: React.FC<{ onEdit: () => void; onRemove: () => void }> = ({ onEdit, onRemove }) => (
  <div className="flex items-center gap-1 w-[60px] justify-end opacity-0 group-hover:opacity-100 transition-opacity">
    <EditButton onClick={onEdit} />
    <DeleteButton onClick={onRemove} />
  </div>
);

export const EmptyState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="card text-center">
    <p className="font-mono-main text-xs text-ink/25">{children}</p>
  </div>
);
