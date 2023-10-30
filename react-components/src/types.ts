import { PureComponent } from "react";
import { FilezContext } from "./FilezProvider";

interface EditResourceProps {
    readonly resourceIds?: string[];
}

interface EditResourceState {}

export abstract class EditResource extends PureComponent<EditResourceProps, EditResourceState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    abstract update(): Promise<boolean>;
}
