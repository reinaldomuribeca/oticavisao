import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-ink-950 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-gold text-ink-950 shadow-[0_0_0_1px_rgba(245,197,66,0.4)] hover:bg-gold-300 hover:shadow-[0_8px_30px_rgba(245,197,66,0.35)] active:scale-[0.98]",
        secondary:
          "border border-zinc-700 bg-ink-900/60 text-zinc-100 hover:bg-ink-800 hover:border-gold/40",
        ghost: "text-zinc-200 hover:bg-ink-800/70 hover:text-gold",
        outline:
          "border border-gold/40 bg-transparent text-gold hover:bg-gold/10",
        destructive: "bg-red-600 text-white hover:bg-red-500",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-14 px-8 text-base tracking-wide",
        xl: "h-16 px-10 text-lg uppercase tracking-widest",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

/**
 * Slot mínimo: clona o filho único e mescla className/ref/handlers.
 * Substitui o uso de @radix-ui/react-slot para evitar dep extra.
 */
const Slot = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }>(
  ({ children, ...props }, ref) => {
    if (!React.isValidElement(children)) return null;
    const child = children as React.ReactElement<Record<string, unknown>>;
    return React.cloneElement(child, {
      ...props,
      ...child.props,
      ref,
      className: cn(
        (props as { className?: string }).className,
        (child.props as { className?: string }).className,
      ),
    });
  },
);
Slot.displayName = "Slot";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp: React.ElementType = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref as React.Ref<HTMLButtonElement>}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
