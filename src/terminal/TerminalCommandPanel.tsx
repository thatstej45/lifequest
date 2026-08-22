import { ReactNode, useEffect, useRef } from 'react';

interface TerminalCommandPanelProps {
  command: string;
  onCancel: () => void;
  children: ReactNode;
}

export default function TerminalCommandPanel({
  command,
  onCancel,
  children,
}: TerminalCommandPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  // Capture during render, before an autoFocus field takes focus on commit.
  const openerRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCancelRef.current();
    };

    document.addEventListener('keydown', handleKeyDown);
    // Align the panel header so the sticky tab bar never hides it.
    panelRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.requestAnimationFrame(() => openerRef.current?.focus());
    };
  }, []);

  return (
    <section
      ref={panelRef}
      className="term-command-panel"
      role="region"
      aria-label={command}
    >
      <header className="term-command-panel-head">
        <span><b>$</b> {command}</span>
        <button type="button" className="term-token is-danger" onClick={onCancel}>[cancel]</button>
      </header>
      <div className="term-command-panel-body">{children}</div>
    </section>
  );
}
