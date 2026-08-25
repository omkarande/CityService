import Icon from './Icon';

interface PlaceRowProps {
  name: string;
  context: string;
  icon?: string;
  trailing?: React.ReactNode;
  onClick: () => void;
}

/** Autocomplete row — same shape as LocalityRow, but a button (opens the map). */
export default function PlaceRow({
  name,
  context,
  icon = 'location_on',
  trailing,
  onClick,
}: PlaceRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className="flex w-full cursor-pointer items-center gap-md rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 text-left transition-colors hover:border-primary-container/40 hover:bg-surface-container-low active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
        <Icon name={icon} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-lg font-semibold text-on-surface">{name}</span>
        {context && (
          <span className="block truncate text-body-md text-on-surface-variant">{context}</span>
        )}
      </span>
      {trailing ?? <Icon name="chevron_right" className="shrink-0 text-outline" size={20} />}
    </div>
  );
}
