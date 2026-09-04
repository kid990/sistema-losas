import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ReactNode;
  error?: string;
  hint?: string;
}

export function Input({ label, icon, error, hint, className = "", id, "aria-describedby": describedBy, "aria-invalid": ariaInvalid, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  const ariaDescribedBy = [describedBy, messageId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`mb-3 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-muted)] pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          aria-describedby={ariaDescribedBy}
          aria-invalid={error ? true : ariaInvalid}
          className={`
            w-full min-h-11 px-4 py-2.5
            bg-[var(--bg-input)] 
            border border-[var(--border-color)] 
            text-[var(--text-primary)] placeholder-[var(--text-muted)]
            rounded-xl text-sm
            transition-all duration-200
            focus:outline-none focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-500)]/10
            ${error ? "border-red-400 focus:border-red-500 focus:ring-red-500/10" : ""}
            ${icon ? "pl-10" : ""}
          `}
          {...props}
        />
      </div>
      {error && <p id={messageId} role="alert" className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-500 shrink-0" />{error}</p>}
      {hint && !error && <p id={messageId} className="text-[var(--text-muted)] text-xs mt-1">{hint}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string | number; label: string }[];
  placeholder?: string;
  error?: string;
  hint?: string;
}

export function Select({ label, options, placeholder, error, hint, className = "", id, "aria-describedby": describedBy, "aria-invalid": ariaInvalid, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const messageId = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;
  const ariaDescribedBy = [describedBy, messageId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`mb-3 ${className}`}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
          {label}
        </label>
      )}
      <select
        id={selectId}
        aria-describedby={ariaDescribedBy}
        aria-invalid={error ? true : ariaInvalid}
        className={`
          w-full min-h-11 px-4 py-2.5
          bg-[var(--bg-input)]
          border border-[var(--border-color)]
          text-[var(--text-primary)]
          rounded-xl text-sm
          transition-all duration-200
          focus:outline-none focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-500)]/10
          ${error ? "border-red-400 focus:border-red-500 focus:ring-red-500/10" : ""}
          appearance-none
          bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]
          bg-[length:16px] bg-[right_12px_center] bg-no-repeat
          pr-10
        `}
        {...props}
      >
        {placeholder && <option value="" className="text-[var(--text-muted)]">{placeholder}</option>}
        {options.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
      {error && <p id={messageId} role="alert" className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-500 shrink-0" />{error}</p>}
      {hint && !error && <p id={messageId} className="text-[var(--text-muted)] text-xs mt-1">{hint}</p>}
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "danger" | "secondary" | "success" | "ghost";
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({ variant = "primary", children, className = "", size = "md", loading, disabled, ...props }: ButtonProps) {
  const variants = {
    primary:
      "bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-primary-600)] text-white shadow-md shadow-[var(--color-primary-500)]/20 hover:shadow-lg hover:shadow-[var(--color-primary-500)]/30 hover:from-[var(--color-primary-600)] hover:to-[var(--color-primary-700)]",
    danger:
      "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/30 hover:from-red-600 hover:to-red-700",
    secondary:
      "bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[var(--border-light)] hover:border-[var(--text-muted)]",
    success:
      "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 hover:from-emerald-600 hover:to-emerald-700",
    ghost:
      "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]",
  };

  const sizes = {
    sm: "min-h-11 px-3 py-1.5 text-xs",
    md: "min-h-11 px-4 py-2.5 text-sm",
    lg: "min-h-11 px-6 py-3 text-base",
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 rounded-xl font-medium
        transition-all duration-200 active:scale-[0.97]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] focus-visible:ring-offset-2
        motion-reduce:transition-none motion-reduce:active:scale-100
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <svg aria-hidden="true" className="animate-spin motion-reduce:animate-none h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

export function Spinner({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = { sm: "h-5 w-5 border-2", md: "h-8 w-8 border-[3px]", lg: "h-12 w-12 border-4" };
  return (
    <div role="status" aria-label="Cargando" className={`flex justify-center items-center py-8 ${className}`}>
      <div
        aria-hidden="true"
        className={`
          ${sizes[size]}
          rounded-full
          border-[var(--border-color)]
          border-t-[var(--color-primary-500)]
          animate-spin motion-reduce:animate-none
        `}
      />
      <span className="sr-only">Cargando</span>
    </div>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  const generatedId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeModal = useEffectEvent(onClose);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]',
        ),
      ).filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");

      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!panelRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  const sizes = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
  };

  const dialogId = `${generatedId}-dialog`;
  const titleId = title ? `${generatedId}-title` : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar modal"
        className="fixed inset-0 bg-black/40 backdrop-blur-sm modal-overlay motion-reduce:animate-none motion-reduce:transition-none"
        onClick={onClose}
      />
      <div
        id={dialogId}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={title ? undefined : "Modal"}
        tabIndex={-1}
        className={`
          relative z-10 w-full ${sizes[size]}
          bg-[var(--bg-card)]
          rounded-2xl
          shadow-[var(--shadow-xl)]
          border border-[var(--border-color)]
          modal-content-pop motion-reduce:animate-none motion-reduce:transition-none
          max-h-[90vh] overflow-y-auto
        `}
      >
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-color)]">
          {title && <h3 id={titleId} className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>}
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Cerrar modal"
            type="button"
            className="ml-auto min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] motion-reduce:transition-none"
          >
            <svg aria-hidden="true" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)] mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{title}</h3>
      {description && <p className="text-sm text-[var(--text-secondary)] text-center max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}

interface BadgeProps {
  variant?: "primary" | "success" | "warning" | "danger" | "info" | "neutral";
  children: ReactNode;
  dot?: boolean;
}

export function Badge({ variant = "neutral", children, dot }: BadgeProps) {
  const variants = {
    primary: "bg-[var(--color-primary-50)] text-[var(--color-primary-600)]",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    danger: "bg-red-50 text-red-600",
    info: "bg-indigo-50 text-indigo-600",
    neutral: "bg-gray-100 text-gray-600",
  };

  const dotColors = {
    primary: "bg-[var(--color-primary-500)]",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    info: "bg-indigo-500",
    neutral: "bg-gray-500",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}export { Breadcrumb } from "./Breadcrumb";
