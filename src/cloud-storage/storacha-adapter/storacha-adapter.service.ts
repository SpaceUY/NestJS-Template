import { ERROR_CODES } from "@/common/enums";
import { ApiException } from "@/common/expections/api.exception";
import type { DataStorageConfig } from "@/modules/infrastructure/data-storage/storacha/storacha.config";
import { StorachaClient } from "@/modules/infrastructure/data-storage/storacha/storacha.client";
import { Injectable } from "@nestjs/common";
import { CloudStorageService, CloudStorageUploadFile } from "../abstract/cloud-storage.service";
import { StorachaAdapterConfig } from "./storacha-adapter-config.interface";

interface StorachaUploadClient {
  addFile(file: Buffer): Promise<string>;
}

const DEFAULT_IPFS_PUBLIC_GATEWAY_PREFIX = "https://ipfs.io/ipfs/";

// eslint-disable-next-line no-new-func, ts/no-explicit-any
const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;
let cidModulePromise: Promise<any> | null = null;
let base32ModulePromise: Promise<any> | null = null;

function getCidModule() {
  cidModulePromise ??= dynamicImport("multiformats/cid");
  return cidModulePromise;
}

function getBase32Module() {
  base32ModulePromise ??= dynamicImport("multiformats/bases/base32");
  return base32ModulePromise;
}

function normalizeGatewayPrefix(prefix: string): string {
  return `${prefix.replace(/\/+$/, "")}/`;
}

@Injectable()
export class StorachaAdapterService extends CloudStorageService {
  private readonly client: StorachaUploadClient;
  private readonly gatewayPrefix: string;

  constructor(
    config: StorachaAdapterConfig,
    client?: StorachaUploadClient,
  ) {
    super();
    this.gatewayPrefix = normalizeGatewayPrefix(
      config.gatewayPrefix ?? DEFAULT_IPFS_PUBLIC_GATEWAY_PREFIX,
    );
    this.client
      = client
        ?? new StorachaClient({
          storageKey: config.storageKey,
          storageProof: config.storageProof,
        } as DataStorageConfig);
  }

  async uploadFile(file: CloudStorageUploadFile): Promise<{ url: string; id: string }> {
    const cid = await this.client.addFile(file.buffer);
    const id = await this._normalizeCid(cid);
    return {
      id,
      url: `${this.gatewayPrefix}${id}`,
    };
  }

  async deleteFile(fileKey: string): Promise<void> {
    throw new ApiException({
      code: ERROR_CODES.NOT_IMPLEMENTED,
      message: "deleteFile is not implemented for Storacha adapter",
      data: { fileKey },
    });
  }

  async getFile(fileKey: string): Promise<{ url: string; id: string }> {
    const id = await this._normalizeCid(fileKey);
    return {
      id,
      url: `${this.gatewayPrefix}${id}`,
    };
  }

  private async _normalizeCid(cid: string): Promise<string> {
    try {
      const [cidModule, base32Module] = await Promise.all([
        getCidModule(),
        getBase32Module(),
      ]);

      return cidModule.CID.parse(cid).toV1().toString(base32Module.base32);
    }
    catch {
      return cid;
    }
  }
}
