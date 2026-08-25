import * as React from "react"
import { View, Button as NativeButton } from "@tarojs/components"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary hover:bg-opacity-90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive hover:bg-opacity-90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary hover:bg-opacity-80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<typeof View>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  disabled?: boolean
  className?: string
  openType?: string
  onGetPhoneNumber?: (e: any) => void
  loading?: boolean
}

const Button = React.forwardRef<React.ElementRef<typeof View>, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      disabled,
      openType,
      onGetPhoneNumber,
      loading,
      ...props
    },
    ref
  ) => {
    const classes = cn(
      buttonVariants({ variant, size, className }),
      disabled && "opacity-50 pointer-events-none"
    )

    // 需要原生小程序能力（如 openType="getPhoneNumber"）时渲染原生 Button
    if (openType) {
      return (
        <NativeButton
          className={classes}
          openType={openType}
          onGetPhoneNumber={onGetPhoneNumber}
          disabled={disabled}
          loading={loading}
          {...(props as any)}
        />
      )
    }

    const tabIndex = (props as { tabIndex?: number }).tabIndex ?? (disabled ? -1 : 0)
    return (
      <View
        className={classes}
        ref={ref}
        {...({ tabIndex } as { tabIndex?: number })}
        hoverClass={
          disabled
            ? undefined
            : "border-ring ring-2 ring-ring ring-offset-2 ring-offset-background"
        }
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
