import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { AppleHealthParser, parseAppleHealthStream } from "@/lib/health/apple";
import { parseOura } from "@/lib/health/oura";
import { zipEntryText } from "@/lib/health/zip";

const rec = (type: string, value: number | string, start: string, extra = 'sourceName="Apple Watch" unit="kcal"', selfClose = true) =>
  `<Record type="HKQuantityTypeIdentifier${type}" ${extra} creationDate="${start}" startDate="${start}" endDate="${start}" value="${value}"${selfClose ? "/>" : `>\n  <MetadataEntry key="HKWasUserEntered" value="1"/>\n </Record>`}`;

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [ <!ELEMENT HealthData (Record*)> ]>
<HealthData locale="fi_FI">
 <Me HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexMale"/>
 ${rec("ActiveEnergyBurned", 300, "2026-09-28 08:00:00 +0300")}
 ${rec("ActiveEnergyBurned", 250.4, "2026-09-28 18:00:00 +0300")}
 ${rec("ActiveEnergyBurned", 500, "2026-09-28 18:00:00 +0300", 'sourceName="Oura" unit="kcal"')}
 ${rec("BasalEnergyBurned", 7531.2, "2026-09-28 00:00:00 +0300", 'sourceName="Apple Watch" unit="kJ"')}
 ${rec("StepCount", 4000, "2026-09-28 09:00:00 +0300", 'sourceName="iPhone" unit="count"')}
 ${rec("StepCount", 6000, "2026-09-28 09:00:00 +0300", 'sourceName="Apple Watch" unit="count"')}
 ${rec("BodyMass", 190, "2026-09-28 07:00:00 +0300", 'sourceName="Scale" unit="lb"', false)}
 ${rec("BodyMass", 86.2, "2026-09-28 21:00:00 +0300", 'sourceName="Scale" unit="kg"')}
 ${rec("DietaryEnergyConsumed", 2100, "2026-09-28 20:00:00 +0300", 'sourceName="MyFitnessPal" unit="Cal"')}
 ${rec("HeartRate", 61, "2026-09-28 20:00:00 +0300", 'sourceName="Apple Watch" unit="count/min"')}
 ${rec("ActiveEnergyBurned", 410, "2026-09-29 23:30:00 +0300")}
 <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="30"/>
</HealthData>`;

const expected = [
  { day: "2026-09-29", activeKcal: 410, basalKcal: null, totalKcal: null, steps: null, weightKg: null, intakeKcal: null },
  // Oura's 500 > Watch's 550.4? No: Watch 550 wins; sources are never added. 7531.2 kJ = 1800 kcal.
  { day: "2026-09-28", activeKcal: 550, basalKcal: 1800, totalKcal: null, steps: 6000, weightKg: 86.2, intakeKcal: 2100 },
];

describe("Apple Health export.xml", () => {
  it("sums per source, takes the largest source per day, converts kJ and lb", () => {
    const p = new AppleHealthParser();
    p.push(XML);
    expect(p.result()).toEqual(expected);
    expect(p.records).toBe(10);
  });

  it("gives the same result however the file is chunked", async () => {
    for (const size of [1, 7, 64, 1000]) {
      const chunks = Array.from({ length: Math.ceil(XML.length / size) }, (_, i) => XML.slice(i * size, (i + 1) * size));
      const { days } = await parseAppleHealthStream((async function* () {
        yield* chunks;
      })());
      expect(days).toEqual(expected);
    }
  });

  it("drops days before `since`", () => {
    const p = new AppleHealthParser();
    p.push(XML);
    expect(p.result("2026-09-29").map((d) => d.day)).toEqual(["2026-09-29"]);
  });
});

describe("Oura", () => {
  it("reads the API v2 shape", () => {
    const json = JSON.stringify({ data: [{ id: "x", day: "2026-09-28", total_calories: 2650, active_calories: 520, steps: 9100, score: 80 }], next_token: null });
    expect(parseOura(json)).toEqual([{ day: "2026-09-28", totalKcal: 2650, activeKcal: 520, basalKcal: null, steps: 9100, weightKg: null, intakeKcal: null }]);
  });

  it("reads an export with daily_activity, and v1 field names", () => {
    expect(parseOura(JSON.stringify({ daily_activity: [{ day: "2026-09-28", total_calories: 2500 }] }))[0].totalKcal).toBe(2500);
    expect(parseOura(JSON.stringify({ activity: [{ summary_date: "2026-09-28", cal_total: 2400, cal_active: 400, steps: 8000 }] }))[0]).toMatchObject({ totalKcal: 2400, activeKcal: 400 });
  });

  it("reads CSV with loose headers, quotes, semicolons and a BOM", () => {
    const csv = '﻿id,Day,"Total Calories",Active Calories,Steps,contributors\n1,2026-09-27,2600,500,9000,"{""a"": 1, ""b"": 2}"\n2,2026-09-28T00:00:00,2700,600,10000,{}\n3,not a date,1,1,1,\n';
    expect(parseOura(csv).map((d) => [d.day, d.totalKcal, d.steps])).toEqual([
      ["2026-09-28", 2700, 10000],
      ["2026-09-27", 2600, 9000],
    ]);
    expect(parseOura("summary_date;cal_total;cal_active;steps\n2026-09-28;2450;350;7000")[0]).toMatchObject({ totalKcal: 2450, activeKcal: 350 });
  });
});

// --- minimal zip writer for the reader tests -------------------------------

function buildZip(files: Array<{ name: string; data: Buffer }>, zip64 = false): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const comp = zlib.deflateRawSync(f.data);
    const name = Buffer.from(f.name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, comp);
    const extra = zip64 ? Buffer.alloc(28) : Buffer.alloc(0);
    if (zip64) {
      extra.writeUInt16LE(0x0001, 0);
      extra.writeUInt16LE(24, 2);
      extra.writeBigUInt64LE(BigInt(f.data.length), 4);
      extra.writeBigUInt64LE(BigInt(comp.length), 12);
      extra.writeBigUInt64LE(BigInt(offset), 20);
    }
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(zip64 ? 0xffffffff : comp.length, 20);
    c.writeUInt32LE(zip64 ? 0xffffffff : f.data.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt16LE(extra.length, 30);
    c.writeUInt32LE(zip64 ? 0xffffffff : offset, 42);
    central.push(c, name, extra);
    offset += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const tail: Buffer[] = [];
  if (zip64) {
    const rec = Buffer.alloc(56);
    rec.writeUInt32LE(0x06064b50, 0);
    rec.writeBigUInt64LE(BigInt(cd.length), 40);
    rec.writeBigUInt64LE(BigInt(offset), 48);
    const loc = Buffer.alloc(20);
    loc.writeUInt32LE(0x07064b50, 0);
    loc.writeBigUInt64LE(BigInt(offset + cd.length), 8);
    tail.push(rec, loc);
  }
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt32LE(zip64 ? 0xffffffff : cd.length, 12);
  eocd.writeUInt32LE(zip64 ? 0xffffffff : offset, 16);
  return Buffer.concat([...parts, cd, ...tail, eocd]);
}

const toBlob = (b: Buffer) => new Blob([new Uint8Array(b)]);

async function readAll(s: ReadableStream<string>) {
  let out = "";
  for await (const c of s as unknown as AsyncIterable<string>) out += c;
  return out;
}

describe("export.zip", () => {
  const files = [
    { name: "apple_health_export/export_cda.xml", data: Buffer.from("<cda/>") },
    { name: "apple_health_export/export.xml", data: Buffer.from(XML) },
  ];
  const isExport = (n: string) => /(^|\/)export\.xml$/.test(n);

  it("streams export.xml out of the zip", async () => {
    const s = await zipEntryText(toBlob(buildZip(files)), isExport);
    expect(await readAll(s!)).toBe(XML);
  });

  it("handles ZIP64 archives", async () => {
    const s = await zipEntryText(toBlob(buildZip(files, true)), isExport);
    const { days } = await parseAppleHealthStream(s!);
    expect(days).toEqual(expected);
  });

  it("returns null when the file isn't there and rejects non-zips", async () => {
    expect(await zipEntryText(toBlob(buildZip(files.slice(0, 1))), isExport)).toBeNull();
    await expect(zipEntryText(toBlob(Buffer.from("not a zip at all, just text")), isExport)).rejects.toThrow(/zip/);
  });
});
