import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap px-3 py-1 h-auto text-sm font-normal ring-offset-background transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-color-border-full focus-visible:ring-offset-2 active:ring-4 active:ring-surface-raised disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "border border-color-border-full bg-surface text-text-color hover:bg-surface-hover hover:text-text-color disabled:border-color-border disabled:text-text-color-disabled uppercase",
        secondary:
          "bg-action-bg text-text-color-inverse hover:bg-action-bg-hover active:bg-action-bg-active disabled:bg-text-color-disabled uppercase",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

function Button({
  className,
  variant = "primary",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      className={cn(buttonVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
