import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WeatherExpandable from "./WeatherExpandable";
import { resolveWeatherEmoji, type WeatherExpandableForecastDay } from "./types";

afterEach(() => {
    cleanup();
});

const FORECAST: WeatherExpandableForecastDay[] = [
    {
        date: `2026-04-10`,
        temp_min: 10,
        temp_max: 22,
        condition: `dry`,
        icon: `clear-day`
    },
    {
        date: `2026-04-11`,
        temp_min: 8,
        temp_max: 19,
        condition: `dry`,
        icon: `partly-cloudy-day`,
        precipitation_probability: 30
    },
    {
        date: `2026-04-12`,
        temp_min: 6,
        temp_max: 14,
        condition: `rain`,
        icon: `rain`,
        precipitation_probability: 80
    }
];

describe(`WeatherExpandable`, () => {
    it(`renders the header with placeholder when no data is provided`, () => {
        render(<WeatherExpandable />);
        expect(screen.getByTestId(`weather-expandable`)).toBeInTheDocument();
        expect(screen.getByTestId(`weather-expandable-temperature`).textContent).toBe(
            `—`
        );
        // No metric chips when no data is set.
        expect(screen.queryByTestId(`weather-expandable-precipitation`)).toBeNull();
        expect(screen.queryByTestId(`weather-expandable-wind`)).toBeNull();
    });

    it(`renders the temperature rounded to an integer with the °C unit`, () => {
        render(<WeatherExpandable data={{ temperature: 16.4 }} />);
        expect(screen.getByTestId(`weather-expandable-temperature`).textContent).toBe(
            `16°C`
        );
    });

    it(`renders the matching emoji for the icon key`, () => {
        render(<WeatherExpandable data={{ temperature: 8, icon: `rain` }} />);
        expect(screen.getByTestId(`weather-expandable-emoji`).textContent).toBe(`🌧️`);
    });

    it(`falls back to the thermometer emoji for unknown icon keys`, () => {
        render(<WeatherExpandable data={{ temperature: 8, icon: `mystery` }} />);
        expect(screen.getByTestId(`weather-expandable-emoji`).textContent).toBe(`🌡️`);
    });

    it(`translates the condition key into German by default`, () => {
        render(<WeatherExpandable data={{ temperature: 8, condition: `rain` }} />);
        expect(screen.getByText(`Regen`)).toBeInTheDocument();
    });

    it(`overrides condition labels via the strings prop`, () => {
        render(
            <WeatherExpandable
                data={{ temperature: 8, condition: `rain` }}
                strings={{ conditionRain: `Niederschlag` }}
            />
        );
        expect(screen.getByText(`Niederschlag`)).toBeInTheDocument();
    });

    it(`prefers precipitation_60 over precipitation for the header chip`, () => {
        render(
            <WeatherExpandable
                data={{ temperature: 16, precipitation_60: 1.4, precipitation: 5 }}
            />
        );
        expect(screen.getByTestId(`weather-expandable-precipitation`).textContent).toContain(
            `1.4mm`
        );
    });

    it(`falls back to precipitation when precipitation_60 is missing`, () => {
        render(
            <WeatherExpandable data={{ temperature: 16, precipitation: 2.3 }} />
        );
        expect(screen.getByTestId(`weather-expandable-precipitation`).textContent).toContain(
            `2.3mm`
        );
    });

    it(`omits the precipitation chip when value is zero (header is for "now it's raining")`, () => {
        render(
            <WeatherExpandable data={{ temperature: 16, precipitation_60: 0 }} />
        );
        expect(screen.queryByTestId(`weather-expandable-precipitation`)).toBeNull();
    });

    it(`prefers wind_speed_60 over wind_speed for the header chip`, () => {
        render(
            <WeatherExpandable
                data={{ temperature: 16, wind_speed_60: 12, wind_speed: 20 }}
            />
        );
        expect(screen.getByTestId(`weather-expandable-wind`).textContent).toContain(
            `12km/h`
        );
    });

    it(`is collapsed by default (extras + forecast are not in the DOM)`, () => {
        render(
            <WeatherExpandable
                data={{ temperature: 16, cloud_cover: 30, relative_humidity: 60 }}
                forecast={FORECAST}
            />
        );
        // Radix unmounts collapsed content.
        expect(screen.queryByTestId(`weather-expandable-extras`)).toBeNull();
        expect(screen.queryByTestId(`weather-expandable-forecast`)).toBeNull();
    });

    it(`expands on click and renders the extras row when extras are set`, async () => {
        const user = userEvent.setup();
        render(
            <WeatherExpandable
                data={{
                    temperature: 16,
                    cloud_cover: 30,
                    relative_humidity: 60,
                    visibility: 5000,
                    pressure_msl: 1013
                }}
            />
        );
        await user.click(screen.getByTestId(`weather-expandable-trigger`));
        const extras = screen.getByTestId(`weather-expandable-extras`);
        expect(extras).toBeInTheDocument();
        expect(screen.getByTestId(`weather-expandable-cloud-cover`).textContent).toContain(
            `30%`
        );
        expect(screen.getByTestId(`weather-expandable-humidity`).textContent).toContain(
            `60%`
        );
        // visibility in metres → kilometres in the body.
        expect(screen.getByTestId(`weather-expandable-visibility`).textContent).toContain(
            `5.0km`
        );
        expect(screen.getByTestId(`weather-expandable-pressure`).textContent).toContain(
            `1013hPa`
        );
    });

    it(`omits the extras row when no extras are set`, async () => {
        const user = userEvent.setup();
        render(
            <WeatherExpandable
                data={{ temperature: 16 }}
                forecast={FORECAST}
            />
        );
        await user.click(screen.getByTestId(`weather-expandable-trigger`));
        expect(screen.queryByTestId(`weather-expandable-extras`)).toBeNull();
        // Forecast still renders.
        expect(screen.getByTestId(`weather-expandable-forecast`)).toBeInTheDocument();
    });

    it(`renders one forecast column per day with weekday + emoji + min/max`, async () => {
        const user = userEvent.setup();
        render(
            <WeatherExpandable
                data={{ temperature: 16 }}
                forecast={FORECAST}
                locale={`de-DE`}
            />
        );
        await user.click(screen.getByTestId(`weather-expandable-trigger`));
        const days = screen.getAllByTestId(`weather-expandable-forecast-day`);
        expect(days.length).toBe(FORECAST.length);
        // 2026-04-10 is a Friday → "Fr" in de-DE short weekday.
        expect(
            screen.getAllByTestId(`weather-expandable-forecast-day-label`)[0].textContent
        ).toMatch(/Fr/);
        // First row should show 10°/22°.
        expect(
            screen.getAllByTestId(`weather-expandable-forecast-day-temps`)[0].textContent
        ).toBe(`10°/22°`);
    });

    it(`renders the rain-probability chip only when probability is positive`, async () => {
        const user = userEvent.setup();
        render(
            <WeatherExpandable
                data={{ temperature: 16 }}
                forecast={FORECAST}
            />
        );
        await user.click(screen.getByTestId(`weather-expandable-trigger`));
        // FORECAST[0] has no probability — chip absent.
        // FORECAST[1] has 30 — chip present with "30%".
        // FORECAST[2] has 80 — chip present with "80%".
        const rainChips = screen.getAllByTestId(`weather-expandable-forecast-day-rain`);
        expect(rainChips.length).toBe(2);
        expect(rainChips[0].textContent).toContain(`30%`);
        expect(rainChips[1].textContent).toContain(`80%`);
    });

    it(`renders the attribution inside the forecast section when both are present`, async () => {
        const user = userEvent.setup();
        render(
            <WeatherExpandable
                data={{ temperature: 16 }}
                forecast={FORECAST}
                attribution={`Demo data`}
            />
        );
        await user.click(screen.getByTestId(`weather-expandable-trigger`));
        const attrib = screen.getByTestId(`weather-expandable-attribution`);
        expect(attrib.textContent).toBe(`Demo data`);
    });

    it(`still renders the attribution when no forecast is provided (extras row only)`, async () => {
        const user = userEvent.setup();
        render(
            <WeatherExpandable
                data={{ temperature: 16, cloud_cover: 30 }}
                attribution={`Demo data`}
            />
        );
        await user.click(screen.getByTestId(`weather-expandable-trigger`));
        expect(screen.getByTestId(`weather-expandable-attribution`).textContent).toBe(
            `Demo data`
        );
    });

    it(`fires onOpenChange when the disclosure toggles`, async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        render(
            <WeatherExpandable
                data={{ temperature: 16 }}
                forecast={FORECAST}
                onOpenChange={onOpenChange}
            />
        );
        await user.click(screen.getByTestId(`weather-expandable-trigger`));
        expect(onOpenChange).toHaveBeenLastCalledWith(true);
        await user.click(screen.getByTestId(`weather-expandable-trigger`));
        expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });

    it(`is fully controllable via open + onOpenChange`, async () => {
        const user = userEvent.setup();
        const Controlled = () => {
            const [open, setOpen] = useState(false);
            return (
                <>
                    <WeatherExpandable
                        data={{ temperature: 16 }}
                        forecast={FORECAST}
                        open={open}
                        onOpenChange={setOpen}
                    />
                    <span data-testid={`o`}>{String(open)}</span>
                </>
            );
        };
        render(<Controlled />);
        expect(screen.getByTestId(`o`)).toHaveTextContent(`false`);
        await user.click(screen.getByTestId(`weather-expandable-trigger`));
        expect(screen.getByTestId(`o`)).toHaveTextContent(`true`);
    });

    it(`defaultOpen renders the body on first paint`, () => {
        render(
            <WeatherExpandable
                data={{ temperature: 16, cloud_cover: 50 }}
                forecast={FORECAST}
                defaultOpen
            />
        );
        expect(screen.getByTestId(`weather-expandable-extras`)).toBeInTheDocument();
        expect(screen.getByTestId(`weather-expandable-forecast`)).toBeInTheDocument();
    });

    it(`disclosure button advertises the right aria-label per state`, async () => {
        const user = userEvent.setup();
        render(
            <WeatherExpandable
                data={{ temperature: 16 }}
                forecast={FORECAST}
                strings={{
                    expandLabel: `Show forecast`,
                    collapseLabel: `Hide forecast`
                }}
            />
        );
        const trigger = screen.getByTestId(`weather-expandable-trigger`);
        expect(trigger).toHaveAttribute(`aria-label`, `Show forecast`);
        await user.click(trigger);
        expect(trigger).toHaveAttribute(`aria-label`, `Hide forecast`);
    });

    it(`disables the disclosure when there is no body content (no extras / no forecast / no attribution)`, async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        render(
            <WeatherExpandable
                data={{ temperature: 16, wind_speed_60: 8 }}
                onOpenChange={onOpenChange}
            />
        );
        const trigger = screen.getByTestId(`weather-expandable-trigger`);
        expect(trigger).toBeDisabled();
        await user.click(trigger);
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it(`hides the chevron when the disclosure is disabled (header-only mode)`, () => {
        const { container } = render(
            <WeatherExpandable data={{ temperature: 16, wind_speed_60: 8 }} />
        );
        // Header has Thermometer + Wind, but no chevron.
        // Count svg elements: emoji (text), Thermometer, Wind — 2 SVGs only.
        expect(container.querySelectorAll(`svg`).length).toBe(2);
    });

    it(`enables the disclosure when only attribution is set (still something to reveal)`, async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        render(
            <WeatherExpandable
                data={{ temperature: 16 }}
                attribution={`Demo data`}
                onOpenChange={onOpenChange}
            />
        );
        const trigger = screen.getByTestId(`weather-expandable-trigger`);
        expect(trigger).not.toBeDisabled();
        await user.click(trigger);
        expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it(`extras chips carry the translated tooltip labels`, async () => {
        const user = userEvent.setup();
        render(
            <WeatherExpandable
                data={{ temperature: 16, cloud_cover: 30, relative_humidity: 60 }}
                strings={{
                    cloudCoverLabel: `Cloud cover`,
                    humidityLabel: `Humidity`
                }}
            />
        );
        await user.click(screen.getByTestId(`weather-expandable-trigger`));
        expect(screen.getByTestId(`weather-expandable-cloud-cover`)).toHaveAttribute(
            `title`,
            `Cloud cover`
        );
        expect(screen.getByTestId(`weather-expandable-humidity`)).toHaveAttribute(
            `title`,
            `Humidity`
        );
    });

    it(`region carries the translated aria-label`, () => {
        render(
            <WeatherExpandable
                data={{ temperature: 5 }}
                strings={{ title: `Wetter (Test)` }}
            />
        );
        expect(screen.getByRole(`region`, { name: `Wetter (Test)` })).toBeInTheDocument();
    });

    it(`renders a monochrome lucide icon when glyphStyle="icon"`, () => {
        render(
            <WeatherExpandable
                data={{ temperature: 16, condition: `dry`, icon: `clear-day` }}
                glyphStyle={`icon`}
            />
        );
        const slot = screen.getByTestId(`weather-expandable-emoji`);
        // The slot still announces which mode rendered it…
        expect(slot.getAttribute(`data-glyph-style`)).toBe(`icon`);
        // …and the inner glyph is now an svg, not a Unicode codepoint.
        const svg = slot.querySelector(`svg`);
        expect(svg).not.toBeNull();
        expect(svg!.classList.contains(`lucide-sun`)).toBe(true);
        // Sanity: the emoji codepoint must NOT be present in icon mode.
        expect(slot.textContent ?? ``).not.toContain(`☀️`);
    });

    it(`keeps emoji rendering when glyphStyle is omitted (default)`, () => {
        render(
            <WeatherExpandable
                data={{ temperature: 16, condition: `dry`, icon: `clear-day` }}
            />
        );
        const slot = screen.getByTestId(`weather-expandable-emoji`);
        expect(slot.getAttribute(`data-glyph-style`)).toBe(`emoji`);
        expect(slot.textContent).toContain(`☀️`);
        expect(slot.querySelector(`svg`)).toBeNull();
    });

    it(`renders Fahrenheit when temperatureUnit="fahrenheit"`, () => {
        render(
            <WeatherExpandable
                data={{ temperature: 0, condition: `dry`, icon: `clear-day` }}
                temperatureUnit={`fahrenheit`}
            />
        );
        // 0 °C → 32 °F
        expect(screen.getByTestId(`weather-expandable-temperature`).textContent).toBe(`32°F`);
    });

    it(`renders Kelvin when temperatureUnit="kelvin"`, () => {
        render(
            <WeatherExpandable
                data={{ temperature: 0, condition: `dry`, icon: `clear-day` }}
                temperatureUnit={`kelvin`}
            />
        );
        // 0 °C → 273.15 K, rounded to 273 with " K" suffix.
        expect(screen.getByTestId(`weather-expandable-temperature`).textContent).toBe(`273 K`);
    });

    it(`converts forecast min/max into the selected unit`, async () => {
        const user = userEvent.setup();
        render(
            <WeatherExpandable
                data={{ temperature: 0, condition: `dry`, icon: `clear-day` }}
                forecast={[
                    { date: `2026-04-10`, temp_min: 0, temp_max: 100, condition: `dry`, icon: `clear-day` }
                ]}
                temperatureUnit={`fahrenheit`}
            />
        );
        await user.click(screen.getByRole(`button`));
        const temps = screen.getByTestId(`weather-expandable-forecast-day-temps`);
        // 0 °C → 32 °F, 100 °C → 212 °F. No trailing unit on forecast cells.
        expect(temps.textContent).toBe(`32°/212°`);
    });

    it(`resolveWeatherEmoji exposes the full vocabulary mapping (port parity)`, () => {
        expect(resolveWeatherEmoji(`clear-day`)).toBe(`☀️`);
        expect(resolveWeatherEmoji(`clear-night`)).toBe(`🌙`);
        expect(resolveWeatherEmoji(`partly-cloudy-day`)).toBe(`⛅`);
        expect(resolveWeatherEmoji(`partly-cloudy-night`)).toBe(`☁️`);
        expect(resolveWeatherEmoji(`cloudy`)).toBe(`☁️`);
        expect(resolveWeatherEmoji(`fog`)).toBe(`🌫️`);
        expect(resolveWeatherEmoji(`wind`)).toBe(`💨`);
        expect(resolveWeatherEmoji(`rain`)).toBe(`🌧️`);
        expect(resolveWeatherEmoji(`sleet`)).toBe(`🌨️`);
        expect(resolveWeatherEmoji(`snow`)).toBe(`❄️`);
        expect(resolveWeatherEmoji(`hail`)).toBe(`🌨️`);
        expect(resolveWeatherEmoji(`thunderstorm`)).toBe(`⛈️`);
        expect(resolveWeatherEmoji(`unknown`)).toBe(`🌡️`);
        expect(resolveWeatherEmoji(null)).toBe(`🌡️`);
        expect(resolveWeatherEmoji(undefined)).toBe(`🌡️`);
    });
});
