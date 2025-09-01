import {
    AccessPolicyAction,
    AccessPolicyEffect,
    AccessPolicyResourceType,
    AccessPolicySubjectType,
    Api,
    createExampleUser,
    defaultAppId,
    FileGroupType,
    impersonateUser
} from "filez-client-typescript";

export default async (filezClient: Api<unknown>) => {
    const alice = await createExampleUser(filezClient);
    console.log(`Created users: Alice (${alice.id})`);

    const impersonateAliceParams = {
        headers: {
            ...impersonateUser(alice.id)
        }
    };

    const bob = await createExampleUser(filezClient);
    console.log(`Created users: Bob (${bob.id})`);

    const impersonateBobParams = {
        headers: {
            ...impersonateUser(bob.id)
        }
    };

    // Create 10 files for Alice
    const createdAliceFiles = [];
    for (let i = 0; i < 10; i++) {
        const aliceFile = (
            await filezClient.api.createFile(
                {
                    file_name: `alice_file_${i + 1}.txt`
                },
                impersonateAliceParams
            )
        ).data?.data?.created_file;
        if (!aliceFile) {
            throw new Error(`Failed to upload file alice_file_${i + 1}.txt for Alice.`);
        }
        console.log(`Uploaded file for Alice: ${aliceFile.id}`);
        createdAliceFiles.push(aliceFile);
    }

    // Create a file group and add Alice's file to it
    const aliceFileGroup = (
        await filezClient.api.createFileGroup(
            {
                file_group_name: "Alice's File Group",
                file_group_type: FileGroupType.Manual
            },
            impersonateAliceParams
        )
    ).data?.data?.created_file_group;

    if (!aliceFileGroup) {
        throw new Error("Failed to create file group for Alice.");
    }

    console.log(`Created file group for Alice: ${aliceFileGroup.id}`);

    // Add all created files to Alice's file group

    await filezClient.api.updateFileGroupMembers(
        {
            file_group_id: aliceFileGroup.id,
            files_to_add: createdAliceFiles.map((file) => file.id)
        },
        impersonateAliceParams
    );

    console.log(`Added files to Alice's file group: ${aliceFileGroup.id}`);

    // List files as Alice
    const aliceFileList = (
        await filezClient.api.listFilesInFileGroup(
            {
                file_group_id: aliceFileGroup.id
            },
            impersonateAliceParams
        )
    ).data?.data?.files;

    if (!aliceFileList) {
        throw new Error("Failed to list files for Alice.");
    }

    console.log(`Listed files for Alice: ${aliceFileList.length} files found.`);

    if (aliceFileList.length !== createdAliceFiles.length) {
        throw new Error(
            `File count mismatch for Alice. Expected ${createdAliceFiles.length}, got ${aliceFileList.length}.`
        );
    }

    // Check if Bob can see Alice's files
    const bobFileListShouldFail = await filezClient.api
        .listFilesInFileGroup(
            {
                file_group_id: aliceFileGroup.id
            },
            impersonateBobParams
        )
        .catch((response) => {
            if (response.status !== 403) {
                throw new Error(`Expected 403 Forbidden, got ${response.status}`);
            }
        });

    if (bobFileListShouldFail) {
        throw new Error("Bob should not be able to list Alice's files without an access policy.");
    }

    console.log("Bob cannot list Alice's files as expected.");

    // Create a access policy to allow Bob to view files in Alice's file group
    const aliceAccessPolicy = (
        await filezClient.api.createAccessPolicy(
            {
                access_policy_name: "Alice's Access Policy",
                access_policy_actions: [AccessPolicyAction.FileGroupsListFiles],
                access_policy_effect: AccessPolicyEffect.Allow,
                access_policy_resource_type: AccessPolicyResourceType.FileGroup,
                access_policy_subject_id: bob.id,
                access_policy_subject_type: AccessPolicySubjectType.User,
                context_app_ids: [defaultAppId],
                resource_id: aliceFileGroup.id
            },
            impersonateAliceParams
        )
    ).data?.data?.created_access_policy;

    if (!aliceAccessPolicy) {
        throw new Error("Failed to create access policy for Alice.");
    }

    console.log(`Created access policy for Alice: ${aliceAccessPolicy.id}`);

    // Check if Bob can see Alice's files now

    const bobFileList = (
        await filezClient.api.listFilesInFileGroup(
            {
                file_group_id: aliceFileGroup.id
            },
            impersonateBobParams
        )
    ).data?.data?.files;

    if (!bobFileList) {
        throw new Error("Failed to list files for Bob.");
    }
    console.log(`Listed files for Bob: ${bobFileList.length} files found.`);

    if (bobFileList.length !== createdAliceFiles.length) {
        throw new Error(
            `File count mismatch for Bob. Expected ${createdAliceFiles.length}, got ${bobFileList.length}.`
        );
    }

    console.log("Bob can list Alice's files as expected.");

    // Create a access policy explicitly denying Bob to view files in Alice's file group
    const denyAliceAccessPolicy = (
        await filezClient.api.createAccessPolicy(
            {
                access_policy_name: "Deny Alice's Access Policy",
                access_policy_actions: [AccessPolicyAction.FileGroupsListFiles],
                access_policy_effect: AccessPolicyEffect.Deny,
                access_policy_resource_type: AccessPolicyResourceType.FileGroup,
                access_policy_subject_id: bob.id,
                access_policy_subject_type: AccessPolicySubjectType.User,
                context_app_ids: [defaultAppId],
                resource_id: aliceFileGroup.id
            },
            impersonateAliceParams
        )
    ).data?.data?.created_access_policy;
    if (!denyAliceAccessPolicy) {
        throw new Error("Failed to create deny access policy for Alice.");
    }
    console.log(`Created deny access policy for Alice: ${denyAliceAccessPolicy.id}`);
    // Check if Bob can see Alice's files now
    const bobFileListShouldFailAgain = await filezClient.api
        .listFilesInFileGroup(
            {
                file_group_id: aliceFileGroup.id
            },
            impersonateBobParams
        )
        .catch((response) => {
            if (response.status !== 403) {
                throw new Error(`Expected 403 Forbidden, got ${response.status}`);
            }
        });
    if (bobFileListShouldFailAgain) {
        throw new Error("Bob should not be able to list Alice's files after deny access policy.");
    }
    console.log("Bob cannot list Alice's files after deny access policy as expected.");

    // Delete both access policies
    await filezClient.api.deleteAccessPolicy(aliceAccessPolicy.id, impersonateAliceParams);
    await filezClient.api.deleteAccessPolicy(denyAliceAccessPolicy.id, impersonateAliceParams);
    console.log("Deleted both access policies.");

    // Check if Bob can see Alice's files now

    const bobFileListShouldFailFinally = await filezClient.api
        .listFilesInFileGroup(
            {
                file_group_id: aliceFileGroup.id
            },
            impersonateBobParams
        )
        .catch((response) => {
            if (response.status !== 403) {
                throw new Error(`Expected 403 Forbidden, got ${response.status}`);
            }
        });
    if (bobFileListShouldFailFinally) {
        throw new Error(
            "Bob should not be able to list Alice's files after both access policies are deleted."
        );
    }
    console.log(
        "Bob cannot list Alice's files after both access policies are deleted as expected."
    );

    // create a user group and add Bob to it
    const userGroup = (
        await filezClient.api.createUserGroup(
            {
                user_group_name: "Alice vacation group"
            },
            impersonateAliceParams
        )
    ).data?.data?.created_user_group;
    if (!userGroup) {
        throw new Error("Failed to create user group.");
    }
    console.log(`Created user group: ${userGroup.id}`);

    await filezClient.api.updateUserGroupMembers(
        {
            user_group_id: userGroup.id,
            users_to_add: [bob.id]
        },
        impersonateAliceParams
    );

    // check if Bob can see alice's files (he should not)
    const bobFileListShouldFailYetAgain = await filezClient.api
        .listFilesInFileGroup(
            {
                file_group_id: aliceFileGroup.id
            },
            impersonateBobParams
        )
        .catch((response) => {
            if (response.status !== 403) {
                throw new Error(`Expected 403 Forbidden, got ${response.status}`);
            }
        });
    if (bobFileListShouldFailYetAgain) {
        throw new Error("Bob should not be able to list Alice's files before group access policy.");
    }

    console.log("Bob cannot list Alice's files before group access policy as expected.");

    console.log(`Added Bob to user group: ${userGroup.id}`);
    // Create a access policy to allow the user group to view files in Alice's file group
    const groupAccessPolicy = (
        await filezClient.api.createAccessPolicy(
            {
                access_policy_name: "Group Access Policy",
                access_policy_actions: [AccessPolicyAction.FileGroupsListFiles],
                access_policy_effect: AccessPolicyEffect.Allow,
                access_policy_resource_type: AccessPolicyResourceType.FileGroup,
                access_policy_subject_id: userGroup.id,
                access_policy_subject_type: AccessPolicySubjectType.UserGroup,
                context_app_ids: [defaultAppId],
                resource_id: aliceFileGroup.id
            },
            impersonateAliceParams
        )
    ).data?.data?.created_access_policy;
    if (!groupAccessPolicy) {
        throw new Error("Failed to create group access policy.");
    }
    console.log(`Created group access policy: ${groupAccessPolicy.id}`);

    // Check if Bob can see Alice's files now
    const bobFileListViaGroup = (
        await filezClient.api.listFilesInFileGroup(
            {
                file_group_id: aliceFileGroup.id
            },
            impersonateBobParams
        )
    ).data?.data?.files;
    if (!bobFileListViaGroup) {
        throw new Error("Failed to list files for Bob via group.");
    }
    console.log(`Listed files for Bob via group: ${bobFileListViaGroup.length} files found.`);
    if (bobFileListViaGroup.length !== createdAliceFiles.length) {
        throw new Error(
            `File count mismatch for Bob via group. Expected ${createdAliceFiles.length}, got ${bobFileListViaGroup.length}.`
        );
    }
    console.log("Bob can list Alice's files via group as expected.");

    // Create explicit deny access policy for bob

    const denyBobAccessPolicyOverridingGroup = (
        await filezClient.api.createAccessPolicy(
            {
                access_policy_name: "Deny Bob Access Policy Overriding Group",
                access_policy_actions: [AccessPolicyAction.FileGroupsListFiles],
                access_policy_effect: AccessPolicyEffect.Deny,
                access_policy_resource_type: AccessPolicyResourceType.FileGroup,
                access_policy_subject_id: bob.id,
                access_policy_subject_type: AccessPolicySubjectType.User,
                context_app_ids: [defaultAppId],
                resource_id: aliceFileGroup.id
            },
            impersonateAliceParams
        )
    ).data?.data?.created_access_policy;
    if (!denyBobAccessPolicyOverridingGroup) {
        throw new Error("Failed to create deny access policy for Bob overriding group.");
    }
    console.log(
        `Created deny access policy for Bob overriding group: ${denyBobAccessPolicyOverridingGroup.id}`
    );

    // Check if Bob can see Alice's files now

    const bobFileListShouldFailDueToDeny = await filezClient.api
        .listFilesInFileGroup(
            {
                file_group_id: aliceFileGroup.id
            },
            impersonateBobParams
        )
        .catch((response) => {
            if (response.status !== 403) {
                throw new Error(`Expected 403 Forbidden, got ${response.status}`);
            }
        });
    if (bobFileListShouldFailDueToDeny) {
        throw new Error(
            "Bob should not be able to list Alice's files after deny access policy overriding group."
        );
    }
    console.log(
        "Bob cannot list Alice's files after deny access policy overriding group as expected."
    );

    // delete all access policies
    await filezClient.api.deleteAccessPolicy(groupAccessPolicy.id, impersonateAliceParams);
    await filezClient.api.deleteAccessPolicy(
        denyBobAccessPolicyOverridingGroup.id,
        impersonateAliceParams
    );
    console.log("Deleted all access policies.");

    // Check if Bob can see Alice's files now

    const bobFileListShouldFailAfterAllDeleted = await filezClient.api
        .listFilesInFileGroup(
            {
                file_group_id: aliceFileGroup.id
            },
            impersonateBobParams
        )
        .catch((response) => {
            if (response.status !== 403) {
                throw new Error(`Expected 403 Forbidden, got ${response.status}`);
            }
        });
    if (bobFileListShouldFailAfterAllDeleted) {
        throw new Error(
            "Bob should not be able to list Alice's files after all access policies are deleted."
        );
    }
    console.log("Bob cannot list Alice's files after all access policies are deleted as expected.");

    // check if bob can give himself access by creating an access policy (he should not be able to)
    const bobCreatingAccessPolicyShouldFail = await filezClient.api
        .createAccessPolicy(
            {
                access_policy_name: "Bob's Access Policy",
                access_policy_actions: [AccessPolicyAction.FileGroupsListFiles],
                access_policy_effect: AccessPolicyEffect.Allow,
                access_policy_resource_type: AccessPolicyResourceType.FileGroup,
                access_policy_subject_id: bob.id,
                access_policy_subject_type: AccessPolicySubjectType.User,
                context_app_ids: [defaultAppId],
                resource_id: aliceFileGroup.id
            },
            impersonateBobParams
        )
        .catch((response) => {
            if (response.status !== 403) {
                throw new Error(`Expected 403 Forbidden, got ${response.status}`);
            }
        });

    if (bobCreatingAccessPolicyShouldFail) {
        throw new Error(
            "Bob should not be able to create an access policy for Alice's file group."
        );
    }
    console.log("Bob cannot create an access policy for Alice's file group as expected.");

    // Create a user group as bob and add alice to it, this should work

    const bobUserGroup = (
        await filezClient.api.createUserGroup(
            {
                user_group_name: "Bob's Group"
            },
            impersonateBobParams
        )
    ).data?.data?.created_user_group;
    if (!bobUserGroup) {
        throw new Error("Failed to create user group as Bob.");
    }
    console.log(`Created user group as Bob: ${bobUserGroup.id}`);
    await filezClient.api.updateUserGroupMembers(
        {
            user_group_id: bobUserGroup.id,
            users_to_add: [alice.id]
        },
        impersonateBobParams
    );
    console.log(`Added Alice to Bob's user group: ${bobUserGroup.id}`);

    // try to create an access policy that allows bob's user group to access alice's file group, this should fail

    const bobGroupCreatingAccessPolicyShouldFail = await filezClient.api
        .createAccessPolicy(
            {
                access_policy_name: "Bob's Group Access Policy",
                access_policy_actions: [AccessPolicyAction.FileGroupsListFiles],
                access_policy_effect: AccessPolicyEffect.Allow,
                access_policy_resource_type: AccessPolicyResourceType.FileGroup,
                access_policy_subject_id: bobUserGroup.id,
                access_policy_subject_type: AccessPolicySubjectType.UserGroup,
                context_app_ids: [defaultAppId],
                resource_id: aliceFileGroup.id
            },
            impersonateBobParams
        )
        .catch((response) => {
            if (response.status !== 403) {
                throw new Error(`Expected 403 Forbidden, got ${response.status}`);
            }
        });
    if (bobGroupCreatingAccessPolicyShouldFail) {
        throw new Error(
            "Bob should not be able to create an access policy for Alice's file group using his user group."
        );
    }
    console.log(
        "Bob cannot create an access policy for Alice's file group using his user group as expected."
    );

    // Create new user Larry
    const larry = await createExampleUser(filezClient);
    console.log(`Created users: Larry (${larry.id})`);

    // try as Alice to add Larry to Bob's user group, this should fail
    const aliceAddingLarryToBobsGroupShouldFail = await filezClient.api
        .updateUserGroupMembers(
            {
                user_group_id: bobUserGroup.id,
                users_to_add: [larry.id]
            },
            impersonateAliceParams
        )
        .catch((response) => {
            if (response.status !== 403) {
                throw new Error(`Expected 403 Forbidden, got ${response.status}`);
            }
        });
    if (aliceAddingLarryToBobsGroupShouldFail) {
        throw new Error("Alice should not be able to add Larry to Bob's user group.");
    }
    console.log("Alice cannot add Larry to Bob's user group as expected.");
};
