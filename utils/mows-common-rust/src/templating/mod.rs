pub use gtmpl_ng as gtmpl;
pub use gtmpl_derive;
pub use gtmpl_value;

use thiserror::Error;

#[derive(Error, Debug)]
pub enum TemplateError {
    #[error("TemplateParseError: {0}")]
    TemplateParseError(#[source] gtmpl_ng::error::ParseError),

    #[error("TemplateFuncError: {0}")]
    TemplateFuncError(#[source] gtmpl_ng::FuncError),

    #[error("TemplateExecError: {0}")]
    TemplateExecError(#[source] gtmpl_ng::error::ExecError),
}
