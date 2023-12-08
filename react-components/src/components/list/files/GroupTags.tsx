import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";
import { useContext, useEffect, useState } from "react";
import { FilezContext } from "../../../FilezProvider";
import { Tag } from "rsuite";

export const GroupTags = ({ file }: { file: FilezFile }) => {
    const [groups, setGroups] = useState<FilezFileGroup[]>([]);
    const context = useContext(FilezContext);

    useEffect(() => {
        context?.filezClient.get_file_groups(file.static_file_group_ids).then(setGroups);
    }, [file]); // passing the context here would re render every time the context changes

    return (
        <span>
            {file.static_file_group_ids.map(id => {
                const group = groups.find(g => g._id === id);
                return (
                    <Tag size="xs" key={id}>
                        {group?.name ?? group?._id}
                    </Tag>
                );
            })}
        </span>
    );
};
