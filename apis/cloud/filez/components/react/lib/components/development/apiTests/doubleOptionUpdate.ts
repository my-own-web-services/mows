import {
    AccessPolicyEffect,
    AccessPolicyResourceType,
    AccessPolicySubjectType,
    Api,
    createExampleUser
} from "filez-client-typescript";
import { isEqual, omit } from "lodash";
import { log } from "@mows/react-components/lib/logging";

// `modified_time` is bumped on every write, so comparing two policies
// across an update always differs there even when nothing else changed.
// Project to a stable view (no mutation of the underlying response, no
// `@ts-ignore delete`) before any `isEqual` check (SLOP-51).
const stablePolicyView = <T extends Record<string, unknown>>(policy: T) =>
    omit(policy, [`modified_time`]);

export default async (filezClient: Api<unknown>) => {
    const alice = await createExampleUser(filezClient);

    const accessPolicy1 = await filezClient.api.createAccessPolicy({
        access_policy_actions: [],
        access_policy_effect: AccessPolicyEffect.Deny,
        access_policy_name: `Test policy 1`,
        access_policy_resource_type: AccessPolicyResourceType.User,
        access_policy_subject_id: alice.id,
        access_policy_subject_type: AccessPolicySubjectType.User,
        context_app_ids: [],
        resource_id: alice.id
    });

    if (!accessPolicy1.data?.data?.created_access_policy) {
        throw new Error(`Failed to create access policy.`);
    }
    // Capture the typed policy once so we don't combine `?.` (returns
    // undefined) with `!` (lies about it) on every later access
    // (SLOP-55). The early-return above guarantees this is defined.
    const createdPolicy1 = accessPolicy1.data.data.created_access_policy;

    log.info(`Created access policy 1: ${createdPolicy1.id}`);

    const updatedAccessPolicy1 = await filezClient.api.updateAccessPolicy({
        access_policy_id: createdPolicy1.id,
        changeset: {}
    });

    if (!updatedAccessPolicy1.data?.data?.updated_access_policy) {
        throw new Error(`Failed to update access policy with empty changeset.`);
    }
    const updatedPolicy1 = updatedAccessPolicy1.data.data.updated_access_policy;

    log.info(`Updated access policy 1 with empty changeset: ${updatedPolicy1.id}`);

    if (!isEqual(stablePolicyView(createdPolicy1), stablePolicyView(updatedPolicy1))) {
        throw new Error(`Access policy should be unchanged after empty changeset update.`);
    }

    const updatedAccessPolicy2 = await filezClient.api.updateAccessPolicy({
        access_policy_id: createdPolicy1.id,
        changeset: {
            new_resource_id: null
        }
    });

    if (!updatedAccessPolicy2.data?.data?.updated_access_policy) {
        throw new Error(`Failed to update access policy with null resource_id changeset.`);
    }
    const updatedPolicy2 = updatedAccessPolicy2.data.data.updated_access_policy;

    log.info(`Updated access policy 1 with null resource_id changeset: ${updatedPolicy2.id}`);
    if (isEqual(stablePolicyView(createdPolicy1), stablePolicyView(updatedPolicy2))) {
        throw new Error(`Access policy should be changed after null resource_id changeset update.`);
    }

    if (updatedPolicy2.resource_id !== null) {
        throw new Error(`Access policy resource_id should be null after update.`);
    }

    // set the resource_id back to alice.id
    const updatedAccessPolicy3 = await filezClient.api.updateAccessPolicy({
        access_policy_id: createdPolicy1.id,
        changeset: {
            new_resource_id: alice.id
        }
    });

    if (!updatedAccessPolicy3.data?.data?.updated_access_policy) {
        throw new Error(`Failed to update access policy with alice.id resource_id changeset.`);
    }
    const updatedPolicy3 = updatedAccessPolicy3.data.data.updated_access_policy;

    if (isEqual(stablePolicyView(updatedPolicy2), stablePolicyView(updatedPolicy3))) {
        throw new Error(
            `Access policy should be changed after alice.id resource_id changeset update.`
        );
    }

    log.info(
        `Updated access policy 1 with alice.id resource_id changeset: ${updatedPolicy3.id}`
    );
};
