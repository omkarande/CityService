import { useNavigate } from 'react-router-dom';
import Icon from './Icon';

interface TopBarProps {
  title?: string;
  /** Show a back chevron instead of the menu button. */
  back?: boolean;
  /** Label rendered next to the back arrow, e.g. "Back to Nearby Services". */
  backLabel?: string;
  action?: React.ReactNode;
}

export default function TopBar({ title = 'CityService', back = false, backLabel, action }: TopBarProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant/30 bg-surface/85 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-margin-mobile">
        <div className="flex min-w-0 items-center gap-2">
          {back ? (
            <button
              aria-label="Go back"
              onClick={() => navigate(-1)}
              className="-ml-2 flex items-center gap-2 rounded-full p-2 text-primary transition-colors hover:bg-surface-container-highest active:scale-95"
            >
              <Icon name="arrow_back" />
              {backLabel && (
                <span className="truncate text-body-md font-body-md font-semibold text-on-surface">{backLabel}</span>
              )}
            </button>
          ) : (
            <>
              <button
                aria-label="Menu"
                className="-ml-2 rounded-full p-2 text-primary transition-colors hover:bg-surface-container-highest active:scale-95"
              >
                <Icon name="menu" />
              </button>
              <h1 className="text-headline-md font-headline-md font-bold text-primary">{title}</h1>
            </>
          )}
        </div>
        {action}
      </div>
    </header>
  );
}
