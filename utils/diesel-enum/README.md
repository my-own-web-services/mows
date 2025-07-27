This crate allows the user to represent state in the database using Rust enums. This is achieved
through a proc macro. First the macro looks at your chosen `sql_type`, and then it devises a
corresponding Rust type. The mapping is as follows:

| SQL        | Rust     |
| ---------- | -------- |
| `SmallInt` | `i16`    |
| `Integer`  | `i32`    |
| `Int`      | `i32`    |
| `BigInt`   | `i64`    |
| `VarChar`  | `String` |
| `Text`     | `String` |

The macro then generates three impls: a `FromSql` impl, an `ToSql` impl and a
`TryFrom` impl, which allow conversion between the Sql type an the enum (`FromSql` and `ToSql`),
and from the Rust type into the enum (`TryInto`).

### Usage

```rust
use diesel_enum::DbEnum;
use diesel::{deserialize::FromSqlRow, sql_types::{SmallInt, VarChar}};

#[derive(Debug, thiserror::Error)]
#[error("CustomError: {msg}, {status}")]
pub struct CustomError {
    msg: String,
    status: u16,
}

impl CustomError {
    fn not_found(msg: String) -> Self {
        Self {
            msg,
            status: 404,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, AsExpression, FromSqlRow, DbEnum)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = CustomError::not_found)]
#[diesel_enum(error_type = CustomError)]
pub enum Status {
    /// Will be represented as 0.
    Ready,
    /// Will be represented as 1.
    Pending,
}
```

Alternatively you can use strings, with will be cast to lowercase. (e.g. `Status::Ready` will be
stored as `"ready"` in the database):

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, AsExpression, FromSqlRow, DbEnum)]
#[diesel(sql_type = VarChar)]
#[diesel_enum(error_fn = CustomError::not_found)]
#[diesel_enum(error_type = CustomError)]
pub enum Status {
    /// Will be represented as `"ready"`.
    Ready,
    /// Will be represented as `"pending"`.
    Pending,
}
```

Another option is to manually override the values set for each or some of the variants. This is done
using the `val` attribute:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, AsExpression, FromSqlRow, DbEnum)]
#[diesel(sql_type = VarChar)]
#[diesel_enum(error_fn = CustomError::not_found)]
#[diesel_enum(error_type = CustomError)]
pub enum Status {
    /// Will be represented as `"reddy"`.
    #[val = "reddy"]
    Ready,
    /// Will be represented as `"pending"`.
    Pending,
}
```
