import { useMows } from "mows-components-react/lib/mowsContext/MowsContext";
import { VncScreen } from "react-vnc";
import { displayWsUrl } from "../lib/api";

interface Props {
    readonly vmId: string;
}

const VmDisplay = ({ vmId }: Props) => {
    const { t } = useMows();
    return (
        <div className="bg-card flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md">
            <VncScreen
                url={displayWsUrl(vmId)}
                scaleViewport
                background="#000"
                loadingUI={
                    <div className="text-muted-foreground text-xs">
                        {t.supervisor.display.connecting}
                    </div>
                }
                style={{ width: "100%", height: "100%" }}
            />
        </div>
    );
};

export default VmDisplay;
