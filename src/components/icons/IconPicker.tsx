import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '../../lib/utils';
import { getIconComponent, ICON_NAMES, isIconName } from './iconRegistry';
import './iconPicker.css';

export interface IconPickerProps {
  value: string;
  onChange: (name: string) => void;
  color?: string;
  label?: string;
}

const GRID_COLUMNS = 6;

export default function IconPicker({ value, onChange, color = 'currentColor', label = 'Icon' }: IconPickerProps) {
  const [query, setQuery] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const filteredIcons = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return ICON_NAMES;
    return ICON_NAMES.filter(name => name.toLowerCase().includes(normalized));
  }, [query]);

  const selectedName = isIconName(value) ? value : 'Activity';
  const PreviewIcon = getIconComponent(selectedName);

  const focusOption = useCallback((name: string) => {
    optionRefs.current.get(name)?.focus();
  }, []);

  const handleGridKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!filteredIcons.length) return;

      const currentIndex = filteredIcons.indexOf(
        filteredIcons.includes(selectedName as (typeof ICON_NAMES)[number])
          ? (selectedName as (typeof ICON_NAMES)[number])
          : filteredIcons[0],
      );
      const focusedElement = document.activeElement as HTMLButtonElement | null;
      const focusedName = focusedElement?.dataset.iconName;
      const focusedIndex = focusedName
        ? filteredIcons.indexOf(focusedName as (typeof ICON_NAMES)[number])
        : currentIndex;

      let nextIndex = focusedIndex >= 0 ? focusedIndex : currentIndex;

      switch (event.key) {
        case 'ArrowRight':
          nextIndex = Math.min(filteredIcons.length - 1, nextIndex + 1);
          break;
        case 'ArrowLeft':
          nextIndex = Math.max(0, nextIndex - 1);
          break;
        case 'ArrowDown':
          nextIndex = Math.min(filteredIcons.length - 1, nextIndex + GRID_COLUMNS);
          break;
        case 'ArrowUp':
          nextIndex = Math.max(0, nextIndex - GRID_COLUMNS);
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = filteredIcons.length - 1;
          break;
        case 'Enter':
        case ' ':
          if (focusedName && isIconName(focusedName)) {
            event.preventDefault();
            onChange(focusedName);
          }
          return;
        default:
          return;
      }

      event.preventDefault();
      focusOption(filteredIcons[nextIndex]);
    },
    [filteredIcons, focusOption, onChange, selectedName],
  );

  useEffect(() => {
    if (!filteredIcons.includes(selectedName as (typeof ICON_NAMES)[number]) && filteredIcons.length) {
      focusOption(filteredIcons[0]);
    }
  }, [filteredIcons, focusOption, selectedName]);

  return (
    <div className="icon-picker">
      <span className="icon-picker__label" id="icon-picker-label">
        {label}
      </span>

      <div className="icon-picker__preview" aria-live="polite">
        <div className="icon-picker__preview-icon" style={color ? { color } : undefined}>
          <PreviewIcon size={22} aria-hidden />
        </div>
        <span className="icon-picker__preview-name">{selectedName}</span>
      </div>

      <input
        type="search"
        className="icon-picker__search"
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Search icons…"
        aria-label={`Search ${label.toLowerCase()} icons`}
        autoComplete="off"
      />

      <div
        ref={gridRef}
        className="icon-picker__grid"
        role="radiogroup"
        aria-labelledby="icon-picker-label"
        onKeyDown={handleGridKeyDown}
      >
        {filteredIcons.length === 0 ? (
          <p className="icon-picker__empty">No icons match &ldquo;{query}&rdquo;</p>
        ) : (
          filteredIcons.map(name => {
            const Icon = getIconComponent(name);
            const isSelected = name === selectedName;
            return (
              <button
                key={name}
                type="button"
                ref={node => {
                  if (node) optionRefs.current.set(name, node);
                  else optionRefs.current.delete(name);
                }}
                role="radio"
                aria-checked={isSelected}
                aria-label={name}
                data-icon-name={name}
                tabIndex={isSelected ? 0 : -1}
                className={cn('icon-picker__option', isSelected && 'icon-picker__option--selected')}
                onClick={() => onChange(name)}
                onFocus={() => {
                  filteredIcons.forEach(iconName => {
                    const button = optionRefs.current.get(iconName);
                    if (button) button.tabIndex = iconName === name ? 0 : -1;
                  });
                }}
              >
                <Icon size={18} color={isSelected && color ? color : undefined} aria-hidden />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
