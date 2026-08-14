import Icon from './Icon';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search a locality or pincode…',
  autoFocus = false,
}: SearchBarProps) {
  return (
    <div className="flex h-11 items-center rounded-full border border-outline-variant bg-surface-container-lowest pl-1 pr-1.5 shadow-soft transition-all duration-300 focus-within:border-primary-container focus-within:shadow-ambient">
      <span className="flex items-center justify-center pl-2.5 pr-2 text-primary">
        <Icon name="search" size={19} />
      </span>

      <input
        type="search"
        inputMode="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Search a locality or pincode"
        className="h-full flex-1 border-none bg-transparent text-body-md text-on-surface outline-none placeholder:text-on-surface-variant focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
      />

      {value && (
        <button
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container active:scale-90"
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
