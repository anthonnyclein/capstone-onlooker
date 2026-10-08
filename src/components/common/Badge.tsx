import React from 'react';
import { SubmissionStatus } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
}) => {
  const variantStyles = {
    primary: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs font-medium px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};

export const SubmissionStatusBadge: React.FC<{ status: SubmissionStatus; isLate?: boolean }> = ({
  status,
  isLate,
}) => {
  if (status === 'returned') {
    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        <Badge variant="success">Returned</Badge>
        {isLate && <Badge variant="warning">Submitted Late</Badge>}
      </div>
    );
  }

  if (status === 'graded_awaiting_return') {
    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        <Badge variant="info">Graded</Badge>
        {isLate && <Badge variant="warning">Submitted Late</Badge>}
      </div>
    );
  }

  if (status === 'submitted') {
    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        <Badge variant="primary">Submitted</Badge>
        {isLate && <Badge variant="warning">Submitted Late</Badge>}
      </div>
    );
  }

  return <Badge variant="neutral">Not Submitted</Badge>;
};
