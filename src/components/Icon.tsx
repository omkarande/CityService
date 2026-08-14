interface IconProps {
  /** Material Symbols ligature name, e.g. 'search'. */
  name: string;
  className?: string;
  /** Render the filled variant. */
  fill?: boolean;
  size?: number;
}

export default function Icon({ name, className = '', fill = false, size }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${fill ? 'fill' : ''} ${className}`}
      style={size ? { fontSize: `${size}px` } : undefined}
    >
      {name}
    </span>
  );
}
