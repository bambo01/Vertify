// src/components/ui/card.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** If true, makes the card fully fluid on small screens (no overflow), adds min-w-0 */
  fluid?: boolean;
  /** If true, constrains max width nicely on sm+ and centers the card */
  constrain?: boolean;
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, fluid, constrain, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // base
        "rounded-xl border bg-white text-black shadow dark:bg-[#1e1e1e] dark:border-gray-800",
        // prevent flex children from forcing overflow
        fluid && "w-full max-w-full min-w-0 overflow-x-hidden",
        // comfy centered width caps for larger screens (opt-in)
        constrain &&
          "mx-auto sm:max-w-[640px] md:max-w-[720px] lg:max-w-[820px]",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export const CardHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  // responsive padding
  <div
    className={cn("flex flex-col space-y-1.5 p-4 sm:p-6", className)}
    {...props}
  />
);

export const CardTitle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  // responsive title sizing
  <h3
    className={cn(
      "text-base sm:text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
);

export const CardDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-xs sm:text-sm text-gray-500", className)} {...props} />
);

export const CardContent = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  // responsive padding; keep pt-0 semantics
  <div className={cn("p-4 sm:p-6 pt-0", className)} {...props} />
);

export const CardFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex items-center p-4 sm:p-6 pt-0", className)}
    {...props}
  />
);
