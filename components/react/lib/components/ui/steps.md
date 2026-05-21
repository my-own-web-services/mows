# Steps

Stepper indicator that shows progress through a sequence of steps.

shadcn/ui does not ship a stepper primitive, so this is a custom primitive
that follows the same conventions (Radix-style composition, semantic Tailwind
tokens, `data-status` attribute for state styling).

## Composition

```tsx
<Steps current={number} orientation="horizontal" | "vertical" mode="progress" | "selection">
    <Step title description? status? />
    ...
</Steps>
```

`<Step>` must be a direct child of `<Steps>` — it reads `orientation`,
`current`, `mode`, and its own `index` from context. Rendering `<Step>`
outside `<Steps>` throws.

## Modes

`mode` controls the semantics of `current`. Default is `"progress"`.

### `progress` (default)

`current` is interpreted as how far the user has advanced. Earlier indices
render `completed` (check icon, primary fill, primary connector), the equal
index renders `current`, later indices are `upcoming`. Use for wizards or
checkout flows.

### `selection`

`current` is interpreted as which step is active. There is no notion of
completion — every step shows its number (no check icons), the active step's
circle is filled with the primary color, and all others are neutral.
Connectors stay muted. Use when the stepper is a step picker, not a progress
bar.

```tsx
<Steps current={selected} mode="selection">
    <Step title="Account" onClick={() => setSelected(0)} />
    <Step title="Profile" onClick={() => setSelected(1)} />
    <Step title="Done" onClick={() => setSelected(2)} />
</Steps>
```

## Status resolution

For each `<Step>`, the status is derived from its index relative to `current`:

| mode          | condition           | status      | visual                                  |
| ------------- | ------------------- | ----------- | --------------------------------------- |
| `progress`    | `index < current`   | `completed` | filled circle, check icon, primary line |
| `progress`    | `index === current` | `current`   | outlined circle, primary border         |
| `progress`    | `index > current`   | `upcoming`  | outlined circle, muted text             |
| `selection`   | `index === current` | `current`   | filled circle with number, primary fill |
| `selection`   | otherwise           | `upcoming`  | outlined circle with number, muted text |

Pass `status` on `<Step>` to override the derived value (e.g. to force an
`error`-like presentation by setting `current` on a step that index-wise is
`upcoming`).

The current step gets `aria-current="step"`; the list gets
`aria-orientation`.

## Orientation

- `horizontal` (default): steps are flex-1 columns; the connector is a
  horizontal line between adjacent indicators, with label below.
- `vertical`: steps stack; the connector is a vertical line under each
  indicator, with label to the right. Add `pb-*` per-step via `className` if
  you need more breathing room between labels.

## Examples

### Horizontal

```tsx
<Steps current={1}>
    <Step title="Account" description="Sign up" />
    <Step title="Profile" description="Tell us about yourself" />
    <Step title="Done" />
</Steps>
```

### Vertical

```tsx
<Steps orientation="vertical" current={2}>
    <Step title="Pick a plan" />
    <Step title="Add payment" />
    <Step title="Confirm" />
</Steps>
```

### Controlled wizard

```tsx
const [step, setStep] = useState(0);
return (
    <>
        <Steps current={step}>
            <Step title="One" />
            <Step title="Two" />
            <Step title="Three" />
        </Steps>
        <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
    </>
);
```

### Per-step status override

```tsx
<Steps current={1}>
    <Step title="Upload" />
    <Step title="Process" status="current" />
    <Step title="Publish" status="upcoming" />
</Steps>
```

## Notes

- `<Steps>` is purely an indicator — it does not render panel/content slots.
  Pair it with your own panel switching (state, router, `<Tabs>` content) for
  a full wizard.
- Indices on `<Step>` are injected by `<Steps>` via `React.cloneElement`. The
  `index` and `isLast` props are reserved — do not pass them manually.
- Demos: `src/examples/steps/StepsDocPage.tsx` — Horizontal / Vertical /
  Selection / Wizard / Icons / RTL / Disabled / StatusOverride examples
  registered via `src/examples/steps/index.ts` and mounted at
  `/Steps` in the docs harness.
