use gtmpl_ng::all_functions::all_functions;
use gtmpl_ng::{self as gtmpl, Context, TemplateError};
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{debug, info, trace};

use super::error::format_template_error;
use super::variables::load_variables_with_defaults;

/// Template render result
struct RenderResult {
    rendered: String,
}

/// Renders a template, returning rendered content and preamble line count
fn render_template(
    template_content: &str,
    variables: &gtmpl::Value,
) -> Result<RenderResult, (TemplateError, usize)> {
    trace!("Parsing template ({} bytes)", template_content.len());
    let mut template = gtmpl::Template::default();

    // Add all template functions
    for (name, func) in all_functions() {
        template.add_func(name, func);
    }

    // Generate variable definitions preamble so users can use $varname syntax
    // Each variable on its own line, with trim markers to avoid output whitespace
    // We track the number of preamble lines to adjust error line numbers
    let (full_template, preamble_lines) = if let gtmpl::Value::Object(map) = variables {
        if map.is_empty() {
            (template_content.to_string(), 0)
        } else {
            let var_count = map.len();
            let preamble: String = map
                .keys()
                .map(|k| format!("{{{{- ${k} := .{k} }}}}\n"))
                .collect();
            trace!(
                "Template preamble ({} lines): {}",
                var_count,
                preamble.escape_debug()
            );
            (format!("{}{}", preamble, template_content), var_count)
        }
    } else {
        (template_content.to_string(), 0)
    };

    template
        .parse(&full_template)
        .map_err(|e| (TemplateError::from(e), preamble_lines))?;

    let context = Context::from(variables.clone());

    trace!("Rendering template");
    let rendered = template
        .render(&context)
        .map_err(|e| (TemplateError::from(e), preamble_lines))?;

    Ok(RenderResult { rendered })
}

fn render_single_file(input: &Path, output: &Path, values: &gtmpl::Value) -> Result<(), String> {
    trace!(
        "Rendering file: {} -> {}",
        input.display(),
        output.display()
    );

    let template_content = fs::read_to_string(input)
        .map_err(|e| format!("Failed to read template file '{}': {}", input.display(), e))?;

    let result = render_template(&template_content, values).map_err(|(error, preamble_lines)| {
        format_template_error(input, &template_content, &error, preamble_lines, 6, Some(values))
    })?;

    // Create parent directories if they don't exist
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            format!(
                "Failed to create output directory '{}': {}",
                parent.display(),
                e
            )
        })?;
    }

    fs::write(output, result.rendered)
        .map_err(|e| format!("Failed to write output file '{}': {}", output.display(), e))?;

    trace!("Finished rendering file: {}", input.display());
    Ok(())
}

fn render_directory(input: &Path, output: &Path, values: &gtmpl::Value) -> Result<(), String> {
    debug!("Rendering directory: {}", input.display());

    if !input.is_dir() {
        return Err(format!("{} is not a directory", input.display()));
    }

    // Create output directory
    fs::create_dir_all(output).map_err(|e| {
        format!(
            "Failed to create output directory '{}': {}",
            output.display(),
            e
        )
    })?;

    trace!("Created output directory: {}", output.display());

    // Walk the directory tree
    for entry in fs::read_dir(input)
        .map_err(|e| format!("Failed to read directory '{}': {}", input.display(), e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
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
) -> Result<(), String> {
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
        Err(format!("{} is not a file or directory", input.display()))
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

        let result = render_template(template, &values).unwrap();
        // The preamble adds a newline that shows up in output
        assert!(result.rendered.contains("Hello World!"));
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

        let result = render_template(template, &values).unwrap();
        assert!(result.rendered.contains("HELLO"));
    }
}
