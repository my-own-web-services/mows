use crate::{
    db::DB,
    internal_types::Auth,
    utils::{get_query_item, get_query_item_number},
};
use filez_common::server::{
    FriendshipStatus, GetItemListRequestBody, GetItemListResponseBody, ReducedFilezUser, SortOrder,
};
use hyper::{Body, Request, Response};

pub async fn get_user_list(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let body = hyper::body::to_bytes(req.into_body()).await?;

    let grrb: GetItemListRequestBody = serde_json::from_slice(&body)?;

    let (items, total_count) = db
        .get_user_list(
            &requesting_user,
            grrb.limit,
            grrb.from_index,
            grrb.sort_field,
            grrb.sort_order.unwrap_or(SortOrder::Ascending),
            grrb.filter,
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
