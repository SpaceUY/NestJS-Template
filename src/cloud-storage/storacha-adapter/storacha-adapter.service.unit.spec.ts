import { ApiException } from "@/common/expections/api.exception";
import { StorachaAdapterService } from "@/modules/infrastructure/cloud-storage/storacha-adapter/storacha-adapter.service";

describe("StorachaAdapterService", () => {
  it("should upload a file and return CID-based metadata", async () => {
    const addFile = jest.fn().mockResolvedValue("fake-cid");
    const service = new StorachaAdapterService(
      {
        storageKey: "key",
        storageProof: "proof",
      },
      { addFile },
    );

    const response = await service.uploadFile({
      buffer: Buffer.from("test"),
      originalname: "document.pdf",
    });

    expect(addFile).toHaveBeenCalledTimes(1);
    expect(response).toEqual({
      id: "fake-cid",
      url: "https://ipfs.io/ipfs/fake-cid",
    });
  });

  it("should build a public URL for an existing CID", async () => {
    const service = new StorachaAdapterService(
      {
        storageKey: "key",
        storageProof: "proof",
      },
      { addFile: jest.fn() },
    );

    const response = await service.getFile("existing-cid");

    expect(response).toEqual({
      id: "existing-cid",
      url: "https://ipfs.io/ipfs/existing-cid",
    });
  });

  it("should throw NOT_IMPLEMENTED when deleting a file", async () => {
    const service = new StorachaAdapterService(
      {
        storageKey: "key",
        storageProof: "proof",
      },
      { addFile: jest.fn() },
    );

    let error: unknown;
    try {
      await service.deleteFile("cid-to-delete");
    }
    catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(ApiException);
    expect(error).toMatchObject({
      code: "NOT_IMPLEMENTED",
    });
  });
});
