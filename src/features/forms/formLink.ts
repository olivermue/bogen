import type { Form } from '../../schema/form';
import { serializeFormFile } from '../../schema/serializeFormFile';

// A form template travels inside the URL fragment: `<app>#/import?v=1&d=<payload>`.
// The fragment never reaches the server, so the link works with static hosting and stays private.
// Payload: the regular form file (compact JSON), deflate-raw compressed, base64url encoded.
// No Zod here: this module is part of the first-load chunk. Parsing happens on the import page.

/** Encoding version in the `v` parameter; bump when the payload format changes. */
export const LINK_VERSION = 1;

/**
 * Longest link the app offers to share. Messengers cut or refuse very long messages
 * (WhatsApp: 65 536 characters); the wa.me fallback encodes the link once more.
 */
export const MAX_LINK_LENGTH = 30_000;

export const IMPORT_PATH = '/import';

async function pipe(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
) {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const out = source.pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('Not base64url');
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function encodeFormPayload(form: Form): Promise<string> {
  const json = serializeFormFile([form], { compact: true });
  return toBase64Url(
    await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')),
  );
}

/** Returns the form file text; throws when the payload is damaged or incomplete. */
export async function decodeFormPayload(payload: string): Promise<string> {
  const bytes = await pipe(fromBase64Url(payload), new DecompressionStream('deflate-raw'));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** `base` is the app's current address; its fragment (the current hash route) is replaced. */
export async function buildFormLink(form: Form, base: string): Promise<string> {
  const app = base.split('#')[0];
  return `${app}#${IMPORT_PATH}?v=${LINK_VERSION}&d=${await encodeFormPayload(form)}`;
}
