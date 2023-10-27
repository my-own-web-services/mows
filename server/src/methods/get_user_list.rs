use crate::{
    db::DB,
    internal_types::Auth,
    types::{FriendshipStatus, GetItemListResponseBody, ReducedFilezUser, SortOrder},
    utils::{get_query_item, get_query_item_number},
};
use hyper::{Body, Request, Response};

pub async fn get_user_list(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = match &auth.authenticated_ir_user_id {
        Some(ir_user_id) => match db.get_user_by_ir_id(ir_user_id).await? {
            Some(u) => u,
            None => return Ok(res.status(412).body(Body::from("User has not been created on the filez server, although it is present on the IR server. Run create_own first."))?),
        },
        None => return Ok(res.status(401).body(Body::from("Unauthorized"))?),
    };

    let limit = get_query_item_number(&req, "l");
    let from_index = get_query_item_number(&req, "i").unwrap_or(0);

    let field = get_query_item(&req, "f");
    let sort_order = get_query_item(&req, "o").map_or(SortOrder::Ascending, |s| match s.as_str() {
        "Ascending" => SortOrder::Ascending,
        "Descending" => SortOrder::Descending,
        _ => SortOrder::Ascending,
    });

    let filter = get_query_item(&req, "s");

    let (items, total_count) = db
        .get_user_list(
            &requesting_user,
            limit,
            from_index as u64,
            field,
            sort_order,
            filter,
        )
        .await?;

    let items = items
        .into_iter()
        .map(|u| {
            let friend_status = if requesting_user
                .pending_incoming_friend_requests
                .contains(&u.user_id)
            {
                FriendshipStatus::AwaitingYourConfirmation
            } else if u
                .pending_incoming_friend_requests
                .contains(&requesting_user.user_id)
            {
                FriendshipStatus::AwaitingTheirConfirmation
            } else if u.friends.contains(&requesting_user.user_id) {
                FriendshipStatus::Friends
            } else {
                FriendshipStatus::NotFriends
            };

            // get all the elements from the two arrays that overlap
            let shared_user_groups = u
                .user_group_ids
                .iter()
                .filter(|id| requesting_user.user_group_ids.contains(id))
                .cloned()
                .collect::<Vec<String>>();

            ReducedFilezUser {
                _id: u.user_id,
                name: u.name,
                friendship_status: friend_status,
                status: u.status,
                visibility: u.visibility,
                role: u.role,
                shared_user_groups,
            }
        })
        .collect::<Vec<ReducedFilezUser>>();

    let res_body = GetItemListResponseBody::<ReducedFilezUser> { items, total_count };

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&res_body)?.into())
        .unwrap())
}
