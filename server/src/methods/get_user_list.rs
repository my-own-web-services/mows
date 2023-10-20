use crate::{
    db::DB,
    internal_types::Auth,
    types::{FriendshipStatus, GetUserListResponseBody, ReducedFilezUser, SortOrder},
    utils::{get_query_item, get_query_item_number},
};
use hyper::{Body, Request, Response};

pub async fn get_user_list(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = match &auth.authenticated_user {
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

    let (users, total_count) = db
        .get_user_list(
            &requesting_user,
            limit,
            from_index as u64,
            field,
            sort_order,
            filter,
        )
        .await?;

    let users = users
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

            ReducedFilezUser {
                _id: u.user_id,
                name: u.name,
                friendship_status: friend_status,
                status: u.status,
                visibility: u.visibility,
                role: u.role,
            }
        })
        .collect::<Vec<ReducedFilezUser>>();

    let res_body = GetUserListResponseBody { users, total_count };

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&res_body)?.into())
        .unwrap())
}
