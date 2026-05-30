import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import WeatherChip from "./WeatherChip";

afterEach(() => {
    cleanup();
});

describe(`WeatherChip`, () => {
    it(`renders the default placeholder when no data is provided`, () => {
        render(<WeatherChip />);
        expect(screen.getByTestId(`weather-chip`)).toBeInTheDocument();
        // Placeholder for missing temperature.
        expect(screen.getByTestId(`weather-chip-temperature`).textContent).toBe(`—`);
        // Default mode is "current" → footer reads "Now".
        expect(screen.getByTestId(`weather-chip-time`).textContent).toBe(`Now`);
        // No metrics row and no error.
        expect(screen.queryByTestId(`weather-chip-metrics`)).toBeNull();
        expect(screen.queryByTestId(`weather-chip-error`)).toBeNull();
    });

    it(`renders the temperature rounded to an integer with the °C unit`, () => {
        render(<WeatherChip data={{ temperature: 16.4 }} />);
        expect(screen.getByTestId(`weather-chip-temperature`).textContent).toBe(`16°C`);
    });

    it(`translates the condition key into the matching label`, () => {
        render(
            <WeatherChip
                data={{ temperature: 8, condition: `rain`, icon: `rain` }}
                strings={{ conditionRain: `Niederschlag` }}
            />
        );
        expect(screen.getByText(`Niederschlag`)).toBeInTheDocument();
    });

    it(`pretty-prints the timestamp in historical mode with the supplied locale`, () => {
        render(
            <WeatherChip
                data={{ temperature: 5 }}
                mode={`historical`}
                at={new Date(`2026-04-08T13:00:00Z`)}
                locale={`en-US`}
            />
        );
        // Default historical prefix + separator are present.
        expect(screen.getByTestId(`weather-chip-time`).textContent).toContain(`History · `);
    });

    it(`pretty-prints the timestamp in forecast mode with the supplied locale`, () => {
        render(
            <WeatherChip
                data={{ temperature: 12 }}
                mode={`forecast`}
                at={new Date(`2026-04-10T09:00:00Z`)}
                locale={`en-US`}
            />
        );
        expect(screen.getByTestId(`weather-chip-time`).textContent).toContain(`Forecast · `);
    });

    it(`falls back to the current-mode label when no timestamp is supplied`, () => {
        render(<WeatherChip mode={`historical`} />);
        // No `at` → default to the "Now" label even when mode says historical.
        expect(screen.getByTestId(`weather-chip-time`).textContent).toBe(`Now`);
    });

    it(`renders metrics only when their values are numbers`, () => {
        render(
            <WeatherChip
                data={{ temperature: 10, precipitation: 0.5, windSpeed: 12.3 }}
            />
        );
        const metrics = screen.getByTestId(`weather-chip-metrics`);
        expect(metrics.textContent).toContain(`0.5 mm`);
        // Wind is rounded to integer.
        expect(metrics.textContent).toContain(`12 km/h`);
        // Humidity wasn't supplied → no humidity readout.
        expect(metrics.textContent).not.toContain(`%`);
    });

    it(`shows a loading indicator with the localised aria-label when loading={true}`, () => {
        render(<WeatherChip loading strings={{ loadingLabel: `Wird geladen` }} />);
        const status = screen.getByRole(`status`);
        expect(status).toHaveAttribute(`aria-label`, `Wird geladen`);
        expect(screen.getByTestId(`weather-chip`)).toHaveAttribute(`data-state`, `loading`);
    });

    it(`surfaces the error string with role="alert" when error is set`, () => {
        render(<WeatherChip error={`Bright Sky timed out`} />);
        const alert = screen.getByRole(`alert`);
        expect(alert.textContent).toBe(`Bright Sky timed out`);
        expect(screen.getByTestId(`weather-chip`)).toHaveAttribute(`data-state`, `error`);
    });

    it(`renders the supplied attribution node beneath the chip`, () => {
        render(<WeatherChip attribution={`© DWD`} />);
        expect(screen.getByText(`© DWD`)).toBeInTheDocument();
    });

    it(`uses the consumer's formatTimeLabel override`, () => {
        render(
            <WeatherChip
                mode={`forecast`}
                at={new Date(`2026-04-10T09:00:00Z`)}
                formatTimeLabel={({ date, mode }) =>
                    `${mode}@${date?.toISOString() ?? `now`}`
                }
            />
        );
        expect(screen.getByTestId(`weather-chip-time`).textContent).toBe(
            `forecast@2026-04-10T09:00:00.000Z`
        );
    });

    it(`uses the consumer's formatTemperature override`, () => {
        render(
            <WeatherChip
                data={{ temperature: 16.4 }}
                formatTemperature={(temp) =>
                    typeof temp === `number`
                        ? `${(((temp * 9) / 5 + 32) * 100 | 0) / 100}°F`
                        : `?`
                }
            />
        );
        expect(screen.getByTestId(`weather-chip-temperature`).textContent).toBe(`61.52°F`);
    });

    it(`accepts a timestamp passed as a number (ms epoch) or string`, () => {
        const { rerender } = render(
            <WeatherChip
                mode={`historical`}
                at={Date.UTC(2026, 3, 8, 13, 0, 0)}
                locale={`en-US`}
            />
        );
        expect(screen.getByTestId(`weather-chip-time`).textContent).toContain(`History · `);

        rerender(
            <WeatherChip
                mode={`historical`}
                at={`2026-04-08T13:00:00Z`}
                locale={`en-US`}
            />
        );
        expect(screen.getByTestId(`weather-chip-time`).textContent).toContain(`History · `);
    });

    it(`exposes data-mode on the root for downstream styling`, () => {
        const { rerender } = render(<WeatherChip mode={`current`} />);
        expect(screen.getByTestId(`weather-chip`)).toHaveAttribute(`data-mode`, `current`);
        rerender(<WeatherChip mode={`forecast`} at={new Date()} />);
        expect(screen.getByTestId(`weather-chip`)).toHaveAttribute(`data-mode`, `forecast`);
    });
});
