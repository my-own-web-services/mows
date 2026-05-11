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
import { useContext, useState, type ReactNode } from "react";
import { toast, Toaster } from "sonner";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../lib/components/ui/tabs";
import { Textarea } from "../lib/components/ui/textarea";
import { MowsContext } from "../lib/lib/mowsContext/MowsContext";
import type { Translation } from "./languages";

type UiT = Translation[`example`][`ui`];

const useUi = (): UiT => {
    const ctx = useContext(MowsContext)!;
    return ctx.t.example.ui;
};

const Frame = ({ description, children }: { description: string; children: ReactNode }) => (
    <div className={`flex flex-col gap-4`}>
        <p className={`text-sm text-muted-foreground`}>{description}</p>
        <div className={`rounded-md border bg-card p-6`}>{children}</div>
    </div>
);

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className={`flex flex-col gap-1`}>
        <code className={`text-xs text-muted-foreground`}>{label}</code>
        <div className={`flex flex-wrap items-center gap-2`}>{children}</div>
    </div>
);

// ---- Button ----
const ButtonDemo = () => {
    const ui = useUi();
    const variants = [
        `default`,
        `secondary`,
        `outline`,
        `destructive`,
        `ghost`,
        `link`,
        `iconStandalone`
    ] as const;
    const sizes = [`sm`, `default`, `lg`] as const;
    return (
        <Frame description={ui.button.description}>
            <div className={`flex flex-col gap-4`}>
                <Row label={`variant`}>
                    {variants.map((v) => (
                        <Button key={v} variant={v}>
                            {v}
                        </Button>
                    ))}
                </Row>
                <Row label={`size`}>
                    {sizes.map((s) => (
                        <Button key={s} size={s}>
                            {s}
                        </Button>
                    ))}
                    <Button size={`icon`} aria-label={ui.button.iconButtonAriaLabel}>
                        <Settings />
                    </Button>
                </Row>
                <Row label={`disabled`}>
                    <Button disabled>{ui.button.disabledLabel}</Button>
                </Row>
            </div>
        </Frame>
    );
};

// ---- Badge ----
const BadgeDemo = () => {
    const ui = useUi();
    const variants = [`default`, `secondary`, `outline`, `destructive`] as const;
    return (
        <Frame description={ui.badge.description}>
            <div className={`flex flex-wrap gap-2`}>
                {variants.map((v) => (
                    <Badge key={v} variant={v}>
                        {v}
                    </Badge>
                ))}
            </div>
        </Frame>
    );
};

// ---- Card ----
const CardDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.card.description}>
            <Card className={`max-w-sm`}>
                <CardHeader>
                    <CardTitle>{ui.card.title}</CardTitle>
                    <CardDescription>{ui.card.descriptionText}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className={`text-sm`}>{ui.card.body}</p>
                </CardContent>
                <CardFooter className={`gap-2`}>
                    <Button>{ui.card.confirm}</Button>
                    <Button variant={`outline`}>{ui.card.cancel}</Button>
                </CardFooter>
            </Card>
        </Frame>
    );
};

// ---- Input / Textarea / Label ----
const InputDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.input.description}>
            <div className={`grid max-w-md grid-cols-1 gap-4`}>
                <div className={`flex flex-col gap-1.5`}>
                    <Label htmlFor={`demo-text`}>{ui.input.text}</Label>
                    <Input id={`demo-text`} placeholder={ui.input.placeholder} />
                </div>
                <div className={`flex flex-col gap-1.5`}>
                    <Label htmlFor={`demo-password`}>{ui.input.password}</Label>
                    <Input id={`demo-password`} type={`password`} />
                </div>
                <div className={`flex flex-col gap-1.5`}>
                    <Label htmlFor={`demo-disabled`}>{ui.input.disabled}</Label>
                    <Input id={`demo-disabled`} disabled value={ui.input.disabledValue} />
                </div>
            </div>
        </Frame>
    );
};

const TextareaDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.textarea.description}>
            <div className={`grid max-w-md grid-cols-1 gap-4`}>
                <Textarea placeholder={ui.textarea.placeholder} rows={4} />
                <Textarea disabled value={ui.textarea.disabledValue} rows={2} />
            </div>
        </Frame>
    );
};

const LabelDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.label.description}>
            <div className={`flex items-center gap-2`}>
                <Checkbox id={`demo-label-cb`} />
                <Label htmlFor={`demo-label-cb`}>{ui.label.text}</Label>
            </div>
        </Frame>
    );
};

// ---- Checkbox / Switch ----
const CheckboxDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.checkbox.description}>
            <div className={`flex flex-col gap-2`}>
                <div className={`flex items-center gap-2`}>
                    <Checkbox id={`cb-on`} defaultChecked />
                    <Label htmlFor={`cb-on`}>{ui.checkbox.checked}</Label>
                </div>
                <div className={`flex items-center gap-2`}>
                    <Checkbox id={`cb-off`} />
                    <Label htmlFor={`cb-off`}>{ui.checkbox.unchecked}</Label>
                </div>
                <div className={`flex items-center gap-2`}>
                    <Checkbox id={`cb-dis`} disabled />
                    <Label htmlFor={`cb-dis`}>{ui.checkbox.disabled}</Label>
                </div>
            </div>
        </Frame>
    );
};

const SwitchDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.switch.description}>
            <div className={`flex flex-col gap-2`}>
                <div className={`flex items-center gap-2`}>
                    <Switch id={`sw-on`} defaultChecked />
                    <Label htmlFor={`sw-on`}>{ui.switch.on}</Label>
                </div>
                <div className={`flex items-center gap-2`}>
                    <Switch id={`sw-off`} />
                    <Label htmlFor={`sw-off`}>{ui.switch.off}</Label>
                </div>
                <div className={`flex items-center gap-2`}>
                    <Switch id={`sw-dis`} disabled />
                    <Label htmlFor={`sw-dis`}>{ui.switch.disabled}</Label>
                </div>
            </div>
        </Frame>
    );
};

// ---- Select / RadioGroup ----
const SelectDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.select.description}>
            <div className={`max-w-xs`}>
                <Select>
                    <SelectTrigger>
                        <SelectValue placeholder={ui.select.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={`apple`}>{ui.select.apple}</SelectItem>
                        <SelectItem value={`banana`}>{ui.select.banana}</SelectItem>
                        <SelectItem value={`cherry`}>{ui.select.cherry}</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </Frame>
    );
};

const RadioGroupDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.radioGroup.description}>
            <RadioGroup defaultValue={`apple`} className={`flex flex-col gap-2`}>
                {[`apple`, `banana`, `cherry`].map((v) => (
                    <div key={v} className={`flex items-center gap-2`}>
                        <RadioGroupItem value={v} id={`rg-${v}`} />
                        <Label htmlFor={`rg-${v}`}>
                            {ui.radioGroup[v as `apple` | `banana` | `cherry`]}
                        </Label>
                    </div>
                ))}
            </RadioGroup>
        </Frame>
    );
};

// ---- Slider / Progress ----
const SliderDemo = () => {
    const ui = useUi();
    const [single, setSingle] = useState([42]);
    const [range, setRange] = useState([20, 80]);
    return (
        <Frame description={ui.slider.description}>
            <div className={`flex max-w-md flex-col gap-6`}>
                <div className={`flex flex-col gap-2`}>
                    <code className={`text-xs text-muted-foreground`}>
                        single: {single[0]}
                    </code>
                    <Slider value={single} onValueChange={setSingle} max={100} />
                </div>
                <div className={`flex flex-col gap-2`}>
                    <code className={`text-xs text-muted-foreground`}>
                        range: [{range[0]}, {range[1]}]
                    </code>
                    <Slider value={range} onValueChange={setRange} max={100} />
                </div>
            </div>
        </Frame>
    );
};

const ProgressDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.progress.description}>
            <div className={`flex max-w-md flex-col gap-3`}>
                {[0, 33, 66, 100].map((v) => (
                    <div key={v}>
                        <code className={`text-xs text-muted-foreground`}>{v}%</code>
                        <Progress value={v} />
                    </div>
                ))}
            </div>
        </Frame>
    );
};

// ---- Tabs ----
const TabsDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.tabs.description}>
            <Tabs defaultValue={`account`} className={`max-w-md`}>
                <TabsList>
                    <TabsTrigger value={`account`}>{ui.tabs.account}</TabsTrigger>
                    <TabsTrigger value={`password`}>{ui.tabs.password}</TabsTrigger>
                    <TabsTrigger value={`notifications`}>{ui.tabs.notifications}</TabsTrigger>
                </TabsList>
                <TabsContent value={`account`} className={`mt-3 text-sm`}>
                    {ui.tabs.accountBody}
                </TabsContent>
                <TabsContent value={`password`} className={`mt-3 text-sm`}>
                    {ui.tabs.passwordBody}
                </TabsContent>
                <TabsContent value={`notifications`} className={`mt-3 text-sm`}>
                    {ui.tabs.notificationsBody}
                </TabsContent>
            </Tabs>
        </Frame>
    );
};

// ---- Dialog ----
const DialogDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.dialog.description}>
            <Dialog>
                <DialogTrigger asChild>
                    <Button>{ui.dialog.open}</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{ui.dialog.title}</DialogTitle>
                        <DialogDescription>{ui.dialog.descriptionText}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant={`outline`}>{ui.dialog.cancel}</Button>
                        </DialogClose>
                        <DialogClose asChild>
                            <Button>{ui.dialog.confirm}</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Frame>
    );
};

// ---- Popover / HoverCard ----
const PopoverDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.popover.description}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant={`outline`}>{ui.popover.open}</Button>
                </PopoverTrigger>
                <PopoverContent className={`w-72`}>
                    <p className={`text-sm`}>{ui.popover.body}</p>
                </PopoverContent>
            </Popover>
        </Frame>
    );
};

const HoverCardDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.hoverCard.description}>
            <HoverCard>
                <HoverCardTrigger asChild>
                    <Button variant={`link`}>@{ui.hoverCard.handle}</Button>
                </HoverCardTrigger>
                <HoverCardContent className={`w-64`}>
                    <div className={`flex items-start gap-3`}>
                        <User className={`h-5 w-5`} />
                        <div className={`text-sm`}>
                            <div className={`font-medium`}>{ui.hoverCard.name}</div>
                            <p className={`text-muted-foreground`}>{ui.hoverCard.bio}</p>
                        </div>
                    </div>
                </HoverCardContent>
            </HoverCard>
        </Frame>
    );
};

// ---- DropdownMenu / ContextMenu ----
const DropdownMenuDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.dropdownMenu.description}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant={`outline`}>{ui.dropdownMenu.open}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>{ui.dropdownMenu.label}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                        <User className={`mr-2 h-4 w-4`} />
                        {ui.dropdownMenu.profile}
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <Settings className={`mr-2 h-4 w-4`} />
                        {ui.dropdownMenu.settings}
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <Bookmark className={`mr-2 h-4 w-4`} />
                        {ui.dropdownMenu.bookmarks}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </Frame>
    );
};

const ContextMenuDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.contextMenu.description}>
            <ContextMenu>
                <ContextMenuTrigger
                    className={`flex h-32 w-full items-center justify-center rounded-md border-2 border-dashed text-sm text-muted-foreground`}
                >
                    {ui.contextMenu.rightClick}
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem>
                        <Check className={`mr-2 h-4 w-4`} />
                        {ui.contextMenu.action1}
                    </ContextMenuItem>
                    <ContextMenuItem>{ui.contextMenu.action2}</ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem>{ui.contextMenu.action3}</ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        </Frame>
    );
};

// ---- Skeleton / ScrollArea / Resizable ----
const SkeletonDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.skeleton.description}>
            <div className={`flex max-w-md flex-col gap-3`}>
                <Skeleton className={`h-4 w-3/4`} />
                <Skeleton className={`h-4 w-1/2`} />
                <Skeleton className={`h-24 w-full`} />
            </div>
        </Frame>
    );
};

const ScrollAreaDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.scrollArea.description}>
            <ScrollArea className={`h-48 w-full max-w-md rounded-md border p-4`}>
                <div className={`flex flex-col gap-2 text-sm`}>
                    {Array.from({ length: 30 }, (_, i) => (
                        <div key={i}>
                            {ui.scrollArea.itemPrefix} {i + 1}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </Frame>
    );
};

const ResizableDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.resizable.description}>
            <ResizablePanelGroup
                direction={`horizontal`}
                className={`h-40 w-full rounded-md border`}
            >
                <ResizablePanel defaultSize={30}>
                    <div className={`flex h-full items-center justify-center text-sm`}>
                        {ui.resizable.panel} 1
                    </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={40}>
                    <div className={`flex h-full items-center justify-center text-sm`}>
                        {ui.resizable.panel} 2
                    </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={30}>
                    <div className={`flex h-full items-center justify-center text-sm`}>
                        {ui.resizable.panel} 3
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </Frame>
    );
};

// ---- Sonner ----
const SonnerDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.sonner.description}>
            <Toaster />
            <div className={`flex flex-wrap gap-2`}>
                <Button onClick={() => toast(ui.sonner.defaultMsg)}>
                    {ui.sonner.show}
                </Button>
                <Button
                    variant={`outline`}
                    onClick={() => toast.success(ui.sonner.successMsg)}
                >
                    {ui.sonner.showSuccess}
                </Button>
                <Button
                    variant={`destructive`}
                    onClick={() => toast.error(ui.sonner.errorMsg)}
                >
                    {ui.sonner.showError}
                </Button>
            </div>
        </Frame>
    );
};

// ---- InputGroup ----
const InputGroupDemo = () => {
    const ui = useUi();
    return (
        <Frame description={ui.inputGroup.description}>
            <div className={`flex max-w-md flex-col gap-3`}>
                <InputGroup>
                    <InputGroupAddon>
                        <Search className={`h-4 w-4`} />
                    </InputGroupAddon>
                    <InputGroupInput placeholder={ui.inputGroup.searchPlaceholder} />
                </InputGroup>
                <InputGroup>
                    <InputGroupAddon>
                        <AtSign className={`h-4 w-4`} />
                    </InputGroupAddon>
                    <InputGroupInput placeholder={ui.inputGroup.usernamePlaceholder} />
                </InputGroup>
                <InputGroup>
                    <InputGroupAddon>
                        <Mail className={`h-4 w-4`} />
                    </InputGroupAddon>
                    <InputGroupInput placeholder={ui.inputGroup.emailPlaceholder} />
                </InputGroup>
            </div>
        </Frame>
    );
};

// ---- Calendar ----
const CalendarDemo = () => {
    const ui = useUi();
    const [date, setDate] = useState<Date | undefined>(new Date());
    return (
        <Frame description={ui.calendar.description}>
            <div className={`flex max-w-fit flex-col gap-3 rounded-md border`}>
                <Calendar mode={`single`} selected={date} onSelect={setDate} />
            </div>
            <p className={`mt-3 text-sm text-muted-foreground`}>
                <CalendarIcon className={`mr-1 inline h-3 w-3`} />
                {date?.toLocaleDateString() ?? ui.calendar.empty}
            </p>
        </Frame>
    );
};

export interface UiDemoEntry {
    readonly id: string;
    readonly name: string;
    readonly render: () => ReactNode;
}

export const uiDemos: UiDemoEntry[] = [
    { id: `button`, name: `Button`, render: () => <ButtonDemo /> },
    { id: `badge`, name: `Badge`, render: () => <BadgeDemo /> },
    { id: `card`, name: `Card`, render: () => <CardDemo /> },
    { id: `input`, name: `Input`, render: () => <InputDemo /> },
    { id: `textarea`, name: `Textarea`, render: () => <TextareaDemo /> },
    { id: `label`, name: `Label`, render: () => <LabelDemo /> },
    { id: `checkbox`, name: `Checkbox`, render: () => <CheckboxDemo /> },
    { id: `switch`, name: `Switch`, render: () => <SwitchDemo /> },
    { id: `select`, name: `Select`, render: () => <SelectDemo /> },
    { id: `radioGroup`, name: `RadioGroup`, render: () => <RadioGroupDemo /> },
    { id: `slider`, name: `Slider`, render: () => <SliderDemo /> },
    { id: `progress`, name: `Progress`, render: () => <ProgressDemo /> },
    { id: `tabs`, name: `Tabs`, render: () => <TabsDemo /> },
    { id: `dialog`, name: `Dialog`, render: () => <DialogDemo /> },
    { id: `popover`, name: `Popover`, render: () => <PopoverDemo /> },
    { id: `hoverCard`, name: `HoverCard`, render: () => <HoverCardDemo /> },
    { id: `dropdownMenu`, name: `DropdownMenu`, render: () => <DropdownMenuDemo /> },
    { id: `contextMenu`, name: `ContextMenu`, render: () => <ContextMenuDemo /> },
    { id: `skeleton`, name: `Skeleton`, render: () => <SkeletonDemo /> },
    { id: `scrollArea`, name: `ScrollArea`, render: () => <ScrollAreaDemo /> },
    { id: `resizable`, name: `Resizable`, render: () => <ResizableDemo /> },
    { id: `sonner`, name: `Sonner`, render: () => <SonnerDemo /> },
    { id: `inputGroup`, name: `InputGroup`, render: () => <InputGroupDemo /> },
    { id: `calendar`, name: `Calendar`, render: () => <CalendarDemo /> }
];
