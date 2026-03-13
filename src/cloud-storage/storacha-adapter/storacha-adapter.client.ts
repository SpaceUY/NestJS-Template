import type { Client as StorachaSdkClient } from "@storacha/client";
import type { StorachaAdapterConfig } from "./storacha-adapter-config.interface";
import { Buffer } from "node:buffer";

// eslint-disable-next-line no-new-func, ts/no-explicit-any
const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;

// TODO: improve typing
/* eslint-disable ts/no-explicit-any */
let storachaModulePromise: Promise<any> | null = null;
let signerModulePromise: Promise<any> | null = null;
let storachaProofModulePromise: Promise<any> | null = null;
/* eslint-enable ts/no-explicit-any */

function getStorachaModule() {
  storachaModulePromise ??= dynamicImport("@storacha/client");
  return storachaModulePromise;
}

function getSignerModule() {
  signerModulePromise ??= dynamicImport("@ucanto/principal/ed25519");
  return signerModulePromise;
}

function getStorachaProofModule() {
  storachaProofModulePromise ??= dynamicImport("@storacha/client/proof");
  return storachaProofModulePromise;
}

export class StorachaClient {
  private client: StorachaSdkClient | null = null;

  constructor(
    private readonly config: Pick<StorachaAdapterConfig, "storageKey" | "storageProof">,
  ) {}

  /**
   * Get the Storacha client if it does not exist use createClient
   */
  private async getClient(): Promise<StorachaSdkClient> {
    if (!this.client) {
      this.client = await this.createClient();
    }

    return this.client;
  }

  /**
   * Creates the Storacha client instance and sets the delegated current space.
   */
  private async createClient(): Promise<StorachaSdkClient> {
    const [storacha, signer] = await Promise.all([getStorachaModule(), getSignerModule()]);

    const principal = signer.parse(this.config.storageKey);
    const client = await storacha.create({
      principal,
    });
    const storachaProof = await getStorachaProofModule();
    const proof = await storachaProof.parse(this.config.storageProof);
    const space = await client.addSpace(proof);

    await client.setCurrentSpace(space.did());

    return client;
  }

  /**
   * Upload a binary file and returns the root CID.
   */
  async addFile(file: Buffer): Promise<string> {
    const client = await this.getClient();
    // Copy to a fresh ArrayBuffer-backed view to satisfy BlobPart typing.
    const bytes = new Uint8Array(file.byteLength);
    bytes.set(file);
    const result = await client.uploadFile(new Blob([bytes.buffer]));
    return result.toString();
  }
}
