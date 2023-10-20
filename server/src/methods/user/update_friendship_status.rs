use crate::{
    db::DB,
    internal_types::Auth,
    types::{UpdateFriendStatus, UpdateFriendshipStatusRequestBody},
};
use hyper::{Body, Request, Response};

pub async fn update_friendship_status(
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

    let ufsrb: UpdateFriendshipStatusRequestBody =
        serde_json::from_slice(&hyper::body::to_bytes(req.into_body()).await?)?;

    let other_user = match db.get_user_by_id(&ufsrb.user_id).await? {
        Some(u) => u,
        None => return Ok(res.status(404).body(Body::from("User not found"))?),
    };

    Ok(match ufsrb.new_status {
        UpdateFriendStatus::SendFriendRequest => {
            match other_user.friends.contains(&requesting_user.user_id) {
                true => res.status(409).body(Body::from("Already friends"))?,
                false => {
                    // append the users requesting users id to the other users pending friend requests
                    db.send_friend_request(&requesting_user.user_id, &other_user.user_id)
                        .await?;

                    res.status(200).body(Body::from("Friend request sent"))?
                }
            }
        }
        UpdateFriendStatus::RemoveFriend => {
            match other_user.friends.contains(&requesting_user.user_id) {
                true => {
                    db.remove_friend(&requesting_user.user_id, &other_user.user_id)
                        .await?;

                    res.status(200).body(Body::from("Friend removed"))?
                }
                false => res.status(409).body(Body::from("Not friends"))?,
            }
        }
        UpdateFriendStatus::AcceptFriendRequest => match requesting_user
            .pending_incoming_friend_requests
            .contains(&other_user.user_id)
        {
            true => {
                db.accept_friend_request(&requesting_user.user_id, &other_user.user_id)
                    .await?;

                res.status(200)
                    .body(Body::from("Friend request accepted"))?
            }
            false => res
                .status(409)
                .body(Body::from("No friend request from this user"))?,
        },
        UpdateFriendStatus::RejectFriendRequest => match requesting_user
            .pending_incoming_friend_requests
            .contains(&other_user.user_id)
        {
            true => {
                db.reject_friend_request(&requesting_user.user_id, &other_user.user_id)
                    .await?;

                res.status(200)
                    .body(Body::from("Friend request rejected"))?
            }
            false => res
                .status(409)
                .body(Body::from("No friend request from this user"))?,
        },
    })
}
