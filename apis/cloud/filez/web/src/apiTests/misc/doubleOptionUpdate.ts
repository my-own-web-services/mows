import {
    AccessPolicyEffect,
    AccessPolicyResourceType,
    AccessPolicySubjectType,
    Api,
    createExampleUser
} from "filez-client-typescript";
import { isEqual } from "lodash";

export default async (filezClient: Api<unknown>) => {
    const alice = await createExampleUser(filezClient);

    const accessPolicy1 = await filezClient.api.createAccessPolicy({
        access_policy_actions: [],
        access_policy_effect: AccessPolicyEffect.Deny,
        access_policy_name: "Test policy 1",
        access_policy_resource_type: AccessPolicyResourceType.User,
        access_policy_subject_id: alice.id,
        access_policy_subject_type: AccessPolicySubjectType.User,
        context_app_ids: [],
        resource_id: alice.id
    });

    if (!accessPolicy1.data?.data?.created_access_policy) {
        throw new Error("Failed to create access policy.");
    }
    //@ts-ignore
    delete accessPolicy1.data?.data?.created_access_policy.modified_time;

    console.log(`Created access policy 1: ${accessPolicy1.data?.data?.created_access_policy.id}`);

    const updatedAccessPolicy1 = await filezClient.api.updateAccessPolicy({
        access_policy_id: accessPolicy1.data?.data?.created_access_policy.id!,
        changeset: {}
    });

    if (!updatedAccessPolicy1.data?.data?.updated_access_policy) {
        throw new Error("Failed to update access policy with empty changeset.");
    }
    //@ts-ignore
    delete updatedAccessPolicy1.data?.data?.updated_access_policy.modified_time;

    console.log(
        `Updated access policy 1 with empty changeset: ${updatedAccessPolicy1.data?.data?.updated_access_policy.id}`
    );

    if (
        !isEqual(
            accessPolicy1.data?.data?.created_access_policy,
            updatedAccessPolicy1.data?.data?.updated_access_policy
        )
    ) {
        throw new Error("Access policy should be unchanged after empty changeset update.");
    }

    const updatedAccessPolicy2 = await filezClient.api.updateAccessPolicy({
        access_policy_id: accessPolicy1.data?.data?.created_access_policy.id!,
        changeset: {
            new_resource_id: null
        }
    });

    if (!updatedAccessPolicy2.data?.data?.updated_access_policy) {
        throw new Error("Failed to update access policy with null resource_id changeset.");
    }
    //@ts-ignore
    delete updatedAccessPolicy2.data?.data?.updated_access_policy.modified_time;

    console.log(
        `Updated access policy 1 with null resource_id changeset: ${updatedAccessPolicy2.data?.data?.updated_access_policy.id}`
    );
    if (
        isEqual(
            accessPolicy1.data?.data?.created_access_policy,
            updatedAccessPolicy2.data?.data?.updated_access_policy
        )
    ) {
        throw new Error("Access policy should be changed after null resource_id changeset update.");
    }

    if (updatedAccessPolicy2.data?.data?.updated_access_policy.resource_id !== null) {
        throw new Error("Access policy resource_id should be null after update.");
    }

    // set the resource_id back to alice.id
    const updatedAccessPolicy3 = await filezClient.api.updateAccessPolicy({
        access_policy_id: accessPolicy1.data?.data?.created_access_policy.id!,
        changeset: {
            new_resource_id: alice.id
        }
    });

    if (!updatedAccessPolicy3.data?.data?.updated_access_policy) {
        throw new Error("Failed to update access policy with alice.id resource_id changeset.");
    }
    //@ts-ignore
    delete updatedAccessPolicy3.data?.data?.updated_access_policy.modified_time;

    if (
        isEqual(
            updatedAccessPolicy2.data?.data?.updated_access_policy,
            updatedAccessPolicy3.data?.data?.updated_access_policy
        )
    ) {
        throw new Error(
            "Access policy should be changed after alice.id resource_id changeset update."
        );
    }

    console.log(
        `Updated access policy 1 with alice.id resource_id changeset: ${updatedAccessPolicy3.data?.data?.updated_access_policy.id}`
    );
};
