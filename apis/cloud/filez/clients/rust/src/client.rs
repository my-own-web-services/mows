use reqwest::Client;
use crate::types::*;
use uuid::Uuid;
use reqwest::Url;
use reqwest::header::HeaderMap;


#[derive(Debug, Clone)]
pub struct ApiClient {
    pub client: Client,
    pub base_url: String,
    pub impersonate_user: Option<Uuid>,
    pub auth_method: Option<AuthMethod>,
    pub runtime_instance_id: Option<String>,
}

#[derive(Debug, Clone)]
pub enum AuthMethod {
    ServiceAccountToken(String),
    ServiceAccountTokenPath(std::path::PathBuf),
    ServiceAccountTokenDefaultPath,
    BearerToken(String),
    KeyAccess((Uuid, String)),
}


#[derive(Debug, thiserror::Error)]
pub enum ApiClientError {
    #[error(transparent)]
    RequestError(#[from] reqwest::Error),
    #[error(transparent)]
    ParseError(#[from] serde_json::Error),
    #[error(transparent)]
    InvalidHeaderValue(#[from] reqwest::header::InvalidHeaderValue),
    #[error(transparent)]
    IoError(#[from] std::io::Error),
}

impl ApiClient {
    pub fn new(base_url: String, auth_method: Option<AuthMethod>, impersonate_user: Option<Uuid>, runtime_instance_id: Option<String>) -> Self {
        let client = Client::new();
        let base_url = base_url.trim_end_matches('/').to_string();
        Self { client, base_url, auth_method, impersonate_user, runtime_instance_id }
    }

    fn add_auth_headers(&self) -> Result<HeaderMap, ApiClientError> {
        let mut headers = HeaderMap::new();
        match &self.auth_method {
            Some(auth_method) => match auth_method {
                AuthMethod::ServiceAccountToken(service_account_token) => {
                    headers.insert("x-service-account-token", service_account_token.parse()?);
                }
                AuthMethod::ServiceAccountTokenPath(service_account_token_token_path) => {
                    let service_account_token =
                        std::fs::read_to_string(service_account_token_token_path)?;
                    headers.insert(
                        "x-service-account-token",
                        service_account_token.trim().parse()?,
                    );
                }
                AuthMethod::ServiceAccountTokenDefaultPath => {
                    let service_account_token = std::fs::read_to_string(
                        "/var/run/secrets/kubernetes.io/serviceaccount/token",
                    )?;
                    headers.insert(
                        "x-service-account-token",
                        service_account_token.trim().parse()?,
                    );
                }
                AuthMethod::BearerToken(bearer_token) => {
                    headers.insert(
                        reqwest::header::AUTHORIZATION,
                        format!("Bearer {}", bearer_token).parse()?,
                    );
                }
                AuthMethod::KeyAccess((user_id, token)) => {
                    headers.insert(
                        "X-Filez-Key-Access",
                        format!("{}:{}", user_id, token).parse()?,
                    );
                }
            },
            None => {}
        }

        if let Some(impersonate_user) = self.impersonate_user {
            headers.insert(
                "X-Filez-Impersonate-User",
                impersonate_user.to_string().parse()?,
            );
        }

        if let Some(runtime_instance_id) = &self.runtime_instance_id {
            headers.insert(
                "X-Filez-Runtime-Instance-ID",
                runtime_instance_id.parse()?,
            );
        }

        Ok(headers)
    }



    pub async fn check_resource_access(&self, request_body: CheckResourceAccessRequestBody) -> Result<ApiResponseCheckResourceAccessResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/access_policies/check", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn create_access_policy(&self, request_body: CreateAccessPolicyRequestBody) -> Result<ApiResponseAccessPolicy, ApiClientError> {
        
        let full_url = format!("{}/api/access_policies/create", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn delete_access_policy(&self, access_policy_id: Uuid) -> Result<ApiResponseString, ApiClientError> {
        
        let full_url = format!("{}/api/access_policies/delete/{access_policy_id}", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.delete(full_url).headers(self.add_auth_headers()?).send().await?.json().await?;
        Ok(response)
    }

    pub async fn get_access_policy(&self, access_policy_id: Uuid) -> Result<ApiResponseAccessPolicy, ApiClientError> {
        
        let full_url = format!("{}/api/access_policies/get/{access_policy_id}", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.get(full_url).headers(self.add_auth_headers()?).send().await?.json().await?;
        Ok(response)
    }

    pub async fn list_access_policies(&self, request_body: ListAccessPoliciesRequestBody) -> Result<ApiResponseListAccessPoliciesResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/access_policies/list", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn update_access_policy(&self, request_body: UpdateAccessPolicyRequestBody) -> Result<ApiResponseAccessPolicy, ApiClientError> {
        
        let full_url = format!("{}/api/access_policies/update", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.put(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn get_apps(&self ) -> Result<ApiResponseGetAppsResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/apps/get", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).send().await?.json().await?;
        Ok(response)
    }

    pub async fn list_apps(&self, request_body: ListAppsRequestBody) -> Result<ApiResponseListAppsResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/apps/list", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn create_file_group(&self, request_body: CreateFileGroupRequestBody) -> Result<ApiResponseFileGroup, ApiClientError> {
        
        let full_url = format!("{}/api/file_groups/create", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn delete_file_group(&self, file_group_id: Uuid) -> Result<ApiResponseString, ApiClientError> {
        
        let full_url = format!("{}/api/file_groups/delete/{file_group_id}", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.delete(full_url).headers(self.add_auth_headers()?).send().await?.json().await?;
        Ok(response)
    }

    pub async fn get_file_group(&self, file_group_id: Uuid) -> Result<ApiResponseFileGroup, ApiClientError> {
        
        let full_url = format!("{}/api/file_groups/get/{file_group_id}", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.get(full_url).headers(self.add_auth_headers()?).send().await?.json().await?;
        Ok(response)
    }

    pub async fn list_file_groups(&self, request_body: ListFileGroupsRequestBody) -> Result<ApiResponseListFileGroupsResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/file_groups/list", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn list_files_by_file_groups(&self, request_body: ListFilesRequestBody) -> Result<ApiResponseListFilesResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/file_groups/list_files", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn update_file_group(&self, request_body: UpdateFileGroupRequestBody) -> Result<ApiResponseFileGroup, ApiClientError> {
        
        let full_url = format!("{}/api/file_groups/update", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.put(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn update_file_group_members(&self, request_body: UpdateFileGroupMembersRequestBody) -> Result<ApiResponseEmptyApiResponse, ApiClientError> {
        
        let full_url = format!("{}/api/file_groups/update_members", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn get_file_version_content(&self, file_id: Uuid, version: Option<u32>, app_id: Option<String>, app_path: Option<String>, disposition: bool, cache: u64) -> Result<reqwest::Response, ApiClientError> {
        let version = OptionAsNull(version);
        let app_id = OptionAsNull(app_id);
        let app_path = OptionAsNull(app_path);
        let full_url = format!("{}/api/file_versions/content/get/{file_id}/{version}/{app_id}/{app_path}", self.base_url);
        let full_url = Url::parse(&full_url).unwrap().query_pairs_mut().append_pair("disposition", &disposition.to_string()).append_pair("cache", &cache.to_string()).finish().clone();
        
        let response = self.client.get(full_url).headers(self.add_auth_headers()?).send().await?;
        Ok(response)
    }

    pub async fn file_versions_content_tus_patch(&self, file_id: Uuid, version: Option<u32>, app_id: Option<String>, app_path: Option<String>, request_body: reqwest::Body) -> Result<ApiResponseEmptyApiResponse, ApiClientError> {
        let version = OptionAsNull(version);
        let app_id = OptionAsNull(app_id);
        let app_path = OptionAsNull(app_path);
        let full_url = format!("{}/api/file_versions/content/tus/{file_id}/{version}/{app_id}/{app_path}", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.patch(full_url).headers(self.add_auth_headers()?).body(request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn file_versions_content_tus_head(&self, file_id: Uuid, version: Option<u32>, app_id: Option<String>, app_path: Option<String>) -> Result<ApiResponseEmptyApiResponse, ApiClientError> {
        let version = OptionAsNull(version);
        let app_id = OptionAsNull(app_id);
        let app_path = OptionAsNull(app_path);
        let full_url = format!("{}/api/file_versions/content/tus/{file_id}/{version}/{app_id}/{app_path}", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.head(full_url).headers(self.add_auth_headers()?).send().await?.json().await?;
        Ok(response)
    }

    pub async fn create_file_version(&self, request_body: CreateFileVersionRequestBody) -> Result<ApiResponseCreateFileVersionResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/file_versions/create", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn delete_file_versions(&self, request_body: DeleteFileVersionsRequestBody) -> Result<ApiResponseDeleteFileVersionsResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/file_versions/delete", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn get_file_versions(&self, request_body: GetFileVersionsRequestBody) -> Result<ApiResponseGetFileVersionsResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/file_versions/get", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn update_file_versions(&self, request_body: UpdateFileVersionsRequestBody) -> Result<ApiResponseUpdateFileVersionsResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/file_versions/update", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn create_file(&self, request_body: CreateFileRequestBody) -> Result<ApiResponseCreateFileResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/files/create", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn delete_file(&self, request_body: DeleteFileRequestBody) -> Result<ApiResponseDeleteFileResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/files/delete", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn get_files(&self ) -> Result<ApiResponseGetFilesResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/files/get", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).send().await?.json().await?;
        Ok(response)
    }

    pub async fn update_file(&self, request_body: UpdateFileRequestBody) -> Result<ApiResponseUpdateFileResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/files/update", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn get_health(&self ) -> Result<ApiResponseHealthResBody, ApiClientError> {
        
        let full_url = format!("{}/api/health", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.get(full_url).headers(self.add_auth_headers()?).send().await?.json().await?;
        Ok(response)
    }

    pub async fn create_job(&self, request_body: CreateJobRequestBody) -> Result<ApiResponseCreateJobResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/jobs/create", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn delete_job(&self, request_body: DeleteJobRequestBody) -> Result<ApiResponseEmptyApiResponse, ApiClientError> {
        
        let full_url = format!("{}/api/jobs/delete", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn get_job(&self, request_body: GetJobRequestBody) -> Result<ApiResponseGetJobResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/jobs/get", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn list_jobs(&self, request_body: ListJobsRequestBody) -> Result<ApiResponseListJobsResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/jobs/list", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn pickup_job(&self, request_body: PickupJobRequestBody) -> Result<ApiResponsePickupJobResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/jobs/pickup", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn update_job(&self, request_body: UpdateJobRequestBody) -> Result<ApiResponseUpdateJobResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/jobs/update", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn list_storage_locations(&self, request_body: ListStorageLocationsRequestBody) -> Result<ApiResponseListStorageLocationsResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/storage_locations/list", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn create_storage_quota(&self, request_body: CreateStorageQuotaRequestBody) -> Result<ApiResponseCreateStorageQuotaResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/storage_quotas/create", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn delete_storage_quota(&self, request_body: DeleteStorageQuotaRequestBody) -> Result<ApiResponseEmptyApiResponse, ApiClientError> {
        
        let full_url = format!("{}/api/storage_quotas/delete", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn get_storage_quota(&self, request_body: GetStorageQuotaRequestBody) -> Result<ApiResponseStorageQuota, ApiClientError> {
        
        let full_url = format!("{}/api/storage_quotas/get", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn list_storage_quotas(&self, request_body: ListStorageQuotasRequestBody) -> Result<ApiResponseListStorageQuotasResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/storage_quotas/list", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn update_storage_quota(&self, request_body: UpdateStorageQuotaRequestBody) -> Result<ApiResponseStorageQuota, ApiClientError> {
        
        let full_url = format!("{}/api/storage_quotas/update", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.put(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn get_tags(&self, request_body: GetTagsRequestBody) -> Result<ApiResponseGetTagsResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/tags/get", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn update_tags(&self, request_body: UpdateTagsRequestBody) -> Result<ApiResponseEmptyApiResponse, ApiClientError> {
        
        let full_url = format!("{}/api/tags/update", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn create_user_group(&self, request_body: CreateUserGroupRequestBody) -> Result<ApiResponseUserGroup, ApiClientError> {
        
        let full_url = format!("{}/api/user_groups/create", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn delete_user_group(&self, user_group_id: Uuid) -> Result<ApiResponseString, ApiClientError> {
        
        let full_url = format!("{}/api/user_groups/delete/{user_group_id}", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.delete(full_url).headers(self.add_auth_headers()?).send().await?.json().await?;
        Ok(response)
    }

    pub async fn get_user_group(&self, user_group_id: Uuid) -> Result<ApiResponseUserGroup, ApiClientError> {
        
        let full_url = format!("{}/api/user_groups/get/{user_group_id}", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.get(full_url).headers(self.add_auth_headers()?).send().await?.json().await?;
        Ok(response)
    }

    pub async fn list_user_groups(&self, request_body: ListUserGroupsRequestBody) -> Result<ApiResponseListUserGroupsResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/user_groups/list", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn list_users_by_user_group(&self, request_body: ListUsersRequestBody) -> Result<ApiResponseListUsersResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/user_groups/list_users", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn update_user_group(&self, request_body: UpdateUserGroupRequestBody) -> Result<ApiResponseUserGroup, ApiClientError> {
        
        let full_url = format!("{}/api/user_groups/update", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.put(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn update_user_group_members(&self, request_body: UpdateUserGroupMembersRequestBody) -> Result<ApiResponseEmptyApiResponse, ApiClientError> {
        
        let full_url = format!("{}/api/user_groups/update_members", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn create_user(&self, request_body: CreateUserRequestBody) -> Result<ApiResponseCreateUserResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/users/create", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn delete_user(&self, request_body: DeleteUserRequestBody) -> Result<ApiResponseDeleteUserResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/users/delete", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn get_users(&self, request_body: GetUsersReqBody) -> Result<ApiResponseGetUsersResBody, ApiClientError> {
        
        let full_url = format!("{}/api/users/get", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }

    pub async fn get_own_user(&self ) -> Result<ApiResponseGetOwnUserBody, ApiClientError> {
        
        let full_url = format!("{}/api/users/get_own", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).send().await?.json().await?;
        Ok(response)
    }

    pub async fn list_users(&self, request_body: ListUsersRequestBody) -> Result<ApiResponseListUsersResponseBody, ApiClientError> {
        
        let full_url = format!("{}/api/users/list", self.base_url);
        let full_url = Url::parse(&full_url).unwrap();
        
        let response = self.client.post(full_url).headers(self.add_auth_headers()?).json(&request_body).send().await?.json().await?;
        Ok(response)
    }
}
    
    
struct OptionAsNull<T>(pub Option<T>);

impl<T: std::fmt::Display> std::fmt::Display for OptionAsNull<T> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match &self.0 {
            Some(value) => write!(f, "{}", value),
            None => write!(f, "null"),
        }
    }
}
    
    