'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle, X, Cake, ArrowRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const buttonVariants = cva('button', {
  variants: {
    variant: {
      primary: 'button-primary',
      secondary: 'button-secondary',
      ghost: 'button-ghost',
      danger: 'button-danger',
    },
    size: { default: '', sm: 'button-sm', icon: 'button-icon' },
  },
  defaultVariants: { variant: 'primary', size: 'default' },
});
export function Button({
  className,
  variant,
  size,
  asChild,
  loading,
  children,
  disabled,
  ...props
}: ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <LoaderCircle size={17} className="spin button-spinner" aria-hidden />
          <span className="button-loading-content">{children}</span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
}
export function Input(props: ComponentProps<'input'>) {
  return <input {...props} className={cn('input', props.className)} />;
}
export function Select(props: ComponentProps<'select'>) {
  return <select {...props} className={cn('input select', props.className)} />;
}
export function Textarea(props: ComponentProps<'textarea'>) {
  return (
    <textarea {...props} className={cn('input textarea', props.className)} />
  );
}
export function Field({
  label,
  id,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('field', className)}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
export function Badge({
  children,
  tone = 'neutral',
  className,
  style,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'primary' | 'warm' | 'success' | 'danger';
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={cn('badge', `badge-${tone}`, className)} style={style}>
      {children}
    </span>
  );
}
export function Avatar({
  name,
  src,
  size = 'default',
}: {
  name: string;
  src?: string | null;
  size?: 'small' | 'default' | 'large';
}) {
  return (
    <span className={cn('avatar', `avatar-${size}`)}>
      {src ? (
        <Image
          src={src}
          alt=""
          width={82}
          height={82}
          unoptimized
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
      <span>{name.trim().slice(0, 1).toUpperCase()}</span>
    </span>
  );
}
export function EmptyState({
  title,
  description,
  href,
  action,
  onAction,
  icon,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon ?? <Cake size={30} />}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {href && action ? (
        <Button asChild>
          <Link href={href}>
            {action}
            <ArrowRight size={16} />
          </Link>
        </Button>
      ) : action && onAction ? (
        <Button onClick={onAction}>{action}</Button>
      ) : null}
    </div>
  );
}
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn('panel', className)}>{children}</section>;
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="modal-overlay" />
        <DialogPrimitive.Content className="modal-content">
          <DialogPrimitive.Title className="modal-title">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="modal-description">
              {description}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">
              {title}
            </DialogPrimitive.Description>
          )}
          <DialogPrimitive.Close
            className="modal-close button button-ghost button-icon"
            aria-label="关闭"
          >
            <X size={20} />
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  pending,
  confirmLabel = '确认删除',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  pending?: boolean;
  confirmLabel?: string;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="modal-overlay" />
        <AlertDialog.Content className="modal-content modal-small">
          <AlertDialog.Title className="modal-title">{title}</AlertDialog.Title>
          <AlertDialog.Description className="modal-description">
            {description}
          </AlertDialog.Description>
          <div className="form-actions">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={pending}>
                取消
              </Button>
            </AlertDialog.Cancel>
            <Button variant="danger" loading={pending} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}
export function FormMessage({ message }: { message: string }) {
  return message ? (
    <div className="form-message" role="alert">
      {message}
    </div>
  ) : null;
}
