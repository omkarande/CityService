import Icon from './Icon';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  trailing?: React.ReactNode;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search a locality or pincode…',
  autoFocus = false,
  className = '',
  trailing,
}: SearchBarProps) {
  return (
    <div
      className={`flex h-12 items-center rounded-full bg-white pl-4 pr-1.5 ring-1 ring-black/10 ${className}`.trim()}
    >
      <span className="flex items-center justify-center pr-2 text-on-surface-variant">
        <Icon name="search" size={20} />
      </span>

      <input
        type="search"
        inputMode="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Search a locality or pincode"
        className="h-full min-w-0 flex-1 border-none bg-transparent text-body-md text-on-surface outline-none placeholder:text-on-surface-variant focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
      />

      {value && (
        <button
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-black/5 active:scale-90"
        >
          <Icon name="close" size={16} />
        </button>
      )}

      {trailing}
    </div>
  );
}
