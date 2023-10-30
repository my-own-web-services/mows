use crate::{db::DB, internal_types::Auth};
use hyper::{Body, Request, Response};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/**
# Update friendship status.

## Call
`/api/user/update_friendship_status/`
## Permissions
None

*/
pub async fn update_friendship_status(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    crate::check_content_type_json!(req, res);
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

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

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdateFriendshipStatusRequestBody {
    pub user_id: String,
    pub new_status: UpdateFriendStatus,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum UpdateFriendStatus {
    SendFriendRequest,
    RemoveFriend,
    AcceptFriendRequest,
    RejectFriendRequest,
}
