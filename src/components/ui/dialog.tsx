import * as React from "react"
import { View } from "@tarojs/components"
import { X } from "lucide-react-taro"
import { cn } from "@/lib/utils"
import { Portal } from "@/components/ui/portal"
import { useKeyboardOffset } from "@/lib/hooks/use-keyboard-offset"

const DialogContext = React.createContext<{
  open?: boolean
  onOpenChange?: (open: boolean) => void
} | null>(null)

const usePresence = (open: boolean | undefined, durationMs: number) => {
  const [present, setPresent] = React.useState(!!open)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    if (open) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = null
      setPresent(true)
      return
    }

    timeoutRef.current = setTimeout(() => setPresent(false), durationMs)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [open, durationMs])

  return present
}

interface DialogProps {
  children: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  modal?: boolean
}

const Dialog = ({ children, open: openProp, defaultOpen, onOpenChange }: DialogProps) => {
    const [openState, setOpenState] = React.useState(defaultOpen || false)
    const open = openProp !== undefined ? openProp : openState
    
    const handleOpenChange = (newOpen: boolean) => {
        if (openProp === undefined) {
            setOpenState(newOpen)
        }
        onOpenChange?.(newOpen)
    }

    return (
        <DialogContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
            {children}
        </DialogContext.Provider>
    )
}

const DialogTrigger = React.forwardRef<
    React.ElementRef<typeof View>,
    React.ComponentPropsWithoutRef<typeof View> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => {
    const context = React.useContext(DialogContext)
    return (
        <View
          ref={ref}
          className={cn("w-fit", className)}
          onClick={(e) => {
                e.stopPropagation()
                context?.onOpenChange?.(true)
            }}
          {...props}
        >
            {children}
        </View>
    )
})
DialogTrigger.displayName = "DialogTrigger"

const DialogPortal = ({ children }: { children: React.ReactNode }) => {
    const context = React.useContext(DialogContext)
    const present = usePresence(context?.open, 200)
    if (!present) return null
    
    return <Portal>{children}</Portal>
}

const DialogOverlay = React.forwardRef<
    React.ElementRef<typeof View>,
    React.ComponentPropsWithoutRef<typeof View>
>(({ className, onClick, ...props }, ref) => {
    const context = React.useContext(DialogContext)
    const state = context?.open ? "open" : "closed"
    return (
        <View
          ref={ref}
          data-state={state}
          className={cn(
                "fixed inset-0 isolate z-50 bg-black bg-opacity-10 transition-opacity duration-100 supports-[backdrop-filter]:backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                className
            )}
          onClick={(e) => {
                e.stopPropagation()
                onClick?.(e)
                context?.onOpenChange?.(false)
            }}
          {...props}
        />
    )
})
DialogOverlay.displayName = "DialogOverlay"

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof View> {
    closeClassName?: string
}

const DialogContent = React.forwardRef<
    React.ElementRef<typeof View>,
    DialogContentProps
>(({ className, children, style, closeClassName, ...props }, ref) => {
    const context = React.useContext(DialogContext)
    const offset = useKeyboardOffset()
    const state = context?.open ? "open" : "closed"
    const [animating, setAnimating] = React.useState<'open' | 'close' | 'idle'>(
      context?.open ? 'open' : 'idle'
    )

    React.useEffect(() => {
      if (context?.open) {
        setAnimating('idle')
        const raf = requestAnimationFrame(() => {
          requestAnimationFrame(() => setAnimating('open'))
        })
        return () => cancelAnimationFrame(raf)
      }
      setAnimating('close')
    }, [context?.open])
    
    return (
        <DialogPortal>
            <View
              className="fixed inset-0 z-50"
              catchMove
              onClick={() => context?.onOpenChange?.(false)}
            >
              <DialogOverlay />
              <View
                ref={ref}
                data-state={state}
                className={cn(
                      "fixed z-50 grid w-[calc(100%-2rem)] max-w-lg gap-4 border bg-background p-6 shadow-lg rounded-xl",
                      className
                  )}
                style={{
                  ...(style as object),
                  left: '50%',
                  top: offset > 0 ? `calc(50% - ${offset / 2}px)` : '50%',
                  transform: `translate(-50%, -50%) ${animating === 'open' ? 'scale(1)' : 'scale(0.3)'}`,
                  opacity: animating === 'idle' ? 0 : 1,
                  transition: animating === 'open'
                    ? 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms ease-out'
                    : animating === 'close'
                    ? 'transform 200ms ease-in, opacity 200ms ease-in'
                    : 'none',
                }}
                onClick={(e) => e.stopPropagation()}
                {...props}
              >
                  {children}
                  <View 
                    data-slot="dialog-close"
                    className={cn(
                        "absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
                        closeClassName
                    )}
                    data-state={state}
                    onClick={(e) => {
                          e.stopPropagation()
                          context?.onOpenChange?.(false)
                      }}
                  >
                      <X size={16} color="inherit" />
                      <View className="sr-only">Close</View>
                  </View>
              </View>
            </View>
        </DialogPortal>
    )
})
DialogContent.displayName = "DialogContent"

const DialogHeader = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof View>) => (
  <View
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof View>) => (
  <View
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View>
>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View>
>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

const DialogClose = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View>
>(({ className, ...props }, ref) => {
    const context = React.useContext(DialogContext)
    return (
        <View
          ref={ref}
          className={className}
          onClick={(e) => {
                e.stopPropagation()
                context?.onOpenChange?.(false)
            }}
          {...props}
        />
    )
})
DialogClose.displayName = "DialogClose"

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
