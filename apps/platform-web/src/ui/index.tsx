// Reusable UI kit. Presentation only — styles live in theme/tokens.css.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Tone = "green" | "gold" | "blue" | "warning" | "danger" | "muted";

export function Button({
  variant = "primary",
  size,
  icon,
  children,
  ...rest
}: {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm";
  icon?: ReactNode;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`btn btn--${variant}${size ? " btn--sm" : ""}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  ...rest
}: { label: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="iconbtn" aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

export function Card({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`card${onClick ? " card--link" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  error,
  rtl,
  multiline,
  ...rest
}: {
  label?: string;
  error?: string;
  rtl?: boolean;
  multiline?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) {
  const cls = `input${error ? " input--error" : ""}${rtl ? " u-rtl" : ""}`;
  return (
    <label className="field">
      {label ? <span className="field__label">{label}</span> : null}
      {multiline ? (
        <textarea
          className={cls}
          rows={4}
          {...(rest as InputHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input className={cls} {...rest} />
      )}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="pill">{children}</span>;
}

export function Chip({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`chip chip--${tone}`}>{children}</span>;
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="between" style={{ marginTop: "var(--s-4)" }}>
      <h2 className="u-title">{title}</h2>
      {action}
    </div>
  );
}

export function Loading() {
  return (
    <div className="center u-muted">
      <Loader2 className="spin" size={22} />
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="center">
      <div className="u-body" style={{ color: "var(--danger)" }}>
        Couldn’t load
      </div>
      <div className="u-small u-soft">{message}</div>
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="center">
      <div className="u-body u-muted">{title}</div>
      {hint ? <div className="u-small u-soft">{hint}</div> : null}
    </div>
  );
}
