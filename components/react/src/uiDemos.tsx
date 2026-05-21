import {
    AtSign,
    Bookmark,
    Calendar as CalendarIcon,
    Check,
    Mail,
    Search,
    Settings,
    User
} from "lucide-react";
import { type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "../lib/components/ui/badge";
import { Button } from "../lib/components/ui/button";
import { Calendar } from "../lib/components/ui/calendar";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "../lib/components/ui/card";
import { Checkbox } from "../lib/components/ui/checkbox";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger
} from "../lib/components/ui/context-menu";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "../lib/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "../lib/components/ui/dropdown-menu";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger
} from "../lib/components/ui/hover-card";
import { Input } from "../lib/components/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput
} from "../lib/components/ui/input-group";
import { Label } from "../lib/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "../lib/components/ui/popover";
import { Progress } from "../lib/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "../lib/components/ui/radio-group";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup
} from "../lib/components/ui/resizable";
import { ScrollArea } from "../lib/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "../lib/components/ui/select";
import { Skeleton } from "../lib/components/ui/skeleton";
import { Slider } from "../lib/components/ui/slider";
import { Switch } from "../lib/components/ui/switch";
import { Textarea } from "../lib/components/ui/textarea";
import { MowsContext } from "../lib/lib/mowsContext/MowsContext";
import StepsDocPage from "./examples/steps/StepsDocPage";
import TabsDocPage from "./examples/tabs/TabsDocPage";
import SidebarDocPage from "./examples/sidebar/SidebarDocPage";
import BadgeDocPage from "./examples/badge/BadgeDocPage";
import ButtonDocPage from "./examples/button/ButtonDocPage";
import CardDocPage from "./examples/card/CardDocPage";
import CheckboxDocPage from "./examples/checkbox/CheckboxDocPage";
import SwitchDocPage from "./examples/switch/SwitchDocPage";
import InputDocPage from "./examples/input/InputDocPage";
import LabelDocPage from "./examples/label/LabelDocPage";
import TextareaDocPage from "./examples/textarea/TextareaDocPage";
import SkeletonDocPage from "./examples/skeleton/SkeletonDocPage";
import ProgressDocPage from "./examples/progress/ProgressDocPage";
import DialogDocPage from "./examples/dialog/DialogDocPage";
import PopoverDocPage from "./examples/popover/PopoverDocPage";
import ScrollAreaDocPage from "./examples/scrollArea/ScrollAreaDocPage";
import RadioGroupDocPage from "./examples/radioGroup/RadioGroupDocPage";
import SliderDocPage from "./examples/slider/SliderDocPage";
import ContextMenuDocPage from "./examples/contextMenu/ContextMenuDocPage";
import DropdownMenuDocPage from "./examples/dropdownMenu/DropdownMenuDocPage";
import HoverCardDocPage from "./examples/hoverCard/HoverCardDocPage";
import SelectDocPage from "./examples/select/SelectDocPage";
import SonnerDocPage from "./examples/sonner/SonnerDocPage";
import InputGroupDocPage from "./examples/inputGroup/InputGroupDocPage";
import ResizableDocPage from "./examples/resizable/ResizableDocPage";
import CalendarDocPage from "./examples/calendar/CalendarDocPage";
import CollapsibleDocPage from "./examples/collapsible/CollapsibleDocPage";

// ARCH-18/19: previous declarations (`useUi`, `Frame`, `Row`, `UiT`) were
// dead after the DocPage migration. They held the entire `example.ui`
// translation block alive via TypeScript — removing them lets a future
// pass delete that orphaned block too.

// ARCH-20: the `<DemoFrame>` / `useTranslations` / `ExampleT|DemosT|CommonT`
// scaffolding lived in `demos.tsx` for the same reason and is similarly
// safe to retire once it no longer has callers.

// Steps now ships a full shadcn-style documentation page: narrative
// sections (Installation / Usage / Composition), a stack of examples
// (Line / Vertical / Disabled / Icons), a Defined Behaviour table that
// pins statements to verified tests, an RTL showcase, and an API
// reference. The on-this-page rail is the nested <PageIndex>.
const StepsDemo = () => <StepsDocPage />;

export interface UiDemoEntry {
    readonly id: string;
    readonly name: string;
    readonly render: () => ReactNode;
    readonly searchTags?: readonly string[];
}

export const uiDemos: UiDemoEntry[] = [
    { id: `button`, name: `Button`, render: () => <ButtonDocPage /> },
    { id: `badge`, name: `Badge`, render: () => <BadgeDocPage /> },
    { id: `card`, name: `Card`, render: () => <CardDocPage /> },
    { id: `input`, name: `Input`, render: () => <InputDocPage /> },
    { id: `textarea`, name: `Textarea`, render: () => <TextareaDocPage /> },
    { id: `label`, name: `Label`, render: () => <LabelDocPage /> },
    { id: `checkbox`, name: `Checkbox`, render: () => <CheckboxDocPage /> },
    { id: `switch`, name: `Switch`, render: () => <SwitchDocPage /> },
    { id: `select`, name: `Select`, render: () => <SelectDocPage /> },
    { id: `radioGroup`, name: `RadioGroup`, render: () => <RadioGroupDocPage /> },
    { id: `slider`, name: `Slider`, render: () => <SliderDocPage />, searchTags: [`range`, `track`, `thumb`] },
    { id: `progress`, name: `Progress`, render: () => <ProgressDocPage /> },
    { id: `tabs`, name: `Tabs`, render: () => <TabsDocPage /> },
    { id: `sidebar`, name: `Sidebar`, render: () => <SidebarDocPage /> },
    { id: `dialog`, name: `Dialog`, render: () => <DialogDocPage /> },
    { id: `popover`, name: `Popover`, render: () => <PopoverDocPage /> },
    { id: `hoverCard`, name: `HoverCard`, render: () => <HoverCardDocPage /> },
    { id: `dropdownMenu`, name: `DropdownMenu`, render: () => <DropdownMenuDocPage /> },
    { id: `contextMenu`, name: `ContextMenu`, render: () => <ContextMenuDocPage /> },
    { id: `skeleton`, name: `Skeleton`, render: () => <SkeletonDocPage /> },
    { id: `scrollArea`, name: `ScrollArea`, render: () => <ScrollAreaDocPage /> },
    { id: `resizable`, name: `Resizable`, render: () => <ResizableDocPage /> },
    { id: `sonner`, name: `Sonner`, render: () => <SonnerDocPage /> },
    { id: `inputGroup`, name: `InputGroup`, render: () => <InputGroupDocPage /> },
    { id: `calendar`, name: `Calendar`, render: () => <CalendarDocPage /> },
    { id: `collapsible`, name: `Collapsible`, render: () => <CollapsibleDocPage />, searchTags: [`accordion`, `disclosure`, `expand`] },
    { id: `steps`, name: `Steps`, render: () => <StepsDemo /> }
];
