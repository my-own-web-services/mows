import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { FilezProvider } from "@/main";
import Upload, { type UploadFile } from "./Upload";

// Mock translation
const mockTranslation = {
    upload: {
        dropFilesHere: "Drop files here",
        dropFoldersHere: "Drop folders here",
        orClickToSelect: "or click to select files",
        orClickToSelectFolder: "or click to select folder",
        selectFiles: "Select files to upload",
        removeFile: "Remove file",
        uploadFiles: "Upload Files",
        dropFilesOrFoldersHere: "Drop files or folders here",
        orUseButtonsBelow: "or use the buttons below to select",
        status: {
            pending: "Pending",
            uploading: "Uploading",
            completed: "Completed",
            error: "Error"
        }
    }
};

const MockFilezProvider = ({ children }: { children: React.ReactNode }) => (
    <FilezProvider>
        {children}
    </FilezProvider>
);

// Helper to create File objects for testing
const createMockFile = (name: string, size: number, type: string = "text/plain"): File => {
    const file = new File(["file content"], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
};

describe("Upload", () => {
    it("renders upload area with default content", async () => {
        const onUpload = vi.fn();

        render(
            <MockFilezProvider>
                <Upload onUpload={onUpload} />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByText("Drop files or folders here")).toBeInTheDocument();
            expect(screen.getByText("or use the buttons below to select")).toBeInTheDocument();
            expect(screen.getByText("Select files to upload")).toBeInTheDocument();
            expect(screen.getByText("or click to select folder")).toBeInTheDocument();
        });
    });

    it("shows selected files and upload button when files are selected", async () => {
        const onUpload = vi.fn();
        const user = userEvent.setup();

        render(
            <MockFilezProvider>
                <Upload onUpload={onUpload} />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByText("Drop files or folders here")).toBeInTheDocument();
        });

        const file = createMockFile("test.txt", 1024);
        // Get the hidden file input (first one for files)
        const fileInputs = document.querySelectorAll('input[type="file"]');
        const fileInput = fileInputs[0] as HTMLInputElement;

        await user.upload(fileInput, file);

        await waitFor(() => {
            expect(screen.getByText("test.txt")).toBeInTheDocument();
            expect(screen.getByText("1 KB")).toBeInTheDocument();
            expect(screen.getByText("Upload Files")).toBeInTheDocument();
            expect(screen.getByText("Pending")).toBeInTheDocument();
        });

        // Should not call onUpload until button is clicked
        expect(onUpload).not.toHaveBeenCalled();
    });

    it("calls onUpload when upload button is clicked", async () => {
        const onUpload = vi.fn();
        const user = userEvent.setup();

        render(
            <MockFilezProvider>
                <Upload onUpload={onUpload} />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByText("Drop files or folders here")).toBeInTheDocument();
        });

        const file = createMockFile("test.txt", 1024);
        const fileInputs = document.querySelectorAll('input[type="file"]');
        const fileInput = fileInputs[0] as HTMLInputElement;

        await user.upload(fileInput, file);

        await waitFor(() => {
            expect(screen.getByText("Upload Files")).toBeInTheDocument();
        });

        const uploadButton = screen.getByText("Upload Files");
        await user.click(uploadButton);

        expect(onUpload).toHaveBeenCalledWith([file]);
    });

    it("handles drag and drop events", async () => {
        const onUpload = vi.fn();

        render(
            <MockFilezProvider>
                <Upload onUpload={onUpload}  />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByText("Drop files or folders here")).toBeInTheDocument();
        });

        const uploadArea = document.querySelector('.Upload > div') as HTMLElement;
        const file = createMockFile("test.txt", 1024);

        // Create a mock DataTransfer
        const dataTransfer = {
            files: [file]
        };

        // Simulate drag enter
        fireEvent.dragEnter(uploadArea, { dataTransfer });

        // Simulate drop
        fireEvent.drop(uploadArea, { dataTransfer });

        await waitFor(() => {
            expect(screen.getByText("test.txt")).toBeInTheDocument();
        });

        // Should not call onUpload until button is clicked
        expect(onUpload).not.toHaveBeenCalled();
    });

    it("filters files by accept type", async () => {
        const onUpload = vi.fn();
        const user = userEvent.setup();

        render(
            <MockFilezProvider>
                <Upload onUpload={onUpload} accept=".txt"  />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByText("Drop files or folders here")).toBeInTheDocument();
        });

        const txtFile = createMockFile("test.txt", 1024);
        const pdfFile = createMockFile("test.pdf", 1024, "application/pdf");

        const fileInputs = document.querySelectorAll('input[type="file"]');
        const input = fileInputs[0] as HTMLInputElement;

        await user.upload(input, [txtFile, pdfFile]);

        await waitFor(() => {
            expect(screen.getByText("test.txt")).toBeInTheDocument();
        });

        // Should only show the txt file
        expect(screen.queryByText("test.pdf")).not.toBeInTheDocument();
    });

    it("filters files by max size", async () => {
        const onUpload = vi.fn();
        const user = userEvent.setup();

        render(
            <MockFilezProvider>
                <Upload onUpload={onUpload} maxSize={1000}  />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByText("Drop files or folders here")).toBeInTheDocument();
        });

        const smallFile = createMockFile("small.txt", 500);
        const largeFile = createMockFile("large.txt", 2000);

        const fileInputs = document.querySelectorAll('input[type="file"]');
        const input = fileInputs[0] as HTMLInputElement;

        await user.upload(input, [smallFile, largeFile]);

        await waitFor(() => {
            expect(screen.getByText("small.txt")).toBeInTheDocument();
        });

        // Should only show the small file
        expect(screen.queryByText("large.txt")).not.toBeInTheDocument();
    });

    it("allows multiple files by default", async () => {
        const onUpload = vi.fn();
        const user = userEvent.setup();

        render(
            <MockFilezProvider>
                <Upload onUpload={onUpload}  />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByText("Drop files or folders here")).toBeInTheDocument();
        });

        const file1 = createMockFile("test1.txt", 1024);
        const file2 = createMockFile("test2.txt", 1024);

        const fileInputs = document.querySelectorAll('input[type="file"]');
        const input = fileInputs[0] as HTMLInputElement;

        await user.upload(input, [file1, file2]);

        await waitFor(() => {
            expect(screen.getByText("test1.txt")).toBeInTheDocument();
            expect(screen.getByText("test2.txt")).toBeInTheDocument();
        });

        // Should show both files
        expect(screen.getByText("test1.txt")).toBeInTheDocument();
        expect(screen.getByText("test2.txt")).toBeInTheDocument();
    });

    it("limits to single file when multiple is false", async () => {
        const onUpload = vi.fn();
        const user = userEvent.setup();

        render(
            <MockFilezProvider>
                <Upload onUpload={onUpload} multiple={false}  />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByText("Drop files or folders here")).toBeInTheDocument();
        });

        const file1 = createMockFile("test1.txt", 1024);
        const file2 = createMockFile("test2.txt", 1024);

        const fileInputs = document.querySelectorAll('input[type="file"]');
        const input = fileInputs[0] as HTMLInputElement;

        await user.upload(input, [file1, file2]);

        await waitFor(() => {
            expect(screen.getByText("test1.txt")).toBeInTheDocument();
        });

        // Should only show the first file
        expect(screen.queryByText("test2.txt")).not.toBeInTheDocument();
    });

    it("allows removing files from the list", async () => {
        const onUpload = vi.fn();
        const onFileRemove = vi.fn();
        const user = userEvent.setup();

        render(
            <MockFilezProvider>
                <Upload onUpload={onUpload} onFileRemove={onFileRemove}  />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByText("Drop files or folders here")).toBeInTheDocument();
        });

        const file = createMockFile("test.txt", 1024);
        const fileInputs = document.querySelectorAll('input[type="file"]');
        const input = fileInputs[0] as HTMLInputElement;

        await user.upload(input, file);

        await waitFor(() => {
            expect(screen.getByText("test.txt")).toBeInTheDocument();
        });

        const removeButton = screen.getByLabelText("Remove file");
        await user.click(removeButton);

        await waitFor(() => {
            expect(screen.queryByText("test.txt")).not.toBeInTheDocument();
            expect(screen.queryByText("Upload Files")).not.toBeInTheDocument();
        });

        expect(onFileRemove).toHaveBeenCalled();
    });

    it("is disabled when disabled prop is true", async () => {
        const onUpload = vi.fn();

        render(
            <MockFilezProvider>
                <Upload onUpload={onUpload} disabled  />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByText("Drop files or folders here")).toBeInTheDocument();
        });

        const fileButton = screen.getByRole("button", { name: "Select files to upload" });
        expect(fileButton).toBeDisabled();

        const fileInputs = document.querySelectorAll('input[type="file"]');
        const input = fileInputs[0] as HTMLInputElement;
        expect(input).toBeDisabled();
    });

    it("renders custom children when provided", async () => {
        const onUpload = vi.fn();

        render(
            <MockFilezProvider>
                <Upload onUpload={onUpload} >
                    <div data-testid="custom-content">Custom upload content</div>
                </Upload>
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId("custom-content")).toBeInTheDocument();
            expect(screen.getByText("Custom upload content")).toBeInTheDocument();
        });
    });

    it("handles keyboard navigation", async () => {
        const onUpload = vi.fn();
        const user = userEvent.setup();

        render(
            <MockFilezProvider>
                <Upload onUpload={onUpload}  />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByText("Drop files or folders here")).toBeInTheDocument();
        });

        const fileButton = screen.getByRole("button", { name: "Select files to upload" });

        await user.tab();
        expect(fileButton).toHaveFocus();

        // Mock the file input click since we can't actually trigger file selection
        const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

        await user.keyboard('{Enter}');
        expect(clickSpy).toHaveBeenCalled();

        // Reset the spy count before the second test
        clickSpy.mockClear();

        await user.keyboard(' ');
        expect(clickSpy).toHaveBeenCalled();

        clickSpy.mockRestore();
    });

    it("does not show upload button when no files are selected", async () => {
        const onUpload = vi.fn();

        render(
            <MockFilezProvider>
                <Upload onUpload={onUpload}  />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByText("Drop files or folders here")).toBeInTheDocument();
        });

        expect(screen.queryByText("Upload Files")).not.toBeInTheDocument();
    });

    it("disables upload button when component is disabled", async () => {
        const onUpload = vi.fn();
        const user = userEvent.setup();

        // First render enabled component to add a file
        const { rerender } = render(
            <MockFilezProvider>
                <Upload onUpload={onUpload}  />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByText("Drop files or folders here")).toBeInTheDocument();
        });

        const file = createMockFile("test.txt", 1024);
        const fileInputs = document.querySelectorAll('input[type="file"]');
        const input = fileInputs[0] as HTMLInputElement;
        await user.upload(input, file);

        await waitFor(() => {
            expect(screen.getByText("Upload Files")).toBeInTheDocument();
        });

        // Now disable the component
        rerender(
            <MockFilezProvider>
                <Upload onUpload={onUpload} disabled />
            </MockFilezProvider>
        );

        await waitFor(() => {
            const uploadButton = screen.getByText("Upload Files");
            expect(uploadButton).toBeDisabled();
        });
    });

    it("shows both file and folder selection UI", async () => {
        const onUpload = vi.fn();

        render(
            <MockFilezProvider>
                <Upload onUpload={onUpload} />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByText("Drop files or folders here")).toBeInTheDocument();
            expect(screen.getByText("Select files to upload")).toBeInTheDocument();
            expect(screen.getByText("or click to select folder")).toBeInTheDocument();
        });

        // Check that there are two inputs - one for files, one for folders
        const fileInputs = document.querySelectorAll('input[type="file"]');
        expect(fileInputs).toHaveLength(2);

        // First input (files) should not have webkitdirectory
        const fileInput = fileInputs[0] as HTMLInputElement;
        expect(fileInput).not.toHaveAttribute("webkitdirectory");

        // Second input (folders) should have webkitdirectory
        const folderInput = fileInputs[1] as HTMLInputElement;
        expect(folderInput.getAttribute("webkitdirectory")).toBe("true");
        expect(folderInput).toHaveAttribute("multiple");
    });
});