import { GripVertical } from "lucide-react"
import * as React from "react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

// Context lets <ResizableHandle> reset the surrounding group to its
// declared `defaultSize` layout on double-click. Group-less handles still
// work — double-click just becomes a no-op.
interface ResizableContextValue {
  resetLayout: () => void
  hasDefaults: boolean
}

const ResizableContext = React.createContext<ResizableContextValue | null>(null)

// Build the layout array that double-click resets to. Panels without a
// `defaultSize` get the remaining size divided evenly between them, so
// callers can declare a default on just the sidebar (the common case) and
// have the content pane snap back too. Returns `null` when the declared
// defaults don't fit in 100%.
export const collectDefaults = (children: React.ReactNode): number[] | null => {
  const sizes: (number | undefined)[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    if (child.type === ResizablePanel) {
      sizes.push((child.props as { defaultSize?: number }).defaultSize)
    }
  })
  if (sizes.length === 0) return null
  const declaredTotal = sizes.reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0
  )
  const missing = sizes.filter((value) => value === undefined).length
  if (missing === 0) return sizes as number[]
  const remaining = 100 - declaredTotal
  if (remaining < 0) return null
  const filler = remaining / missing
  return sizes.map((value) => value ?? filler)
}

const ResizablePanelGroup = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => {
  const groupRef = React.useRef<ResizablePrimitive.ImperativePanelGroupHandle>(null)
  const defaults = React.useMemo(() => collectDefaults(children), [children])
  const hasDefaults = defaults !== null

  const value = React.useMemo<ResizableContextValue>(
    () => ({
      hasDefaults,
      resetLayout: () => {
        if (defaults) groupRef.current?.setLayout(defaults)
      },
    }),
    [defaults, hasDefaults]
  )

  return (
    <ResizableContext.Provider value={value}>
      <ResizablePrimitive.PanelGroup
        ref={groupRef}
        className={cn(
          `flex h-full w-full data-[panel-group-direction=vertical]:flex-col`,
          className
        )}
        {...props}
      >
        {children}
      </ResizablePrimitive.PanelGroup>
    </ResizableContext.Provider>
  )
}

const ResizablePanel = ResizablePrimitive.Panel

const ResizableHandle = ({
  withHandle,
  className,
  onDoubleClick,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean
}) => {
  const ctx = React.useContext(ResizableContext)
  return (
    // The bar itself is `bg-border` so it blends with neighbour borders.
    // The `after:` pseudo expands a few px on each side to give a generous
    // hit area, and `data-resize-handle-state` (`inactive | hover | drag`,
    // surfaced by react-resizable-panels) drives the highlight color so a
    // user can see exactly which divider they're targeting. The same
    // selectors cover the vertical orientation. Double-click resets the
    // enclosing PanelGroup to its declared default layout.
    <ResizablePrimitive.PanelResizeHandle
      onDoubleClick={(event) => {
        ctx?.resetLayout()
        onDoubleClick?.(event)
      }}
      className={cn(
        `relative flex w-px cursor-col-resize items-center justify-center bg-border transition-colors hover:bg-primary after:absolute after:inset-y-0 after:left-1/2 after:w-2 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:cursor-row-resize data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-2 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90`,
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className={`z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border`}>
          <GripVertical className={`h-2.5 w-2.5`} />
        </div>
      )}
    </ResizablePrimitive.PanelResizeHandle>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
