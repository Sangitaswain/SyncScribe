import type { Server as HttpServer } from "node:http";
import { Hocuspocus } from "@hocuspocus/server";
import { Database } from "@hocuspocus/extension-database";
import { WebSocketServer } from "ws";
import { fetchState, storeState } from "./persistence";
import { onAuthenticate } from "./auth";
import { indexDocument, indexTitle } from "./treeIndex";
import { parseDocName } from "@syncscribe/shared";

// Real-time Yjs sync server (BP-6). Shares the HTTP server/port with Express, at /collab.

export const hocuspocus = new Hocuspocus({
  quiet: true,
  debounce: 2000, // store at most every 2 s while people type…
  maxDebounce: 10000, // …and at least every 10 s
  onAuthenticate,
  // Workspace trees are indexed as soon as they load or change; doc titles when stored
  afterLoadDocument: async ({ documentName, document }) => indexDocument(documentName, document),
  onChange: async ({ documentName, document }) => indexDocument(documentName, document),
  onStoreDocument: async ({ documentName, document }) => {
    const parsed = parseDocName(documentName);
    if (parsed?.kind === "doc") indexTitle(parsed.id, document);
  },
  extensions: [
    new Database({
      fetch: async ({ documentName }) => fetchState(documentName),
      store: async ({ documentName, state }) => void storeState(documentName, state),
    }),
  ],
});

export function attachCollab(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 10 * 1024 * 1024 }); // images ≤ 2 MB each (EC34)

  server.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith("/collab")) return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => {
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
      const conn = hocuspocus.handleConnection(ws, new Request(`http://localhost${req.url}`, { headers }));
      ws.on("message", (data: Buffer) => conn.handleMessage(new Uint8Array(data)));
      ws.on("close", (code, reason) => conn.handleClose({ code, reason: reason.toString() }));
      ws.on("pong", () => conn.touch());
    });
  });
}
