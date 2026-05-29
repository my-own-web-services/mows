import { GroupJoinPolicy, GroupVisibility } from "filez-client-typescript";
import type { Translation } from "@/lib/languages";

type GroupTaxonomyLabels = Translation["userGroupList"];

export const mapGroupVisibilityLabel = (
    visibility: GroupVisibility,
    labels: GroupTaxonomyLabels["visibility"]
): string => {
    switch (visibility) {
        case GroupVisibility.Private:
            return labels.private;
        case GroupVisibility.ListedRestricted:
            return labels.listedRestricted;
        case GroupVisibility.Public:
            return labels.public;
    }
};

export const mapGroupJoinPolicyLabel = (
    joinPolicy: GroupJoinPolicy,
    labels: GroupTaxonomyLabels["joinPolicy"]
): string => {
    switch (joinPolicy) {
        case GroupJoinPolicy.InviteOnly:
            return labels.inviteOnly;
        case GroupJoinPolicy.RequestToJoin:
            return labels.requestToJoin;
        case GroupJoinPolicy.OpenJoin:
            return labels.openJoin;
    }
};
