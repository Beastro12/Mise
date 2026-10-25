// Deterministic fixtures for tests/e2e/calories.spec.ts (Node 22, stdlib only).
// Run: node tests/fixtures/calories/generate.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

/** Last day of the fixtures: a Sunday. The week is Mon 2026-09-28 .. Sun 2026-10-04. */
export const ANCHOR = "2026-10-04";
export const DAYS = 10;

const dir = path.dirname(fileURLToPath(import.meta.url));

export function daysEnding(anchor = ANCHOR, n = DAYS) {
  const [y, m, d] = anchor.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1, d - (n - 1 - i))).toISOString().slice(0, 10));
}

const days = daysEnding();
// Per-day numbers vary a little so averages are not trivially round.
const nums = (i) => ({ active: 420 + i * 15, basal: 1750 + (i % 3) * 10, steps: 7000 + i * 250, kg: 80 - i * 0.1 });

function appleXml() {
  const rec = (type, unit, value, day, time) =>
    ` <Record type="HKQuantityTypeIdentifier${type}" sourceName="Apple Watch" unit="${unit}" creationDate="${day} ${time} +0300" startDate="${day} ${time} +0300" endDate="${day} ${time} +0300" value="${value}"/>`;
  const lines = [];
  days.forEach((day, i) => {
    const n = nums(i);
    lines.push(rec("ActiveEnergyBurned", "kcal", n.active - 100, day, "09:00:00"));
    lines.push(rec("ActiveEnergyBurned", "kcal", 100, day, "18:00:00"));
    lines.push(rec("BasalEnergyBurned", "kcal", n.basal, day, "00:00:00"));
    lines.push(rec("StepCount", "count", n.steps, day, "12:00:00"));
    lines.push(rec("BodyMass", "kg", n.kg.toFixed(1), day, "07:00:00"));
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<HealthData locale="en_FI">\n${lines.join("\n")}\n</HealthData>\n`;
}

function ouraCsv() {
  const rows = days.map((day, i) => {
    const n = nums(i);
    return `${day},${n.active + n.basal + 150},${n.active},${n.steps + 500}`;
  });
  return `day,total_calories,active_calories,steps\n${rows.join("\n")}\n`;
}

/** Single-entry zip: deflate (method 8), fixed DOS time (2026-01-01 00:00:00), real CRC-32. */
function zip(name, data) {
  const comp = zlib.deflateRawSync(data, { level: 9 });
  const nm = Buffer.from(name);
  const crc = zlib.crc32(data);
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(dosTime, 10);
  local.writeUInt16LE(dosDate, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nm.length, 26);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0);
  c.writeUInt16LE(20, 4);
  c.writeUInt16LE(20, 6);
  c.writeUInt16LE(8, 10);
  c.writeUInt16LE(dosTime, 12);
  c.writeUInt16LE(dosDate, 14);
  c.writeUInt32LE(crc, 16);
  c.writeUInt32LE(comp.length, 20);
  c.writeUInt32LE(data.length, 24);
  c.writeUInt16LE(nm.length, 28);
  const cd = Buffer.concat([c, nm]);
  const offset = local.length + nm.length + comp.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([local, nm, comp, cd, eocd]);
}

function write() {
  fs.writeFileSync(path.join(dir, "apple-export.zip"), zip("apple_health_export/export.xml", Buffer.from(appleXml())));
  fs.writeFileSync(path.join(dir, "oura-daily.csv"), ouraCsv());
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) write();
