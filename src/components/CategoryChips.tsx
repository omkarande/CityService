import type { Category, CategoryId } from '../api/types';
import Icon from './Icon';

interface CategoryChipsProps {
  categories: Category[];
  /** Categories that actually appear in the current results. */
  available: Set<CategoryId>;
  selected: CategoryId | 'all';
  onSelect: (id: CategoryId | 'all') => void;
}

export default function CategoryChips({ categories, available, selected, onSelect }: CategoryChipsProps) {
  const shown = categories.filter((c) => available.has(c.id));

  return (
    <div className="hide-scrollbar -mx-margin-mobile flex gap-2 overflow-x-auto px-margin-mobile pb-1">
      <Chip label="All" icon="apps" active={selected === 'all'} onClick={() => onSelect('all')} />
      {shown.map((category) => (
        <Chip
          key={category.id}
          label={category.label}
          icon={category.icon}
          active={selected === category.id}
          onClick={() => onSelect(category.id)}
        />
      ))}
    </div>
  );
}

function Chip({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-label-bold transition-colors active:scale-95',
        active
          ? 'border-primary bg-primary text-on-primary'
          : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container',
      ].join(' ')}
    >
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}
