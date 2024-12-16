# \DefaultApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**add_repositories**](DefaultApi.md#add_repositories) | **POST** /api/repository | 
[**get_health**](DefaultApi.md#get_health) | **GET** /api/health | 
[**get_repositories**](DefaultApi.md#get_repositories) | **GET** /api/repository | 
[**render_repositories**](DefaultApi.md#render_repositories) | **POST** /api/repository/render | 



## add_repositories

> models::ApiResponseEmptyApiResponse add_repositories(add_repository_req_body)


### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**add_repository_req_body** | [**AddRepositoryReqBody**](AddRepositoryReqBody.md) |  | [required] |

### Return type

[**models::ApiResponseEmptyApiResponse**](ApiResponse_EmptyApiResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_health

> models::ApiResponseHealthResBody get_health()


### Parameters

This endpoint does not need any parameter.

### Return type

[**models::ApiResponseHealthResBody**](ApiResponse_HealthResBody.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_repositories

> models::ApiResponseGetRepositoriesResBody get_repositories()


### Parameters

This endpoint does not need any parameter.

### Return type

[**models::ApiResponseGetRepositoriesResBody**](ApiResponse_GetRepositoriesResBody.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## render_repositories

> models::ApiResponseRenderRepositoriesResBody render_repositories(render_repositories_req_body)


### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**render_repositories_req_body** | [**RenderRepositoriesReqBody**](RenderRepositoriesReqBody.md) |  | [required] |

### Return type

[**models::ApiResponseRenderRepositoriesResBody**](ApiResponse_RenderRepositoriesResBody.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

