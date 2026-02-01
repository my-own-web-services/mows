use gtmpl_ng::all_functions::all_functions;
use gtmpl_ng::{self as gtmpl, Context, TemplateError};
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{debug, info, trace};

use crate::error::{MowsError, Result};
use super::error::format_template_error;
use super::variables::load_variables_with_defaults;

/// Renders a template string with variables, returning rendered content.
///
/// This is the core template rendering function used by both the `mows template`
/// command and compose rendering. It:
/// - Sets up gtmpl with all template functions
/// - Generates a preamble that defines `$varname` shortcuts for each variable
/// - Parses and renders the template
///
/// On error, returns the TemplateError and the preamble line count (for error formatting).
pub fn render_template_string(
    template_content: &str,
    variables: &gtmpl::Value,
) -> std::result::Result<String, (TemplateError, usize)> {
    trace!("Parsing template ({} bytes)", template_content.len());
    let mut template = gtmpl::Template::default();

    // Add all template functions
    for (name, func) in all_functions() {
        template.add_func(name, func);
    }

    // Generate variable definitions preamble so users can use $varname syntax
    // Each variable on its own line, with trim markers to avoid output whitespace
    // We track the number of preamble lines to adjust error line numbers
    let (full_template, preamble_lines) = generate_preamble(template_content, variables);

    template
        .parse(&full_template)
        .map_err(|e| (TemplateError::from(e), preamble_lines))?;

    let context = Context::from(variables.clone());

    trace!("Rendering template");
    let rendered = template
        .render(&context)
        .map_err(|e| (TemplateError::from(e), preamble_lines))?;

    Ok(rendered)
}

/// Generate variable definitions preamble for template.
/// Returns (full_template_with_preamble, preamble_line_count).
fn generate_preamble(template_content: &str, variables: &gtmpl::Value) -> (String, usize) {
    if let gtmpl::Value::Object(map) = variables {
        if map.is_empty() {
            (template_content.to_string(), 0)
        } else {
            let preamble: String = map
                .keys()
                .map(|k| format!("{{{{- ${k} := .{k} }}}}\n"))
                .collect();
            let preamble_line_count = preamble.lines().count();
            trace!(
                "Template preamble ({} lines): {}",
                preamble_line_count,
                preamble.escape_debug()
            );
            (format!("{}{}", preamble, template_content), preamble_line_count)
        }
    } else {
        (template_content.to_string(), 0)
    }
}

fn render_single_file(input: &Path, output: &Path, values: &gtmpl::Value) -> Result<()> {
    trace!(
        "Rendering file: {} -> {}",
        input.display(),
        output.display()
    );

    let template_content = fs::read_to_string(input)
        .map_err(|e| MowsError::Message(format!("Failed to read template file '{}': {}", input.display(), e)))?;

    let rendered = render_template_string(&template_content, values).map_err(|(error, preamble_lines)| {
        MowsError::Template(format_template_error(input, &template_content, &error, preamble_lines, 6, Some(values)))
    })?;

    // Create parent directories if they don't exist
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            MowsError::Message(format!(
                "Failed to create output directory '{}': {}",
                parent.display(),
                e
            ))
        })?;
    }

    fs::write(output, rendered)
        .map_err(|e| MowsError::Message(format!("Failed to write output file '{}': {}", output.display(), e)))?;

    trace!("Finished rendering file: {}", input.display());
    Ok(())
}

fn render_directory(input: &Path, output: &Path, values: &gtmpl::Value) -> Result<()> {
    debug!("Rendering directory: {}", input.display());

    if !input.is_dir() {
        return Err(MowsError::path(input, "not a directory"));
    }

    // Create output directory
    fs::create_dir_all(output).map_err(|e| {
        MowsError::Message(format!(
            "Failed to create output directory '{}': {}",
            output.display(),
            e
        ))
    })?;

    trace!("Created output directory: {}", output.display());

    // Walk the directory tree
    for entry in fs::read_dir(input)
        .map_err(|e| MowsError::Message(format!("Failed to read directory '{}': {}", input.display(), e)))?
    {
        let entry = entry.map_err(|e| MowsError::Message(format!("Failed to read directory entry: {}", e)))?;
        let path = entry.path();
        let file_name = entry.file_name();
        let output_path = output.join(&file_name);

        if path.is_dir() {
            // Recursively render subdirectory
            render_directory(&path, &output_path, values)?;
        } else {
            // Render file - error already includes formatted context
            render_single_file(&path, &output_path, values)?;
        }
    }

    debug!("Finished rendering directory: {}", input.display());
    Ok(())
}

pub fn render_template_command(
    input: &PathBuf,
    variable_args: &[String],
    output: &PathBuf,
) -> Result<()> {
    info!(
        "Rendering templates: {} -> {}",
        input.display(),
        output.display()
    );

    let variables = load_variables_with_defaults(input, variable_args)?;

    if input.is_file() {
        debug!("Input is a file");
        render_single_file(input, output, &variables)
    } else if input.is_dir() {
        debug!("Input is a directory");
        render_directory(input, output, &variables)
    } else {
        Err(MowsError::path(input, "not a file or directory"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_render_template_simple() {
        let template = "Hello {{ .name }}!";
        let mut values_map = HashMap::new();
        values_map.insert(
            "name".to_string(),
            gtmpl::Value::String("World".to_string()),
        );
        let values = gtmpl::Value::Object(values_map);

        let rendered = render_template_string(template, &values).unwrap();
        assert!(rendered.contains("Hello World!"));
    }

    #[test]
    fn test_render_template_with_functions() {
        let template = "{{ upper .name }}";
        let mut values_map = HashMap::new();
        values_map.insert(
            "name".to_string(),
            gtmpl::Value::String("hello".to_string()),
        );
        let values = gtmpl::Value::Object(values_map);

        let rendered = render_template_string(template, &values).unwrap();
        assert!(rendered.contains("HELLO"));
    }
}
