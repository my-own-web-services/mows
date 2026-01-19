//! File error display with syntax-highlighted code frames.

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};

use colored::control::SHOULD_COLORIZE;
use colored::Colorize;

static NO_COLOR: AtomicBool = AtomicBool::new(false);

pub fn set_no_color(no_color: bool) {
    NO_COLOR.store(no_color, Ordering::Relaxed);
    // Also update colored's internal state
    if no_color {
        colored::control::set_override(false);
    } else {
        colored::control::unset_override();
    }
}

pub fn should_use_colors() -> bool {
    if NO_COLOR.load(Ordering::Relaxed) {
        return false;
    }
    SHOULD_COLORIZE.should_colorize()
}

/// ANSI codes for complex string building that mixes with syntect output.
/// These use RGB true colors for subtle visual effects in whitespace visualization.
/// Raw codes are needed here because we build strings character-by-character
/// and interleave with syntect's ANSI sequences.
mod codes {
    pub const RESET: &str = "\x1b[0m";
    /// Dark gray RGB(70,70,75) for whitespace dots
    pub const DARK_GRAY: &str = "\x1b[38;2;70;70;75m";
    /// Dim red background RGB(80,30,30) for error highlighting
    pub const BG_DIM_RED: &str = "\x1b[48;2;80;30;30m";
    /// Subtle gray background RGB(50,50,55) for indent guides
    pub const BG_INDENT: &str = "\x1b[48;2;50;50;55m";
    /// Reset background only (not foreground)
    pub const BG_RESET: &str = "\x1b[49m";
}

/// Detect tab width from file content by analyzing indentation patterns.
/// Returns the most likely tab width (defaults to 4 if can't detect).
fn detect_tab_width(content: &str) -> usize {
    let mut indent_counts: [usize; 9] = [0; 9]; // counts for widths 1-8

    for line in content.lines() {
        let spaces = line.chars().take_while(|&c| c == ' ').count();
        if spaces > 0 && spaces <= 8 {
            // Count occurrences of each possible indent level
            for width in 1..=8 {
                if spaces % width == 0 {
                    indent_counts[width] += 1;
                }
            }
        }
    }

    // Find the most common divisor (prefer 2, 4, 8 over odd numbers)
    let preferred = [4, 2, 8, 3, 6];
    for &width in &preferred {
        if indent_counts[width] > 0 {
            return width;
        }
    }

    4 // default
}

/// Get the indentation (number of leading spaces) of a line
fn get_yaml_indentation(line: &str) -> usize {
    line.chars().take_while(|c| *c == ' ').count()
}

/// Detect the most common indent step from the file (usually 2 or 4)
fn detect_yaml_indent_step(lines: &[&str]) -> usize {
    let mut counts = [0usize; 5]; // counts for steps 1, 2, 3, 4

    for window in lines.windows(2) {
        let ind1 = get_yaml_indentation(window[0]);
        let ind2 = get_yaml_indentation(window[1]);
        if ind2 > ind1 {
            let diff = ind2 - ind1;
            if diff >= 1 && diff <= 4 {
                counts[diff] += 1;
            }
        }
    }

    // Find most common step (prefer 2 or 4)
    if counts[2] >= counts[4] && counts[2] > 0 {
        2
    } else if counts[4] > 0 {
        4
    } else if counts[3] > 0 {
        3
    } else {
        2 // default
    }
}

/// Check if a specific line has incorrect indentation compared to context.
/// Simply checks if the indentation is a multiple of the file's detected indent step.
/// Returns the error message and the number of spaces found (for highlighting).
pub fn check_yaml_indentation_error(content: &str, error_line: usize) -> Option<(String, usize)> {
    let lines: Vec<&str> = content.lines().collect();
    if error_line == 0 || error_line > lines.len() {
        return None;
    }

    let error_line_idx = error_line - 1;
    let error_indent = get_yaml_indentation(lines[error_line_idx]);

    // Detect indent step from the whole file
    let indent_step = detect_yaml_indent_step(&lines);

    // Check if indentation is a valid multiple of the indent step
    if error_indent % indent_step != 0 {
        // Calculate the nearest valid indentation
        let lower = (error_indent / indent_step) * indent_step;
        let upper = lower + indent_step;
        let expected = if error_indent - lower <= upper - error_indent {
            lower
        } else {
            upper
        };

        Some((
            format!(
                "indentation error: expected {} spaces, found {}",
                expected, error_indent
            ),
            error_indent,
        ))
    } else {
        None
    }
}

/// Replace whitespace with visible characters in syntax-highlighted text.
/// This version preserves ANSI escape sequences and only replaces actual whitespace.
/// Also adds indent guides (alternating backgrounds) for leading spaces.
fn visualize_whitespace_highlighted(s: &str, tab_width: usize) -> String {
    let mut result = String::new();
    let mut chars = s.chars().peekable();
    let mut col: usize = 0; // track column position for tab alignment
    let mut in_leading_whitespace = true; // track if we're still in leading whitespace
    let mut last_fg_color: Option<String> = None; // Track last syntect foreground color

    while let Some(c) = chars.next() {
        if c == '\x1b' {
            // Start of escape sequence, copy until 'm'
            let mut seq = String::from(c);
            while chars.peek().is_some() {
                let next = chars.next().unwrap();
                seq.push(next);
                if next == 'm' {
                    break;
                }
            }
            result.push_str(&seq);
            // Track foreground color codes
            if seq.contains("[38;") {
                last_fg_color = Some(seq);
            } else if seq.contains("[0m") {
                last_fg_color = None;
            }
        } else if c == ' ' {
            if in_leading_whitespace {
                // Indent guide: alternate background for odd indent levels
                let indent_level = col / tab_width;
                if indent_level % 2 == 1 {
                    result.push_str(codes::BG_INDENT);
                    result.push_str(codes::DARK_GRAY);
                    result.push('·');
                    result.push_str(codes::BG_RESET);
                } else {
                    result.push_str(codes::DARK_GRAY);
                    result.push('·');
                    result.push_str(codes::BG_RESET);
                }
            } else {
                // Regular space (not indentation)
                result.push_str(codes::DARK_GRAY);
                result.push('·');
                result.push_str(codes::BG_RESET);
            }
            // Restore syntect foreground color after whitespace
            if let Some(ref fg) = last_fg_color {
                result.push_str(fg);
            }
            col += 1;
        } else if c == '\t' {
            // Calculate spaces to next tabstop
            let spaces_to_tabstop = tab_width - (col % tab_width);
            // Indent guide: alternate background for odd indent levels
            let indent_level = col / tab_width;
            if in_leading_whitespace && indent_level % 2 == 1 {
                result.push_str(codes::BG_INDENT);
                result.push_str(codes::DARK_GRAY);
                result.push('→');
                for _ in 1..spaces_to_tabstop {
                    result.push(' ');
                }
                result.push_str(codes::BG_RESET);
            } else {
                result.push_str(codes::DARK_GRAY);
                result.push('→');
                for _ in 1..spaces_to_tabstop {
                    result.push(' ');
                }
                result.push_str(codes::BG_RESET);
            }
            // Restore syntect foreground color after whitespace
            if let Some(ref fg) = last_fg_color {
                result.push_str(fg);
            }
            col += spaces_to_tabstop;
        } else {
            // Non-whitespace character - no longer in leading whitespace
            in_leading_whitespace = false;
            result.push(c);
            col += 1;
        }
    }

    result
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Language {
    Json,
    Yaml,
    GotmplYaml,
    Toml,
    Rust,
    JavaScript,
    TypeScript,
    Python,
    Go,
    Shell,
    Dockerfile,
    #[default]
    PlainText,
}

impl Language {
    pub fn from_filename(filename: &str) -> Self {
        let lower = filename.to_lowercase();

        if lower == "dockerfile" || lower.starts_with("dockerfile.") {
            return Language::Dockerfile;
        }
        if lower == ".env" || lower.starts_with(".env.") {
            return Language::Shell;
        }

        match std::path::Path::new(filename)
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_lowercase())
            .as_deref()
        {
            Some("json") => Language::Json,
            Some("yaml" | "yml") => Language::Yaml,
            Some("gotmpl") => Language::GotmplYaml,
            Some("toml") => Language::Toml,
            Some("rs") => Language::Rust,
            Some("js" | "mjs" | "cjs") => Language::JavaScript,
            Some("ts" | "mts" | "cts" | "tsx") => Language::TypeScript,
            Some("py" | "pyw") => Language::Python,
            Some("go") => Language::Go,
            Some("sh" | "bash" | "zsh") => Language::Shell,
            _ => Language::PlainText,
        }
    }

    /// Check if the content contains Go template syntax
    pub fn detect_gotmpl(content: &str) -> bool {
        content.contains("{{") && content.contains("}}")
    }

    fn syntect_ext(&self) -> &'static str {
        match self {
            Language::Json => "json",
            Language::Yaml => "yaml",
            Language::GotmplYaml => "gotmpl",
            Language::Toml => "toml",
            Language::Rust => "rs",
            Language::JavaScript => "js",
            Language::TypeScript => "ts",
            Language::Python => "py",
            Language::Go => "go",
            Language::Shell => "sh",
            Language::Dockerfile => "Dockerfile",
            Language::PlainText => "txt",
        }
    }
}

// Embedded Go Template YAML syntax definition
const GOTMPL_YAML_SYNTAX: &str = include_str!("syntax/gotmpl_yaml.sublime-syntax");

// Embedded Go Template dark theme
const GOTMPL_DARK_THEME: &str = include_str!("syntax/gotmpl_dark.tmTheme");

struct Highlighter {
    syntax_set: syntect::parsing::SyntaxSet,
    gotmpl_theme: syntect::highlighting::Theme,
    default_theme: syntect::highlighting::Theme,
}

impl Highlighter {
    fn new() -> Self {
        use syntect::highlighting::ThemeSet;
        use syntect::parsing::SyntaxDefinition;

        // Load default syntaxes
        let defaults = syntect::parsing::SyntaxSet::load_defaults_newlines();

        // Try to load the gotmpl syntax and add it to defaults
        let syntax_set = match SyntaxDefinition::load_from_str(GOTMPL_YAML_SYNTAX, true, None) {
            Ok(gotmpl_syntax) => {
                let mut builder = defaults.into_builder();
                builder.add(gotmpl_syntax);
                builder.build()
            }
            Err(_) => defaults,
        };

        // Load the custom theme
        let gotmpl_theme = syntect::highlighting::ThemeSet::load_from_reader(
            &mut std::io::Cursor::new(GOTMPL_DARK_THEME),
        )
        .unwrap_or_else(|_| ThemeSet::load_defaults().themes["base16-ocean.dark"].clone());

        let default_theme = ThemeSet::load_defaults().themes["base16-ocean.dark"].clone();

        Self {
            syntax_set,
            gotmpl_theme,
            default_theme,
        }
    }

    fn highlight(&self, source: &str, language: Language) -> Vec<String> {
        use syntect::easy::HighlightLines;
        use syntect::util::{as_24_bit_terminal_escaped, LinesWithEndings};

        if !should_use_colors() {
            return source.lines().map(|s| s.to_string()).collect();
        }

        let syntax = self
            .syntax_set
            .find_syntax_by_extension(language.syntect_ext())
            .unwrap_or_else(|| self.syntax_set.find_syntax_plain_text());

        // Use gotmpl theme for GotmplYaml, default theme for others
        let theme = match language {
            Language::GotmplYaml => &self.gotmpl_theme,
            _ => &self.default_theme,
        };

        let mut h = HighlightLines::new(syntax, theme);

        let mut result = Vec::new();
        for line in LinesWithEndings::from(source) {
            let ranges = h.highlight_line(line, &self.syntax_set).unwrap_or_default();
            let escaped = as_24_bit_terminal_escaped(&ranges[..], false);
            result.push(escaped.trim_end_matches('\n').to_string());
        }

        result
    }
}

static HIGHLIGHTER: std::sync::LazyLock<Highlighter> = std::sync::LazyLock::new(Highlighter::new);

/// Format a file error with syntax-highlighted code frame.
///
/// # Arguments
/// * `file_path` - Path to the file (for display and language detection)
/// * `content` - File content
/// * `message` - Error message
/// * `line` - 1-based line number
/// * `col` - 1-based column number
/// * `len` - Length of the error span (use 1 if unknown)
/// * `context_lines` - Number of lines to show before and after the error line
/// * `note` - Optional note to display after the code frame
/// * `suggestion` - Optional suggestion to display after the note
pub fn format_file_error(
    file_path: &Path,
    content: &str,
    message: &str,
    line: usize,
    col: usize,
    len: usize,
    context_lines: usize,
    note: Option<&str>,
    suggestion: Option<&str>,
) -> String {
    let mut language = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .map(Language::from_filename)
        .unwrap_or(Language::PlainText);

    // Auto-detect Go templates in YAML files
    if language == Language::Yaml && Language::detect_gotmpl(content) {
        language = Language::GotmplYaml;
    }

    let mut output = String::new();

    // Header
    output.push('\n');
    output.push_str(&format!("{} {}\n", "error:".red().bold(), message.bold()));

    // Location link
    let loc_str = format!("  --> {}:{}:{}", file_path.display(), line, col);
    output.push_str(&format!("{}\n", loc_str.dimmed()));

    // Code frame
    output.push('\n');
    output.push_str(&render_code_frame(content, message, line, col, len, context_lines, language));

    // Note
    if let Some(note_text) = note {
        output.push_str(&format!("{} {}\n", "  note:".cyan().bold(), note_text));
    }

    // Suggestion
    if let Some(suggestion_text) = suggestion {
        output.push_str(&format!("{} {}\n", "  help:".green().bold(), suggestion_text));
    }

    output
}

fn render_code_frame(
    content: &str,
    error_message: &str,
    error_line: usize,
    error_col: usize,
    error_len: usize,
    context_lines: usize,
    language: Language,
) -> String {
    let lines: Vec<&str> = content.lines().collect();
    let line_count = lines.len();

    if line_count == 0 {
        return String::new();
    }

    // Detect tab width from content
    let tab_width = detect_tab_width(content);

    // context_lines is the total window size, split roughly evenly before/after error
    let half_context = context_lines / 2;
    let start = error_line.saturating_sub(half_context + 1);
    let end = (error_line + (context_lines - half_context)).min(line_count);

    let line_num_width = format!("{}", end).len().max(3);

    let highlighted_lines = if should_use_colors() {
        HIGHLIGHTER.highlight(content, language)
    } else {
        lines.iter().map(|s| s.to_string()).collect()
    };

    let mut output = String::new();

    for i in start..end {
        let line_num = i + 1;
        let highlighted = highlighted_lines.get(i).map(|s| s.as_str()).unwrap_or("");
        let original = lines.get(i).copied().unwrap_or("");

        if line_num == error_line {
            output.push_str(&render_error_line(
                line_num,
                original,
                highlighted,
                line_num_width,
                error_col,
                error_len,
                tab_width,
                error_message,
            ));
        } else {
            output.push_str(&render_context_line(line_num, highlighted, line_num_width, tab_width));
        }
    }

    output
}

fn render_error_line(
    line_num: usize,
    original: &str,
    highlighted: &str,
    width: usize,
    col: usize,
    len: usize,
    tab_width: usize,
    error_message: &str,
) -> String {
    let mut output = String::new();

    if should_use_colors() {
        let line_num_str = format!("{:>width$}", line_num, width = width);
        output.push_str(&format!("{}", line_num_str.red().bold()));
        output.push_str(" │ ");

        let col_idx = col.saturating_sub(1);
        let end_idx = col_idx + len.max(1);

        // Process highlighted text, inserting error marker at correct visible position
        output.push_str(&insert_error_marker_highlighted(
            highlighted, original, col_idx, end_idx, tab_width,
        ));

        // Add error message at end of line
        output.push_str(&format!("  {}", error_message.red().bold()));
    } else {
        output.push_str(&format!(
            "{:>width$} │ {}  {}",
            line_num, original, error_message, width = width
        ));
    }

    output.push('\n');
    output
}

/// Process highlighted text, inserting error background at the correct visible character positions.
/// Also visualizes whitespace with gray dots and tabs/indent guides with proper alignment.
fn insert_error_marker_highlighted(
    highlighted: &str,
    original: &str,
    error_start: usize,
    error_end: usize,
    tab_width: usize,
) -> String {
    let mut result = String::new();
    let mut visible_pos: usize = 0;
    let mut col: usize = 0; // track column for tab alignment
    let mut in_leading_whitespace = true;
    let mut in_error = false;
    let mut chars = highlighted.chars().peekable();
    let original_chars: Vec<char> = original.chars().collect();
    let mut last_fg_color: Option<String> = None; // Track last syntect foreground color

    while let Some(c) = chars.next() {
        if c == '\x1b' {
            // ANSI escape sequence - copy through but track if we need to restore error colors
            let mut seq = String::from(c);
            while chars.peek().is_some() {
                let next = chars.next().unwrap();
                seq.push(next);
                if next == 'm' {
                    break;
                }
            }
            result.push_str(&seq);

            // Track foreground color codes (38;2;R;G;B or 38;5;N)
            if seq.contains("[38;") {
                last_fg_color = Some(seq.clone());
            } else if seq.contains("[0m") {
                last_fg_color = None;
            }

            // If we're in the error region and this was a reset, restore error colors
            if in_error && seq.contains("[0m") {
                result.push_str(codes::BG_DIM_RED);
            }
        } else {
            // Visible character - check if we're entering error region
            if visible_pos == error_start && !in_error {
                in_error = true;
                result.push_str(codes::BG_DIM_RED);
            }

            // Get the original character to check for whitespace
            let orig_char = original_chars.get(visible_pos).copied().unwrap_or(c);

            // Visualize whitespace
            if orig_char == ' ' || c == ' ' {
                if in_error {
                    // In error region: show space as middle dot with error background
                    result.push_str(codes::DARK_GRAY);
                    result.push('·');
                    result.push_str(codes::BG_RESET);
                    result.push_str(codes::BG_DIM_RED);
                } else if in_leading_whitespace {
                    // Indent guide: alternate background for odd indent levels
                    let indent_level = col / tab_width;
                    if indent_level % 2 == 1 {
                        result.push_str(codes::BG_INDENT);
                        result.push_str(codes::DARK_GRAY);
                        result.push('·');
                        result.push_str(codes::BG_RESET);
                    } else {
                        result.push_str(codes::DARK_GRAY);
                        result.push('·');
                        result.push_str(codes::BG_RESET);
                    }
                } else {
                    // Regular space (not indentation)
                    result.push_str(codes::DARK_GRAY);
                    result.push('·');
                    result.push_str(codes::BG_RESET);
                }
                // Restore syntect foreground color after whitespace
                if let Some(ref fg) = last_fg_color {
                    result.push_str(fg);
                }
                col += 1;
            } else if orig_char == '\t' || c == '\t' {
                let spaces_to_tabstop = tab_width - (col % tab_width);
                let indent_level = col / tab_width;
                if in_error {
                    result.push_str(codes::DARK_GRAY);
                    result.push('→');
                    for _ in 1..spaces_to_tabstop {
                        result.push(' ');
                    }
                    result.push_str(codes::BG_RESET);
                    result.push_str(codes::BG_DIM_RED);
                } else if in_leading_whitespace && indent_level % 2 == 1 {
                    // Indent guide: alternate background for odd indent levels
                    result.push_str(codes::BG_INDENT);
                    result.push_str(codes::DARK_GRAY);
                    result.push('→');
                    for _ in 1..spaces_to_tabstop {
                        result.push(' ');
                    }
                    result.push_str(codes::BG_RESET);
                } else {
                    result.push_str(codes::DARK_GRAY);
                    result.push('→');
                    for _ in 1..spaces_to_tabstop {
                        result.push(' ');
                    }
                    result.push_str(codes::BG_RESET);
                }
                // Restore syntect foreground color after whitespace
                if let Some(ref fg) = last_fg_color {
                    result.push_str(fg);
                }
                col += spaces_to_tabstop;
            } else {
                // Non-whitespace: no longer in leading whitespace
                in_leading_whitespace = false;
                result.push(c);
                col += 1;
            }

            visible_pos += 1;

            // Check if we're exiting error region
            if visible_pos == error_end && in_error {
                in_error = false;
                result.push_str(codes::RESET);
                // Restore syntect foreground color after exiting error region
                if let Some(ref fg) = last_fg_color {
                    result.push_str(fg);
                }
            }
        }
    }

    // If we ended while still in error region, close it
    if in_error {
        result.push_str(codes::RESET);
    }

    result
}

fn render_context_line(line_num: usize, highlighted: &str, width: usize, tab_width: usize) -> String {
    let mut output = String::new();

    if should_use_colors() {
        let line_num_str = format!("{:>width$}", line_num, width = width);
        output.push_str(&format!("{}", line_num_str.dimmed()));
        output.push_str(" │ ");
        // Visualize whitespace while preserving syntax highlighting
        output.push_str(&visualize_whitespace_highlighted(highlighted, tab_width));
    } else {
        output.push_str(&format!("{:>width$} │ {}", line_num, highlighted, width = width));
    }

    output.push('\n');
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_language_detection() {
        assert_eq!(Language::from_filename("config.yaml"), Language::Yaml);
        assert_eq!(Language::from_filename("config.json"), Language::Json);
        assert_eq!(Language::from_filename("Dockerfile"), Language::Dockerfile);
        assert_eq!(Language::from_filename("template.gotmpl"), Language::GotmplYaml);
    }

    #[test]
    fn test_gotmpl_detection() {
        // Content with Go templates should be detected
        assert!(Language::detect_gotmpl("key: {{ .Values.name }}"));
        assert!(Language::detect_gotmpl("{{- if .enabled }}\nvalue: true\n{{- end }}"));

        // Plain YAML should not be detected as gotmpl
        assert!(!Language::detect_gotmpl("key: value\nother: stuff"));
        assert!(!Language::detect_gotmpl(""));
    }

    #[test]
    fn test_format_file_error() {
        set_no_color(true);

        let content = "key: value\ninvalid: {{ broken }}\nother: stuff";
        let output = format_file_error(
            Path::new("test.yaml"),
            content,
            "invalid template syntax",
            2,
            10,
            12,
            3,
            None,
            None,
        );

        assert!(output.contains("error:"));
        assert!(output.contains("invalid template syntax"));
        assert!(output.contains("test.yaml:2:10"));

        set_no_color(false);
    }

    #[test]
    fn test_format_file_error_with_note_and_suggestion() {
        set_no_color(true);

        let content = "key: value\ninvalid: {{ broken }}\nother: stuff";
        let output = format_file_error(
            Path::new("test.yaml"),
            content,
            "invalid template syntax",
            2,
            10,
            12,
            3,
            Some("template braces must be balanced"),
            Some("add a closing '}}'"),
        );

        assert!(output.contains("note: template braces must be balanced"));
        assert!(output.contains("help: add a closing '}}'"));

        set_no_color(false);
    }

    #[test]
    fn test_visualize_whitespace_highlighted() {
        // Spaces in highlighted text become dots
        let result = super::visualize_whitespace_highlighted("  hello  ", 4);
        assert!(result.contains('·'));
        assert!(result.contains("hello"));

        // Escape sequences are preserved
        let highlighted = "\x1b[31mred\x1b[0m text";
        let result = super::visualize_whitespace_highlighted(highlighted, 4);
        assert!(result.contains("\x1b[31mred\x1b[0m"));
        assert!(result.contains('·')); // space between "red" and "text" becomes dot
    }

    #[test]
    fn test_detect_tab_width() {
        // Should detect 2-space indent
        let content = "line1\n  line2\n    line3";
        assert_eq!(super::detect_tab_width(content), 2);

        // Should detect 4-space indent
        let content = "line1\n    line2\n        line3";
        assert_eq!(super::detect_tab_width(content), 4);

        // Default to 4 if no indentation
        let content = "no indent";
        assert_eq!(super::detect_tab_width(content), 4);
    }

    #[test]
    fn test_yaml_indent_too_few_spaces() {
        // 3 spaces where 2 or 4 expected (under 2-space indent pattern)
        let content = "version: \"3.9\"\n\nservices:\n  qa-web:\n    build:\n      context: ./\n   wrong_indent: true\n    container_name: test";
        let result = check_yaml_indentation_error(content, 7);
        assert!(result.is_some());
        let (msg, indent) = result.unwrap();
        assert!(msg.contains("expected"));
        assert!(msg.contains("found 3"));
        assert_eq!(indent, 3);
    }

    #[test]
    fn test_yaml_indent_too_many_spaces() {
        // 5 spaces where 4 or 6 expected
        let content = "version: \"3.9\"\n\nservices:\n  qa-web:\n    build:\n      context: ./\n     extra_indent: true\n    container_name: test";
        let result = check_yaml_indentation_error(content, 7);
        assert!(result.is_some());
        let (msg, indent) = result.unwrap();
        assert!(msg.contains("expected"));
        assert!(msg.contains("found 5"));
        assert_eq!(indent, 5);
    }

    #[test]
    fn test_yaml_indent_valid_multiple() {
        // 4 spaces is valid multiple of 2
        let content = "services:\n  qa-web:\n    build: true";
        let result = check_yaml_indentation_error(content, 3);
        assert!(result.is_none(), "Valid indent (multiple of step) should not be detected as error");
    }

    #[test]
    fn test_yaml_indent_valid_dedent() {
        // Valid dedent from 6 to 4 spaces (both multiples of 2)
        let content = "services:\n  qa-web:\n    build:\n      context: ./\n    container_name: test";
        let result = check_yaml_indentation_error(content, 5);
        assert!(result.is_none(), "Valid dedent should not be detected as error");
    }

    #[test]
    fn test_yaml_indent_nearest_lower() {
        // 3 spaces - should suggest 2 (closer than 4)
        let content = "a:\n  b:\n   c:";
        let result = check_yaml_indentation_error(content, 3);
        assert!(result.is_some());
        let (msg, indent) = result.unwrap();
        assert!(msg.contains("expected 2"));
        assert!(msg.contains("found 3"));
        assert_eq!(indent, 3);
    }

    #[test]
    fn test_yaml_indent_nearest_equal_picks_lower() {
        // 5 spaces - equidistant from 4 and 6, should pick lower (4)
        let content = "a:\n  b:\n    c:\n     d:";
        let result = check_yaml_indentation_error(content, 4);
        assert!(result.is_some());
        let (msg, indent) = result.unwrap();
        assert!(msg.contains("expected 4"));
        assert!(msg.contains("found 5"));
        assert_eq!(indent, 5);
    }

    #[test]
    fn test_yaml_indent_nearest_upper() {
        // 3 spaces with 4-space indent - closer to 4 than 0
        let content = "a:\n    b:\n   c:";
        let result = check_yaml_indentation_error(content, 3);
        assert!(result.is_some());
        let (msg, indent) = result.unwrap();
        assert!(msg.contains("expected 4"));
        assert!(msg.contains("found 3"));
        assert_eq!(indent, 3);
    }

    #[test]
    fn test_detect_yaml_indent_step() {
        // 2-space indentation
        let lines = vec!["root:", "  child:", "    grandchild:"];
        assert_eq!(detect_yaml_indent_step(&lines), 2);

        // 4-space indentation
        let lines = vec!["root:", "    child:", "        grandchild:"];
        assert_eq!(detect_yaml_indent_step(&lines), 4);

        // Mixed - should prefer most common
        let lines = vec!["a:", "  b:", "    c:", "      d:", "        e:"];
        assert_eq!(detect_yaml_indent_step(&lines), 2);
    }
}
