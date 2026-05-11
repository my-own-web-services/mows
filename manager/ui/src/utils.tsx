import { toast } from "sonner";

export const notifySuccess = (header: string, message?: string) => {
    toast.success(header, { description: message });
};

export const notifyError = (header: string, message?: string) => {
    toast.error(header, { description: message });
};
