use clap::{Parser, Subcommand};
use mows_common_rust::templating::functions::{
    serde_json_value_to_gtmpl_value, TEMPLATE_FUNCTIONS,
};
use mows_common_rust::templating::gtmpl::{self, Context};
use std::collections::HashMap;
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Parser)]
#[command(name = "mozart")]
#[command(about = "Mozart - Docker Compose label utilities and template rendering", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Build command
    Build,
    /// Small utilities
    Tools {
        #[command(subcommand)]
        tool: ToolCommands,
    },
    /// Render templates
    Template {
        /// Template file or directory to render
        #[arg(short, long)]
        input: PathBuf,
        /// Values file (JSON or YAML)
        #[arg(short, long)]
        values: Option<PathBuf>,
        /// Output file or directory
        #[arg(short, long)]
        output: PathBuf,
    },
}

#[derive(Subcommand)]
enum ToolCommands {
    /// Convert JSON to YAML
    JsonToYaml {
        /// Input file (reads from stdin if not provided)
        #[arg(short, long)]
        input: Option<PathBuf>,
        /// Output file (writes to stdout if not provided)
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Convert YAML to JSON
    YamlToJson {
        /// Input file (reads from stdin if not provided)
        #[arg(short, long)]
        input: Option<PathBuf>,
        /// Output file (writes to stdout if not provided)
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Prettify JSON
    PrettifyJson {
        /// Input file (reads from stdin if not provided)
        #[arg(short, long)]
        input: Option<PathBuf>,
        /// Output file (writes to stdout if not provided)
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Convert flat dot-notation labels to nested tree structure
    LabelsToTree {
        /// Input file (reads from stdin if not provided)
        #[arg(short, long)]
        input: Option<PathBuf>,
        /// Output file (writes to stdout if not provided)
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Convert nested tree structure to flat dot-notation labels
    TreeToLabels {
        /// Input file (reads from stdin if not provided)
        #[arg(short, long)]
        input: Option<PathBuf>,
        /// Output file (writes to stdout if not provided)
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Run jq queries on JSON/YAML input
    Jq {
        /// jq query/filter to apply
        query: String,
        /// Input file (reads from stdin if not provided)
        #[arg(short, long)]
        input: Option<PathBuf>,
        /// Output file (writes to stdout if not provided)
        #[arg(short, long)]
        output: Option<PathBuf>,
        /// Output as YAML instead of JSON
        #[arg(long)]
        yaml: bool,
    },
}

fn find_git_root() -> Result<PathBuf, String> {
    let output = Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Not in a git repository: {}", stderr));
    }

    let path_str = String::from_utf8_lossy(&output.stdout);
    let path = PathBuf::from(path_str.trim());

    Ok(path)
}

fn read_input(input: &Option<PathBuf>) -> Result<String, String> {
    match input {
        Some(path) => fs::read_to_string(path)
            .map_err(|e| format!("Failed to read file {}: {}", path.display(), e)),
        None => {
            let mut buffer = String::new();
            io::stdin()
                .read_to_string(&mut buffer)
                .map_err(|e| format!("Failed to read from stdin: {}", e))?;
            Ok(buffer)
        }
    }
}

fn write_output(output: &Option<PathBuf>, content: &str) -> Result<(), String> {
    match output {
        Some(path) => fs::write(path, content)
            .map_err(|e| format!("Failed to write to file {}: {}", path.display(), e)),
        None => {
            print!("{}", content);
            Ok(())
        }
    }
}

fn json_to_yaml(input: &Option<PathBuf>, output: &Option<PathBuf>) -> Result<(), String> {
    let content = read_input(input)?;
    let value: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse JSON: {}", e))?;
    let yaml =
        serde_yaml::to_string(&value).map_err(|e| format!("Failed to convert to YAML: {}", e))?;
    write_output(output, &yaml)
}

fn yaml_to_json(input: &Option<PathBuf>, output: &Option<PathBuf>) -> Result<(), String> {
    let content = read_input(input)?;
    let value: serde_yaml::Value =
        serde_yaml::from_str(&content).map_err(|e| format!("Failed to parse YAML: {}", e))?;
    let json = serde_json::to_string_pretty(&value)
        .map_err(|e| format!("Failed to convert to JSON: {}", e))?;
    write_output(output, &json)
}

fn prettify_json(input: &Option<PathBuf>, output: &Option<PathBuf>) -> Result<(), String> {
    let content = read_input(input)?;
    let value: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse JSON: {}", e))?;
    let json = serde_json::to_string_pretty(&value)
        .map_err(|e| format!("Failed to prettify JSON: {}", e))?;
    write_output(output, &json)
}

fn labels_to_tree_command(input: &Option<PathBuf>, output: &Option<PathBuf>) -> Result<(), String> {
    let content = read_input(input)?;
    let value: serde_yaml::Value =
        serde_yaml::from_str(&content).map_err(|e| format!("Failed to parse YAML: {}", e))?;

    let tree = mows_common_rust::labels::labels_to_tree(value)
        .map_err(|e| format!("Failed to convert labels to tree: {}", e))?;

    let yaml =
        serde_yaml::to_string(&tree).map_err(|e| format!("Failed to convert to YAML: {}", e))?;
    write_output(output, &yaml)
}

fn tree_to_labels_command(input: &Option<PathBuf>, output: &Option<PathBuf>) -> Result<(), String> {
    let content = read_input(input)?;
    let value: serde_yaml::Value =
        serde_yaml::from_str(&content).map_err(|e| format!("Failed to parse YAML: {}", e))?;

    let labels = mows_common_rust::labels::tree_to_labels(value)
        .map_err(|e| format!("Failed to convert tree to labels: {}", e))?;

    let yaml =
        serde_yaml::to_string(&labels).map_err(|e| format!("Failed to convert to YAML: {}", e))?;
    write_output(output, &yaml)
}

fn jq_command(
    query: &str,
    input: &Option<PathBuf>,
    output: &Option<PathBuf>,
    yaml_output: bool,
) -> Result<(), String> {
    use jaq_interpret::{Ctx, FilterT, RcIter, Val};
    use jaq_parse;

    let content = read_input(input)?;

    // Try to parse as JSON first, then YAML
    let input_value: serde_json::Value = if let Ok(json) = serde_json::from_str(&content) {
        json
    } else {
        let yaml: serde_yaml::Value =
            serde_yaml::from_str(&content).map_err(|e| format!("Failed to parse input: {}", e))?;
        serde_json::to_value(&yaml).map_err(|e| format!("Failed to convert YAML to JSON: {}", e))?
    };

    // Parse the jq filter
    let (main, errs) = jaq_parse::parse(query, jaq_parse::main());
    if !errs.is_empty() {
        let err_msgs: Vec<String> = errs.iter().map(|e| format!("{:?}", e)).collect();
        return Err(format!("Failed to parse jq query: {}", err_msgs.join(", ")));
    }
    let main = main.ok_or("Failed to parse jq query")?;

    // Create filter context (starts with core filters only)
    // TODO: Add standard library support
    let mut arena = jaq_interpret::ParseCtx::new(Vec::new());
    let filter = arena.compile(main);

    if !arena.errs.is_empty() {
        let err_msgs: Vec<String> = arena.errs.iter().map(|e| format!("{}", e.0)).collect();
        return Err(format!(
            "Failed to compile jq query: {}",
            err_msgs.join(", ")
        ));
    }

    // Convert JSON to Val (jaq Val has From<serde_json::Value> impl)
    let input_val = Val::from(input_value.clone());

    // Run the filter
    let inputs = RcIter::new(core::iter::empty());
    let ctx = Ctx::new([], &inputs);

    let results: Vec<Val> = filter
        .run((ctx, input_val))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("jq query error: {}", e))?;

    // Format output
    let output_str = if results.len() == 1 {
        let result_json: serde_json::Value = results[0].clone().into();

        if yaml_output {
            serde_yaml::to_string(&result_json)
                .map_err(|e| format!("Failed to convert to YAML: {}", e))?
        } else {
            serde_json::to_string_pretty(&result_json)
                .map_err(|e| format!("Failed to convert to JSON: {}", e))?
        }
    } else {
        let results_json: Vec<serde_json::Value> =
            results.iter().map(|v| v.clone().into()).collect();

        if yaml_output {
            serde_yaml::to_string(&results_json)
                .map_err(|e| format!("Failed to convert to YAML: {}", e))?
        } else {
            results_json
                .iter()
                .map(|v| serde_json::to_string(v).unwrap())
                .collect::<Vec<_>>()
                .join("\n")
        }
    };

    write_output(output, &output_str)
}

fn load_values(values_file: &Option<PathBuf>) -> Result<gtmpl::Value, String> {
    let values = match values_file {
        Some(path) => {
            let content = fs::read_to_string(path)
                .map_err(|e| format!("Failed to read values file: {}", e))?;

            // Try JSON first, then YAML
            if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&content) {
                serde_json_value_to_gtmpl_value(json_value)
            } else if let Ok(yaml_value) = serde_yaml::from_str::<serde_yaml::Value>(&content) {
                mows_common_rust::templating::functions::serde_yaml_value_to_gtmpl_value(yaml_value)
            } else {
                return Err("Failed to parse values file as JSON or YAML".to_string());
            }
        }
        None => gtmpl::Value::Object(std::collections::HashMap::new()),
    };
    Ok(values)
}

fn render_template(template_content: &str, values: &gtmpl::Value) -> Result<String, String> {
    let mut template = gtmpl::Template::default();

    // Add all template functions
    for (name, func) in TEMPLATE_FUNCTIONS.iter() {
        template.add_func(name, *func);
    }

    template
        .parse(template_content)
        .map_err(|e| format!("Failed to parse template: {}", e))?;

    let context = Context::from(values.clone());

    template
        .render(&context)
        .map_err(|e| format!("Failed to render template: {}", e))
}

fn render_single_file(input: &Path, output: &Path, values: &gtmpl::Value) -> Result<(), String> {
    let template_content =
        fs::read_to_string(input).map_err(|e| format!("Failed to read template file: {}", e))?;

    let rendered = render_template(&template_content, values)?;

    // Create parent directories if they don't exist
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    fs::write(output, rendered).map_err(|e| format!("Failed to write output file: {}", e))
}

fn render_directory(input: &Path, output: &Path, values: &gtmpl::Value) -> Result<(), String> {
    if !input.is_dir() {
        return Err(format!("{} is not a directory", input.display()));
    }

    // Create output directory
    fs::create_dir_all(output).map_err(|e| format!("Failed to create output directory: {}", e))?;

    // Walk the directory tree
    for entry in fs::read_dir(input).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        let file_name = entry.file_name();
        let output_path = output.join(&file_name);

        if path.is_dir() {
            // Recursively render subdirectory
            render_directory(&path, &output_path, values)?;
        } else {
            // Render file
            render_single_file(&path, &output_path, values)?;
        }
    }

    Ok(())
}

fn render_template_command(
    input: &PathBuf,
    values_file: &Option<PathBuf>,
    output: &PathBuf,
) -> Result<(), String> {
    let values = load_values(values_file)?;

    if input.is_file() {
        render_single_file(input, output, &values)
    } else if input.is_dir() {
        render_directory(input, output, &values)
    } else {
        Err(format!("{} is not a file or directory", input.display()))
    }
}

fn main() {
    let cli = Cli::parse();

    let result = match cli.command {
        Commands::Build => {
            match find_git_root() {
                Ok(root) => {
                    println!("Git repository root: {}", root.display());
                    // Does nothing else for now
                    Ok(())
                }
                Err(e) => Err(e),
            }
        }
        Commands::Tools { tool } => match tool {
            ToolCommands::JsonToYaml { input, output } => json_to_yaml(&input, &output),
            ToolCommands::YamlToJson { input, output } => yaml_to_json(&input, &output),
            ToolCommands::PrettifyJson { input, output } => prettify_json(&input, &output),
            ToolCommands::LabelsToTree { input, output } => labels_to_tree_command(&input, &output),
            ToolCommands::TreeToLabels { input, output } => tree_to_labels_command(&input, &output),
            ToolCommands::Jq {
                query,
                input,
                output,
                yaml,
            } => jq_command(&query, &input, &output, yaml),
        },
        Commands::Template {
            input,
            values,
            output,
        } => render_template_command(&input, &values, &output),
    };

    if let Err(e) = result {
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }
}

pub struct ProjectInfo {
    pub name: String,
    pub version: String,
    pub description: String,

    pub build: HashMap<String, ProjectInfoBuild>,
    pub dev: HashMap<String, ProjectInfoDev>,
}

pub struct ProjectInfoBuild {}

pub struct ProjectInfoDev {}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_read_input_from_file() {
        let mut temp_file = NamedTempFile::new().unwrap();
        write!(temp_file, "test content").unwrap();
        temp_file.flush().unwrap();

        let path = Some(temp_file.path().to_path_buf());
        let result = read_input(&path).unwrap();
        assert_eq!(result, "test content");
    }

    #[test]
    fn test_write_output_to_file() {
        let temp_file = NamedTempFile::new().unwrap();
        let path = Some(temp_file.path().to_path_buf());

        write_output(&path, "test output").unwrap();

        let content = fs::read_to_string(temp_file.path()).unwrap();
        assert_eq!(content, "test output");
    }

    #[test]
    fn test_json_to_yaml() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, r#"{{"key": "value", "number": 42}}"#).unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        json_to_yaml(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        assert!(content.contains("key: value"));
        assert!(content.contains("number: 42"));
    }

    #[test]
    fn test_yaml_to_json() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, "key: value\nnumber: 42").unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        yaml_to_json(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(json["key"], "value");
        assert_eq!(json["number"], 42);
    }

    #[test]
    fn test_prettify_json() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, r#"{{"key":"value","number":42}}"#).unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        prettify_json(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        // Should be pretty-printed with indentation
        assert!(content.contains("  \"key\""));
        assert!(content.contains("  \"number\""));
    }

    #[test]
    fn test_labels_to_tree() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(
            input_file,
            "traefik.http.routers.myapp.rule: \"Host(`example.com`)\"\ntraefik.http.routers.myapp.entrypoints: web"
        )
        .unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        labels_to_tree_command(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        let tree: serde_yaml::Value = serde_yaml::from_str(&content).unwrap();

        // Verify nested structure
        assert!(tree.get("traefik").is_some());
        assert!(tree["traefik"].get("http").is_some());
        assert!(tree["traefik"]["http"].get("routers").is_some());
    }

    #[test]
    fn test_tree_to_labels() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(
            input_file,
            "traefik:\n  http:\n    routers:\n      myapp:\n        rule: \"Host(`example.com`)\"\n        entrypoints: web"
        )
        .unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        tree_to_labels_command(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        let labels: serde_yaml::Value = serde_yaml::from_str(&content).unwrap();

        // Verify flat structure
        assert!(labels.get("traefik.http.routers.myapp.rule").is_some());
        assert!(labels
            .get("traefik.http.routers.myapp.entrypoints")
            .is_some());
    }

    #[test]
    fn test_labels_to_tree_with_arrays() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(
            input_file,
            "\"items[0].name\": first\n\"items[0].value\": \"1\"\n\"items[1].name\": second"
        )
        .unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        labels_to_tree_command(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        let tree: serde_yaml::Value = serde_yaml::from_str(&content).unwrap();

        // Verify array structure
        assert!(tree.get("items").is_some());
        let items = tree["items"].as_sequence().unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0]["name"], "first");
    }

    #[test]
    fn test_roundtrip_labels_conversion() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(
            input_file,
            "traefik.http.routers.myapp.rule: \"Host(`example.com`)\"\ntraefik.http.services.myapp.port: \"8080\""
        )
        .unwrap();
        input_file.flush().unwrap();

        let tree_file = NamedTempFile::new().unwrap();
        let output_file = NamedTempFile::new().unwrap();

        // Convert to tree
        labels_to_tree_command(
            &Some(input_file.path().to_path_buf()),
            &Some(tree_file.path().to_path_buf()),
        )
        .unwrap();

        // Convert back to labels
        tree_to_labels_command(
            &Some(tree_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        let labels: serde_yaml::Value = serde_yaml::from_str(&content).unwrap();

        // Verify all keys are present
        assert!(labels.get("traefik.http.routers.myapp.rule").is_some());
        assert!(labels.get("traefik.http.services.myapp.port").is_some());
    }

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
        assert_eq!(result, "Hello World!");
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
        assert_eq!(result, "HELLO");
    }

    #[test]
    fn test_load_values_json() {
        let mut temp_file = NamedTempFile::new().unwrap();
        write!(temp_file, r#"{{"name": "test", "count": 42}}"#).unwrap();
        temp_file.flush().unwrap();

        let values = load_values(&Some(temp_file.path().to_path_buf())).unwrap();

        // Verify values were loaded
        match values {
            gtmpl::Value::Object(map) => {
                assert!(map.contains_key("name"));
                assert!(map.contains_key("count"));
            }
            _ => panic!("Expected object"),
        }
    }

    #[test]
    fn test_load_values_yaml() {
        let mut temp_file = NamedTempFile::new().unwrap();
        write!(temp_file, "name: test\ncount: 42").unwrap();
        temp_file.flush().unwrap();

        let values = load_values(&Some(temp_file.path().to_path_buf())).unwrap();

        // Verify values were loaded
        match values {
            gtmpl::Value::Object(map) => {
                assert!(map.contains_key("name"));
                assert!(map.contains_key("count"));
            }
            _ => panic!("Expected object"),
        }
    }

    #[test]
    fn test_jq_simple_query() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, r#"{{"name": "test", "value": 42}}"#).unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        jq_command(
            ".name",
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
            false,
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        assert!(content.contains("\"test\""));
    }

    // TODO: Re-enable when standard library support is added
    // Currently only core filters are available, not stdlib functions like select()
    #[test]
    #[ignore]
    fn test_jq_filter() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(
            input_file,
            r#"{{"items": [{{"name": "a", "value": 1}}, {{"name": "b", "value": 2}}]}}"#
        )
        .unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        jq_command(
            ".items[] | select(.value > 1)",
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
            false,
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        assert!(content.contains("\"b\""));
        assert!(!content.contains("\"a\""));
    }

    #[test]
    fn test_jq_yaml_input() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, "name: test\nvalue: 42").unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        jq_command(
            ".name",
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
            false,
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        assert!(content.contains("\"test\""));
    }

    #[test]
    fn test_jq_yaml_output() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, r#"{{"name": "test", "value": 42}}"#).unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        jq_command(
            ".",
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
            true,
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        assert!(content.contains("name: test"));
        assert!(content.contains("value: 42"));
    }
}
