import React from 'react';
import { IconChevronDown as ChevronDown } from '@/ui/icons';

/** The form pieces the work screens share: a labelled field, a text input, a text area and a select. */
const base = 'w-full font-mono-main outline-none transition-colors bg-ink/5 border border-ink/12 focus:border-ink text-ink rounded-box';

export const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <label className={`block ${className}`}>
    <span className="font-sans-main uppercase tracking-widest block mb-2 text-[10px] font-semibold text-ink/40">{label}</span>
    {children}
  </label>
);

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input {...props} className={`${base} px-4 py-3 text-[14px] ${className}`} />
);

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className = '', ...props }) => (
  <textarea {...props} className={`${base} px-4 py-3 text-[14px] leading-relaxed resize-y min-h-[120px] ${className}`} />
);

export const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', children, ...props }) => (
  <div className="relative">
    <select {...props} className={`${base} px-4 py-3 pr-10 text-[14px] ${className}`}>{children}</select>
    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/40 pointer-events-none" />
  </div>
);
