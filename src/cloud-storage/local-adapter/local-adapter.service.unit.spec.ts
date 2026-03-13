import { ApiException } from "@/common/expections/api.exception";
import { LocalAdapterService } from "@/modules/infrastructure/cloud-storage/local-adapter/local-adapter.service";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import { v4 as uuidv4 } from "uuid";

jest.mock("node:fs/promises", () => ({
  access: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  writeFile: jest.fn(),
}));

jest.mock("uuid", () => ({
  v4: jest.fn(),
}));

describe("LocalAdapterService", () => {
  const mockedAccess = jest.mocked(access);
  const mockedMkdir = jest.mocked(mkdir);
  const mockedUnlink = jest.mocked(unlink);
  const mockedWriteFile = jest.mocked(writeFile);

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should upload a file to the local files directory", async () => {
    (uuidv4 as unknown as jest.Mock).mockReturnValue("local-id");
    mockedMkdir.mockResolvedValue(undefined);
    mockedWriteFile.mockResolvedValue(undefined);

    const service = new LocalAdapterService();
    const response = await service.uploadFile({
      buffer: Buffer.from("local-file"),
      originalname: "document.txt",
    });

    expect(mockedMkdir).toHaveBeenCalledWith(expect.stringContaining("/files"), {
      recursive: true,
    });
    expect(mockedWriteFile).toHaveBeenCalledWith(
      expect.stringContaining("/files/local-id.txt"),
      expect.any(Buffer),
    );
    expect(response).toEqual({
      id: "local-id.txt",
      url: "/files/local-id.txt",
    });
  });

  it("should throw when uploading an empty file", async () => {
    const service = new LocalAdapterService();

    let error: unknown;
    try {
      await service.uploadFile({ buffer: Buffer.alloc(0) });
    }
    catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(ApiException);
    expect(error).toMatchObject({
      code: "INSUFFICIENT_INFORMATION",
    });
  });

  it("should return a local URL when the file exists", async () => {
    mockedAccess.mockResolvedValue(undefined);

    const service = new LocalAdapterService();
    const response = await service.getFile("existing-file.png");

    expect(mockedAccess).toHaveBeenCalledWith(
      expect.stringContaining("/files/existing-file.png"),
    );
    expect(response).toEqual({
      id: "existing-file.png",
      url: "/files/existing-file.png",
    });
  });

  it("should throw RESOURCE_NOT_FOUND when file does not exist", async () => {
    mockedAccess.mockRejectedValue({ code: "ENOENT" });

    const service = new LocalAdapterService();

    let error: unknown;
    try {
      await service.getFile("missing-file.png");
    }
    catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(ApiException);
    expect(error).toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
  });

  it("should delete a local file", async () => {
    mockedUnlink.mockResolvedValue(undefined);

    const service = new LocalAdapterService();
    await service.deleteFile("file-to-delete.pdf");

    expect(mockedUnlink).toHaveBeenCalledWith(
      expect.stringContaining("/files/file-to-delete.pdf"),
    );
  });
});
