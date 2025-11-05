pub mod functions;

pub use gtmpl;
pub use gtmpl_derive;
pub use gtmpl_value;

use thiserror::Error;

#[derive(Error, Debug)]
pub enum TemplateError {
    #[error("TemplateParseError: {0}")]
    TemplateParseError(#[source] gtmpl::error::ParseError),

    #[error("TemplateFuncError: {0}")]
    TemplateFuncError(#[source] gtmpl::FuncError),

    #[error("TemplateExecError: {0}")]
    TemplateExecError(#[source] gtmpl::error::ExecError),
}
