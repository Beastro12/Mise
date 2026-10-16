/**
 * Read one file out of a .zip without loading the whole archive: the central
 * directory gives the entry's offset, and the entry is inflated as a stream
 * (DecompressionStream "deflate-raw", in browsers and Node 18+). Handles ZIP64,
 * which large Apple Health exports use. Older iOS Safari lacks TextDecoderStream
 * (falls back to TextDecoder) and may lack "deflate-raw" (friendly error).
 */

const u16 = (v: DataView, o: number) => v.getUint16(o, true);
const u32 = (v: DataView, o: number) => v.getUint32(o, true);
const u64 = (v: DataView, o: number) => Number(v.getBigUint64(o, true));
const MAX32 = 0xffffffff;

async function view(blob: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await blob.slice(start, end).arrayBuffer());
}

type Entry = { name: string; method: number; compSize: number; offset: number };

async function centralDirectory(blob: Blob): Promise<Entry[]> {
  const tailStart = Math.max(0, blob.size - 65_557);
  const tail = await view(blob, tailStart, blob.size);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (u32(tail, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("This doesn't look like a .zip file.");
  let cdSize = u32(tail, eocd + 12);
  let cdOffset = u32(tail, eocd + 16);
  if (cdOffset === MAX32 || cdSize === MAX32) {
    const loc = eocd - 20;
    if (loc < 0 || u32(tail, loc) !== 0x07064b50) throw new Error("Unsupported ZIP64 archive.");
    const recOffset = u64(tail, loc + 8);
    const rec = await view(blob, recOffset, recOffset + 56);
    if (u32(rec, 0) !== 0x06064b50) throw new Error("Unsupported ZIP64 archive.");
    cdSize = u64(rec, 40);
    cdOffset = u64(rec, 48);
  }
  const cd = await view(blob, cdOffset, cdOffset + cdSize);
  const entries: Entry[] = [];
  const dec = new TextDecoder();
  for (let p = 0; p + 46 <= cd.byteLength && u32(cd, p) === 0x02014b50; ) {
    const method = u16(cd, p + 10);
    let compSize = u32(cd, p + 20);
    const uncomp = u32(cd, p + 24);
    const nameLen = u16(cd, p + 28);
    const extraLen = u16(cd, p + 30);
    const commentLen = u16(cd, p + 32);
    let offset = u32(cd, p + 42);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
    // ZIP64 extra field: only the values that overflowed are present, in this order.
    for (let e = p + 46 + nameLen; e + 4 <= p + 46 + nameLen + extraLen; ) {
      const id = u16(cd, e);
      const len = u16(cd, e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (uncomp === MAX32) q += 8;
        if (compSize === MAX32) {
          compSize = u64(cd, q);
          q += 8;
        }
        if (offset === MAX32) offset = u64(cd, q);
      }
      e += 4 + len;
    }
    entries.push({ name, method, compSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const NO_INFLATE =
  "This iPhone can't unzip in the browser. Update iOS (16.4+) or, in Files, tap export.zip to unzip it and pick apple_health_export/export.xml here.";

function inflateRaw(raw: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Error(NO_INFLATE);
  try {
    return raw.pipeThrough(new DecompressionStream("deflate-raw") as unknown as TransformStream<Uint8Array, Uint8Array>);
  } catch {
    throw new Error(NO_INFLATE);
  }
}

/** UTF-8 decode a byte stream; uses TextDecoder when TextDecoderStream is missing. */
export function decodeTextStream(bytes: ReadableStream<Uint8Array>): ReadableStream<string> {
  if (typeof TextDecoderStream !== "undefined") {
    return bytes.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>);
  }
  const dec = new TextDecoder("utf-8");
  return bytes.pipeThrough(
    new TransformStream<Uint8Array, string>({
      transform(chunk, controller) {
        const s = dec.decode(chunk, { stream: true });
        if (s) controller.enqueue(s);
      },
      flush(controller) {
        const s = dec.decode();
        if (s) controller.enqueue(s);
      },
    }),
  );
}

/** Text stream of the first entry whose name matches, or null. */
export async function zipEntryText(blob: Blob, match: (name: string) => boolean): Promise<ReadableStream<string> | null> {
  const entry = (await centralDirectory(blob)).find((e) => match(e.name));
  if (!entry) return null;
  const local = await view(blob, entry.offset, entry.offset + 30);
  if (u32(local, 0) !== 0x04034b50) throw new Error("Damaged .zip file.");
  const dataStart = entry.offset + 30 + u16(local, 26) + u16(local, 28);
  const raw = blob.slice(dataStart, dataStart + entry.compSize).stream();
  let bytes: ReadableStream<Uint8Array>;
  if (entry.method === 8) bytes = inflateRaw(raw);
  else if (entry.method === 0) bytes = raw;
  else throw new Error(`Unsupported compression in .zip (method ${entry.method}).`);
  return decodeTextStream(bytes);
}
