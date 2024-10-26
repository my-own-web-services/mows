#[doc(hidden)]
macro_rules! impl_from_request_body {
    ($req_from:ty, $req_into:ident, $attr:ident) => {
        impl From<$req_from> for RequestBody {
            fn from(value: $req_from) -> Self {
                Self::$req_into { $attr: value.$attr }
            }
        }
    };
    ($req_from:ty, $req_into:ident) => {
        impl From<$req_from> for RequestBody {
            fn from(_: $req_from) -> Self {
                Self::$req_into
            }
        }
    };
}

#[doc(hidden)]
macro_rules! return_if_err {
    ($e:expr, $err_var:ident, $error:expr) => {
        match $e {
            Ok(v) => v,
            Err($err_var) => {
                return AuthAnswer {
                    success: false,
                    message: $error.into(),
                }
            }
        }
    };
}

pub(crate) use impl_from_request_body;
pub(crate) use return_if_err;
