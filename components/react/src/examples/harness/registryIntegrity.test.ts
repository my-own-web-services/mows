import { describe, expect, it } from "vitest";
import { cleanExampleSource } from "./cleanExampleSource";
import { actionDisplayExamples } from "../actionDisplay";
import { audioPlayerExamples } from "../audioPlayer";
import { avatarExamples } from "../avatar";
import { badgeExamples } from "../badge";
import { buttonExamples } from "../button";
import { buttonSelectExamples } from "../buttonSelect";
import { calendarExamples } from "../calendar";
import { cardExamples } from "../card";
import { chatExamples } from "../chat";
import { emojiPickerExamples } from "../emojiPicker";
import { chartExamples } from "../chart";
import { checkboxExamples } from "../checkbox";
import { codeSnippetExamples } from "../codeSnippet";
import { codeThemePickerExamples } from "../codeThemePicker";
import { codeViewerExamples } from "../codeViewer";
import { commandPaletteExamples } from "../commandPalette";
import { compassExamples } from "../compass";
import { consoleManagerExamples } from "../consoleManager";
import { contextMenuExamples } from "../contextMenu";
import { copyValueButtonExamples } from "../copyValueButton";
import { dateTimeDisplayExamples } from "../dateTimeDisplay";
import { dateTimePickerExamples } from "../dateTimePicker";
import { dateTimeRangePickerExamples } from "../dateTimeRangePicker";
import { dialogExamples } from "../dialog";
import { dropdownMenuExamples } from "../dropdownMenu";
import { expandableCodeExamples } from "../expandableCode";
import { fileIconExamples } from "../fileIcon";
import { fileViewerExamples } from "../fileViewer";
import { globalContextMenuExamples } from "../globalContextMenu";
import { image360ViewerExamples } from "../image360Viewer";
import { hoverCardExamples } from "../hoverCard";
import { inlineEditExamples } from "../inlineEdit";
import { inputExamples } from "../input";
import { inputGroupExamples } from "../inputGroup";
import { keyComboDisplayExamples } from "../keyComboDisplay";
import { keyComboRecorderExamples } from "../keyComboRecorder";
import { keyboardShortcutEditorExamples } from "../keyboardShortcutEditor";
import { labelExamples } from "../label";
import { languagePickerExamples } from "../languagePicker";
import { logViewExamples } from "../logView";
import { loggingConfigExamples } from "../loggingConfig";
import { lyricsExamples } from "../lyrics";
import { openingHoursExamples } from "../openingHours";
import { machineMonitorExamples } from "../machineMonitor";
import { modalHandlerExamples } from "../modalHandler";
import { nodeEditorExamples } from "../nodeEditor";
import { numberInputExamples } from "../numberInput";
import { optionPickerExamples } from "../optionPicker";
import { pageIndexExamples } from "../pageIndex";
import { popoverExamples } from "../popover";
import { primaryMenuExamples } from "../primaryMenu";
import { progressExamples } from "../progress";
import { radioGroupExamples } from "../radioGroup";
import { resizableExamples } from "../resizable";
import { resourceListExamples } from "../resourceList";
import { scrollAreaExamples } from "../scrollArea";
import { searchInputExamples } from "../searchInput";
import { searchSelectPickerExamples } from "../searchSelectPicker";
import { sectionHeadingExamples } from "../sectionHeading";
import { selectExamples } from "../select";
import { themePickerExamples } from "../themePicker";
import { timePickerExamples } from "../timePicker";
import { timezoneSelectorExamples } from "../timezoneSelector";
import { settingsPanelExamples } from "../settingsPanel";
import { sidebarExamples } from "../sidebar";
import { skeletonExamples } from "../skeleton";
import { sliderExamples } from "../slider";
import { sonnerExamples } from "../sonner";
import { stepsExamples } from "../steps";
import { switchExamples } from "../switch";
import { tabsExamples } from "../tabs";
import { terminalExamples } from "../terminal";
import { textareaExamples } from "../textarea";
import { timelineExamples } from "../timeline";
import { videoViewerExamples } from "../videoViewer";
import type { RegisteredExample } from "./types";

// Cross-registry guarantee: the source shown in the "Code" tab is the
// exact source that runs to produce the preview. Both come from the same
// `.tsx` file — the executable export is imported normally and the raw
// text via Vite's `?raw` suffix — but `cleanExampleSource` strips harness-
// only lines before display. This suite walks every registered example
// and pins the structural invariants of that cleaned output, so it can't
// silently drift away from the runtime component.

const ALL_REGISTRIES: ReadonlyArray<{
    name: string;
    examples: ReadonlyArray<RegisteredExample>;
}> = [
    { name: `steps`, examples: stepsExamples },
    { name: `pageIndex`, examples: pageIndexExamples },
    { name: `sectionHeading`, examples: sectionHeadingExamples },
    { name: `codeSnippet`, examples: codeSnippetExamples },
    { name: `codeThemePicker`, examples: codeThemePickerExamples },
    { name: `codeViewer`, examples: codeViewerExamples },
    { name: `fileIcon`, examples: fileIconExamples },
    { name: `primaryMenu`, examples: primaryMenuExamples },
    { name: `globalContextMenu`, examples: globalContextMenuExamples },
    { name: `copyValueButton`, examples: copyValueButtonExamples },
    { name: `buttonSelect`, examples: buttonSelectExamples },
    { name: `settingsPanel`, examples: settingsPanelExamples },
    { name: `terminal`, examples: terminalExamples },
    { name: `logView`, examples: logViewExamples },
    { name: `machineMonitor`, examples: machineMonitorExamples },
    { name: `sidebar`, examples: sidebarExamples },
    { name: `tabs`, examples: tabsExamples },
    { name: `badge`, examples: badgeExamples },
    { name: `button`, examples: buttonExamples },
    { name: `card`, examples: cardExamples },
    { name: `chart`, examples: chartExamples },
    { name: `checkbox`, examples: checkboxExamples },
    { name: `switch`, examples: switchExamples },
    { name: `input`, examples: inputExamples },
    { name: `label`, examples: labelExamples },
    { name: `textarea`, examples: textareaExamples },
    { name: `skeleton`, examples: skeletonExamples },
    { name: `progress`, examples: progressExamples },
    { name: `inlineEdit`, examples: inlineEditExamples },
    { name: `videoViewer`, examples: videoViewerExamples },
    { name: `dialog`, examples: dialogExamples },
    { name: `popover`, examples: popoverExamples },
    { name: `scrollArea`, examples: scrollAreaExamples },
    { name: `radioGroup`, examples: radioGroupExamples },
    { name: `slider`, examples: sliderExamples },
    { name: `contextMenu`, examples: contextMenuExamples },
    { name: `dropdownMenu`, examples: dropdownMenuExamples },
    { name: `hoverCard`, examples: hoverCardExamples },
    { name: `select`, examples: selectExamples },
    { name: `sonner`, examples: sonnerExamples },
    { name: `inputGroup`, examples: inputGroupExamples },
    { name: `resizable`, examples: resizableExamples },
    { name: `calendar`, examples: calendarExamples },
    { name: `compass`, examples: compassExamples },
    { name: `avatar`, examples: avatarExamples },
    { name: `actionDisplay`, examples: actionDisplayExamples },
    { name: `audioPlayer`, examples: audioPlayerExamples },
    { name: `lyrics`, examples: lyricsExamples },
    { name: `keyComboDisplay`, examples: keyComboDisplayExamples },
    { name: `keyComboRecorder`, examples: keyComboRecorderExamples },
    { name: `keyboardShortcutEditor`, examples: keyboardShortcutEditorExamples },
    { name: `expandableCode`, examples: expandableCodeExamples },
    { name: `searchInput`, examples: searchInputExamples },
    { name: `numberInput`, examples: numberInputExamples },
    { name: `optionPicker`, examples: optionPickerExamples },
    { name: `searchSelectPicker`, examples: searchSelectPickerExamples },
    { name: `languagePicker`, examples: languagePickerExamples },
    { name: `themePicker`, examples: themePickerExamples },
    { name: `dateTimePicker`, examples: dateTimePickerExamples },
    { name: `timePicker`, examples: timePickerExamples },
    { name: `timezoneSelector`, examples: timezoneSelectorExamples },
    { name: `dateTimeRangePicker`, examples: dateTimeRangePickerExamples },
    { name: `openingHours`, examples: openingHoursExamples },
    { name: `loggingConfig`, examples: loggingConfigExamples },
    { name: `commandPalette`, examples: commandPaletteExamples },
    { name: `modalHandler`, examples: modalHandlerExamples },
    { name: `fileViewer`, examples: fileViewerExamples },
    { name: `image360Viewer`, examples: image360ViewerExamples },
    { name: `resourceList`, examples: resourceListExamples },
    { name: `chat`, examples: chatExamples },
    { name: `emojiPicker`, examples: emojiPickerExamples },
    { name: `consoleManager`, examples: consoleManagerExamples },
    { name: `dateTimeDisplay`, examples: dateTimeDisplayExamples },
    { name: `timeline`, examples: timelineExamples },
    { name: `nodeEditor`, examples: nodeEditorExamples }
];

describe(`registry integrity — code shown == code that runs`, () => {
    for (const { name, examples } of ALL_REGISTRIES) {
        describe(name, () => {
            for (const example of examples) {
                describe(`${name}/${example.id}`, () => {
                    const cleaned = cleanExampleSource(example.source);

                    it(`raw source is non-empty (Vite ?raw import resolved)`, () => {
                        expect(example.source.length).toBeGreaterThan(0);
                    });

                    it(`cleaned source contains the Example declaration that renders the preview`, () => {
                        expect(cleaned).toMatch(/(?:const|function)\s+Example\b/);
                    });

                    it(`cleaned source strips harness scaffolding`, () => {
                        // Harness imports must not appear in what the reader copies.
                        expect(cleaned).not.toMatch(/from\s+["']\.\.\/harness\//);
                        // The ExampleModule trailer must be gone.
                        expect(cleaned).not.toMatch(/const\s+module\s*:\s*ExampleModule\b/);
                        // Standalone useExampleState() calls must be gone.
                        expect(cleaned).not.toMatch(/^\s*useExampleState\s*\(/m);
                    });

                    it(`cleaned source is non-empty after stripping`, () => {
                        expect(cleaned.trim().length).toBeGreaterThan(0);
                    });
                });
            }
        });
    }
});
