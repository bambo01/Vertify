import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors",
          "placeholder:text-muted-foreground",
          // remove focus highlight
          "outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:bg-[#1e1e1e] dark:border-gray-600 dark:text-white",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
