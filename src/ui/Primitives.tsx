import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };
export function Card({ children, className = '', ...props }: CardProps) {
  return <div className={`ui-card ${className}`.trim()} {...props}>{children}</div>;
}

type Tone = 'success' | 'warning' | 'danger' | 'neutral';
type StatusPillProps = HTMLAttributes<HTMLSpanElement> & { tone: Tone; children: ReactNode };
export function StatusPill({ tone, children, className = '', ...props }: StatusPillProps) {
  return <span className={`ui-status-pill ${className}`.trim()} data-tone={tone} {...props}>{children}</span>;
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & {
  label: string;
  children: ReactNode;
};
export function IconButton({ label, children, className = '', type = 'button', ...props }: IconButtonProps) {
  return <button type={type} className={`ui-icon-button ${className}`.trim()} aria-label={label} {...props}>{children}</button>;
}

type ToggleProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onChange' | 'aria-label'> & {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};
export function Toggle({ label, checked, onChange, className = '', type = 'button', ...props }: ToggleProps) {
  return <button type={type} role="switch" aria-label={label} aria-checked={checked} data-checked={checked} className={`ui-toggle ${className}`.trim()} onClick={() => onChange(!checked)} {...props}><span className="ui-toggle-thumb" /></button>;
}
