import type { NetworkOptions, XahauNameConfig, XahauNameClient } from "@xahauname/sdk";

export interface XahauNameSdk {
  resolveNetworkConfig(options: NetworkOptions): XahauNameConfig;
  XahauNameClient: new (config: XahauNameConfig) => {
    read: Pick<XahauNameClient["read"], "getName">;
    disconnect(): Promise<void>;
  };
}

export async function loadXahauNameSdk(): Promise<XahauNameSdk> {
  return import("@xahauname/sdk");
}
