import { Badge } from "mows-components-react/components/ui/badge";

interface Props {
    readonly status: string;
    readonly className?: string;
}

/**
 * Maps a supervisor status string to one of the lib's semantic Badge
 * variants. Using the lib's `Badge` (not custom CSS) keeps every MOWS app
 * consistent — the only thing app-specific here is the status → variant
 * map, which is intentionally inline because the status vocabulary is
 * supervisor-specific.
 */
const variantFor = (status: string): "success" | "warning" | "destructive" | "muted" => {
    switch (status) {
        case "running":
            return "success";
        case "starting":
        case "stopping":
            return "warning";
        case "failed":
            return "destructive";
        default:
            return "muted";
    }
};

const StatusBadge = ({ status, className }: Props) => (
    <Badge variant={variantFor(status)} className={className}>
        {status}
    </Badge>
);

export default StatusBadge;
