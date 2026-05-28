import { createRoot } from "react-dom/client";
import {
    ColumnListRowHandler,
    ResourceList,
    type ListResourceResponseBody
} from "@my-own-web-services/react-components";
import "@my-own-web-services/react-components/main.css";
import "../../main.css";

// ResourceList is the heaviest "data display" component in the lib —
// react-dnd, virtualizer, sort/filter pipeline. A second heavy scenario
// (alongside CodeViewer/Monaco) confirms that lightweight scenarios
// don't accidentally drag in ResourceList's deps either.
interface Row {
    id: string;
    name: string;
}

const handlers = [
    new ColumnListRowHandler<Row>({
        name: `default`,
        columns: [{ field: `name`, label: `Name` }]
    })
];

createRoot(document.getElementById(`root`)!).render(
    <ResourceList<Row>
        listInstanceId="treeshake-resource-list"
        resourceType="row"
        rowHandlers={handlers}
        initialRowHandler="default"
        getResourcesList={async (): Promise<ListResourceResponseBody<Row>> => ({
            items: [],
            totalCount: 0
        })}
    />
);
