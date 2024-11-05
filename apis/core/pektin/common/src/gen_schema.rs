use pektin_common::DbEntry;
use schemars::schema_for;
fn main() {
    print!("{}", serde_json::to_string(&schema_for!(DbEntry)).unwrap())
}
