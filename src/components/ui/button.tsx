// src/components/ui/button.tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none h-9 px-4 py-2",
  {
    variants: {
      variant: {
        default:
          "bg-[#1e1e1e] text-white hover:bg-gray-900/10 hover:text-white",
        navbar: "text-[#3563E9]",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
        outline: "border bg-[#44ADFF]  hover:opacity-90",
        explore: "border bg-[#44ADFF]/10  hover:opacity-90",
        ghost: "hover:bg-gray-50 dark:hover:bg-gray-50/10",
        link: "underline underline-offset-4",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 rounded-md px-3",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
