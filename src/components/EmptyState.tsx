import Icon from './Icon';

interface EmptyStateProps {
  icon: string;
  title: string;
  body: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant px-4 py-8 text-center">
      <Icon name={icon} className="text-outline" size={32} />
      <p className="text-body-lg font-bold text-on-surface">{title}</p>
      <p className="max-w-xs text-body-md text-on-surface-variant">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
