use std::fmt::{Debug, Formatter};

use mows_common::get_current_config_cloned;
use tonic::{service::interceptor::InterceptedService, transport::Channel};
use zitadel::{
    api::{
        clients::ClientBuilder, interceptors::ServiceAccountInterceptor,
        zitadel::management::v1::management_service_client::ManagementServiceClient,
    },
    credentials::ServiceAccount,
};

use crate::{config::config, Error};
struct TypedDebugWrapper<'a, T: ?Sized>(&'a T);

impl<T: Debug> Debug for TypedDebugWrapper<'_, T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> core::fmt::Result {
        write!(f, "{}::{:?}", core::any::type_name::<T>(), self.0)
    }
}

trait TypedDebug: Debug {
    fn typed_debug(&self) -> TypedDebugWrapper<'_, Self> {
        TypedDebugWrapper(self)
    }
}

impl<T: ?Sized + Debug> TypedDebug for T {}

pub fn get_error_type(e: &Error) -> String {
    let reason = format!("{:?}", e.typed_debug());
    let reason = reason.split_at(reason.find('(').unwrap_or(0)).0;
    reason.to_string()
}

pub type ManagementClient = ManagementServiceClient<InterceptedService<Channel, ServiceAccountInterceptor>>;

pub async fn create_new_zitadel_management_client() -> anyhow::Result<ManagementClient> {
    let config = get_current_config_cloned!(config());
    let service_account = ServiceAccount::load_from_file(&config.service_account_token_path).unwrap();
    let client_builder =
        ClientBuilder::new(&config.zitadel_endpoint).with_service_account(&service_account, None);

    let client = client_builder.build_management_client().await.unwrap();

    Ok(client)
}
