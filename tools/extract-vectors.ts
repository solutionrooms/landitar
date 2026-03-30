#!/usr/bin/env tsx
/**
 * Gravitar ROM Vector Extraction Tool
 *
 * Reads the original Gravitar arcade ROM files, disassembles the AVG
 * (Analog Vector Generator) bytecode, and extracts terrain profiles,
 * shape definitions, and color data as JSON files.
 */

import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  type VectorSubroutine,
  type VectorLine,
  type DecodedInstruction,
  type JsrlInstruction,
  COLOR_TABLE,
  AVG_ROM_START,
  AVG_ROM_END,
} from './avg-types.js';
import {
  loadVectorRoms,
  findSubroutineAddresses,
  buildSubroutine,
  AvgSimulator,
  disassembleSubroutine,
} from './avg-disassembler.js';

const PROJECT_ROOT = join(import.meta.dirname, '..');
const DATA_DIR = join(PROJECT_ROOT, 'src', 'data');

// --- Output types ---

interface ExtractedShape {
  name: string;
  address: number;
  classification: string;
  lines: {
    x1: number; y1: number;
    x2: number; y2: number;
    color: string;
    intensity: number;
  }[];
  /** Bounding box */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

interface ExtractionReport {
  totalSubroutines: number;
  terrain: number;
  shape: number;
  character: number;
  table: number;
  unknown: number;
}

// --- Helpers ---

function colorHex(color: number): string {
  return COLOR_TABLE[color & 7] ?? '#FFFFFF';
}

/** Normalize lines so the first point is at origin (0,0) */
function normalizeLines(lines: VectorLine[]): VectorLine[] {
  if (lines.length === 0) return [];

  const offsetX = lines[0].x1;
  const offsetY = lines[0].y1;

  return lines.map(l => ({
    ...l,
    x1: l.x1 - offsetX,
    y1: l.y1 - offsetY,
    x2: l.x2 - offsetX,
    y2: l.y2 - offsetY,
  }));
}

/** Compute bounding box of lines */
function computeBounds(lines: VectorLine[]) {
  if (lines.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const l of lines) {
    minX = Math.min(minX, l.x1, l.x2);
    minY = Math.min(minY, l.y1, l.y2);
    maxX = Math.max(maxX, l.x1, l.x2);
    maxY = Math.max(maxY, l.y1, l.y2);
  }
  return { minX, minY, maxX, maxY };
}

/** Scale lines to fit within a target coordinate range */
function scaleLines(lines: VectorLine[], targetSize: number): VectorLine[] {
  const bounds = computeBounds(lines);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const maxDim = Math.max(width, height);
  if (maxDim === 0) return lines;

  const scale = targetSize / maxDim;
  return lines.map(l => ({
    ...l,
    x1: (l.x1 - bounds.minX) * scale,
    y1: (l.y1 - bounds.minY) * scale,
    x2: (l.x2 - bounds.minX) * scale,
    y2: (l.y2 - bounds.minY) * scale,
  }));
}

// --- Main extraction ---

function main() {
  console.log('=== Gravitar ROM Vector Extraction ===\n');

  // Load ROMs
  console.log('Loading vector ROMs...');
  const mem = loadVectorRoms();
  console.log(`  Loaded ${mem.length} bytes into AVG address space`);

  // Find subroutine entry points
  console.log('\nScanning for subroutine entry points...');
  const addresses = findSubroutineAddresses(mem);
  console.log(`  Found ${addresses.size} subroutine targets`);

  // Also add entry points found by linear scanning for RTSL boundaries
  console.log('\nScanning for RTSL boundaries...');
  let rtslCount = 0;
  let prevRtslEnd = AVG_ROM_START;
  for (let pc = AVG_ROM_START; pc < AVG_ROM_END; pc += 2) {
    const word = mem[pc] | (mem[pc + 1] << 8);
    const op = (word >> 13) & 7;
    if (op === 6) { // RTSL
      rtslCount++;
      // The subroutine likely starts right after the previous RTSL
      if (prevRtslEnd + 2 <= pc) {
        addresses.add(prevRtslEnd);
      }
      prevRtslEnd = pc + 2;
    }
  }
  console.log(`  Found ${rtslCount} RTSL markers, ${addresses.size} total entry points`);

  // Build subroutines
  console.log('\nDisassembling and simulating subroutines...');
  const sim = new AvgSimulator(mem);
  const subroutines: VectorSubroutine[] = [];

  const sortedAddrs = [...addresses].sort((a, b) => a - b);
  for (const addr of sortedAddrs) {
    try {
      const sub = buildSubroutine(mem, addr, sim);
      subroutines.push(sub);
    } catch (err) {
      // Skip invalid subroutines
    }
  }
  console.log(`  Built ${subroutines.length} subroutines`);

  // Classify and report
  const report: ExtractionReport = {
    totalSubroutines: subroutines.length,
    terrain: 0,
    shape: 0,
    character: 0,
    table: 0,
    unknown: 0,
  };

  for (const sub of subroutines) {
    report[sub.classification]++;
  }

  console.log('\nClassification:');
  console.log(`  Terrain:    ${report.terrain}`);
  console.log(`  Shapes:     ${report.shape}`);
  console.log(`  Characters: ${report.character}`);
  console.log(`  Tables:     ${report.table}`);
  console.log(`  Unknown:    ${report.unknown}`);

  // Create output directories
  mkdirSync(join(DATA_DIR, 'shapes'), { recursive: true });
  mkdirSync(join(DATA_DIR, 'extracted'), { recursive: true });

  // Extract and save all subroutines
  const allShapes: ExtractedShape[] = [];
  const terrainShapes: ExtractedShape[] = [];
  const objectShapes: ExtractedShape[] = [];
  const charShapes: ExtractedShape[] = [];

  for (const sub of subroutines) {
    if (sub.lines.length === 0) continue;

    const normalized = normalizeLines(sub.lines);
    const bounds = computeBounds(normalized);

    const shape: ExtractedShape = {
      name: `sub_${sub.address.toString(16).padStart(4, '0')}`,
      address: sub.address,
      classification: sub.classification,
      lines: normalized.map(l => ({
        x1: l.x1, y1: l.y1,
        x2: l.x2, y2: l.y2,
        color: colorHex(l.color),
        intensity: l.intensity,
      })),
      bounds,
    };

    allShapes.push(shape);

    switch (sub.classification) {
      case 'terrain': terrainShapes.push(shape); break;
      case 'shape': objectShapes.push(shape); break;
      case 'character': charShapes.push(shape); break;
    }
  }

  // Save comprehensive extraction data
  const extractionData = {
    meta: {
      source: 'Gravitar (Atari 1982) ROM extraction',
      extractedAt: new Date().toISOString(),
      report,
    },
    subroutines: allShapes,
  };

  writeFileSync(
    join(DATA_DIR, 'extracted', 'all-subroutines.json'),
    JSON.stringify(extractionData, null, 2)
  );
  console.log(`\nSaved ${allShapes.length} subroutines with lines to extracted/all-subroutines.json`);

  // Save classified groups
  if (terrainShapes.length > 0) {
    writeFileSync(
      join(DATA_DIR, 'extracted', 'terrain.json'),
      JSON.stringify(terrainShapes, null, 2)
    );
    console.log(`Saved ${terrainShapes.length} terrain profiles to extracted/terrain.json`);
  }

  if (objectShapes.length > 0) {
    writeFileSync(
      join(DATA_DIR, 'extracted', 'shapes.json'),
      JSON.stringify(objectShapes, null, 2)
    );
    console.log(`Saved ${objectShapes.length} object shapes to extracted/shapes.json`);
  }

  if (charShapes.length > 0) {
    writeFileSync(
      join(DATA_DIR, 'extracted', 'characters.json'),
      JSON.stringify(charShapes, null, 2)
    );
    console.log(`Saved ${charShapes.length} character glyphs to extracted/characters.json`);
  }

  // Save color palette
  writeFileSync(
    join(DATA_DIR, 'extracted', 'colors.json'),
    JSON.stringify(COLOR_TABLE, null, 2)
  );
  console.log('Saved color palette to extracted/colors.json');

  // Print detailed info for terrain and large shapes
  console.log('\n=== Terrain Profiles ===');
  for (const t of terrainShapes) {
    const w = Math.round(t.bounds.maxX - t.bounds.minX);
    const h = Math.round(t.bounds.maxY - t.bounds.minY);
    console.log(`  ${t.name}: ${t.lines.length} segments, ${w}x${h} units`);
  }

  console.log('\n=== Object Shapes ===');
  for (const s of objectShapes.slice(0, 20)) {
    console.log(`  ${s.name}: ${s.lines.length} segments, color=${s.lines[0]?.color}`);
  }
  if (objectShapes.length > 20) {
    console.log(`  ... and ${objectShapes.length - 20} more`);
  }

  console.log('\n=== Character Glyphs ===');
  console.log(`  ${charShapes.length} glyphs extracted`);

  console.log('\nExtraction complete!');
}

main();
