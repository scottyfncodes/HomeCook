import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

export function Btn({
  children,
  onClick,
  variant = 'default',
  wide,
  small,
  disabled,
  className = '',
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  wide?: boolean;
  small?: boolean;
  disabled?: boolean;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  return (
    <button
      {...rest}
      type="button"
      disabled={disabled}
      className={['btn', `btn--${variant}`, wide ? 'btn--wide' : '', small ? 'btn--sm' : '', className]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button type="button" className={`card card--tap ${className}`} onClick={onClick}>
        {children}
      </button>
    );
  }
  return <div className={`card ${className}`}>{children}</div>;
}

export function Chip({
  children,
  active,
  tone = 'neutral',
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  tone?: 'neutral' | 'good' | 'bad';
  onClick?: () => void;
}) {
  const className = ['chip', active ? 'chip--on' : '', `chip--${tone}`].filter(Boolean).join(' ');
  if (!onClick) return <span className={className}>{children}</span>;
  return (
    <button type="button" className={className} onClick={onClick} aria-pressed={active}>
      {children}
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  suffix,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label?: string;
  suffix?: string;
}) {
  return (
    <div className="stepper">
      {label && <span className="stepper__label">{label}</span>}
      <div className="stepper__controls">
        <button
          type="button"
          className="stepper__btn"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label ?? 'value'}`}
        >
          −
        </button>
        <span className="stepper__value">
          {value}
          {suffix ? <small>{suffix}</small> : null}
        </span>
        <button
          type="button"
          className="stepper__btn"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Increase ${label ?? 'value'}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function Meter({ fraction, over }: { fraction: number; over?: boolean }) {
  return (
    <div className="meter" role="presentation">
      <div
        className={`meter__fill ${over ? 'meter__fill--over' : ''}`}
        style={{ width: `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%` }}
      />
    </div>
  );
}

export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Stop the page behind the sheet from scrolling with it on iOS.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.scrollTo(0, 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="sheet__scrim" aria-label="Close" onClick={onClose} />
      <div className="sheet__panel">
        <header className="sheet__head">
          <h2>{title}</h2>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="sheet__body" ref={panel}>
          {children}
        </div>
        {footer ? <footer className="sheet__foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="row">
      <span className="row__label">{label}</span>
      <span className="row__value">{value}</span>
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {aside}
    </div>
  );
}
