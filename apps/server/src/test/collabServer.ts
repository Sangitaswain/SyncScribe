import type { AddressInfo } from "node:net";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { app } from "../app";
import { attachCollab } from "../collab/hocuspocus";

/** Starts the full server (REST + sync) on a random port for tests. */
export async function startServer() {
  const server = app.listen(0);
  attachCollab(server);
  await new Promise((r) => server.once("listening", r));
  const port = (server.address() as AddressInfo).port;
  return { port, close: () => new Promise((r) => server.close(r)) };
}

/** Connects a test client for one document; resolves when synced (or rejects on auth failure). */
export function connect(port: number, name: string, token = "none", document = new Y.Doc()) {
  return new Promise<{ provider: HocuspocusProvider; doc: Y.Doc }>((resolve, reject) => {
    const provider = new HocuspocusProvider({
      url: `ws://localhost:${port}/collab`,
      name,
      document,
      token,
      onSynced: () => resolve({ provider, doc: document }),
      onAuthenticationFailed: ({ reason }) => {
        provider.destroy();
        reject(new Error(reason));
      },
    });
  });
}

export const until = async (check: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 20));
  }
};
