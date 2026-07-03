/**
 * Voxel Lab Bench — row-packing (Gate B, Slice 3).
 *
 * Re-derived (not copy-pasted) from the zeux/Kapoulkine row-packing pattern cited in
 * docs/VOXEL_LAB_BENCH_PLAN.md Section 2a/3.2: a row of occupancy bytes packs to a
 * single byte when every cell in the row shares the same material id (including the
 * all-empty case), otherwise it packs to a 2-byte header (marker + length) followed by
 * the row's raw bytes. This trades worst-case size (+2 bytes on a fully mixed row) for
 * a large win on the common case of large uniform runs (empty air, solid interior
 * blocks) — the same "occupancy is mostly empty or mostly solid" shape zeux measured
 * (2.97 -> 0.49 bytes/voxel).
 *
 * Dependency-free by design: plain Uint8Array in, plain object/Uint8Array out, so this
 * module is trivially testable with plain `node --test`.
 */

/** Marker byte distinguishing a uniform-row single-byte pack from a raw 2-byte header. */
const UNIFORM_MARKER = 0;
const RAW_MARKER = 1;

/**
 * packRow(row: Uint8Array) -> PackedRow
 *
 * PackedRow shape:
 *   - uniform row (every byte identical): { uniform: true, value: number, length: number }
 *   - mixed row: { uniform: false, length: number, bytes: Uint8Array } (raw copy, not a view)
 *
 * A zero-length row is treated as a degenerate uniform row (value 0) so callers never
 * need a special case for it.
 */
export function packRow(row) {
  if (!(row instanceof Uint8Array)) {
    throw new TypeError('packRow: row must be a Uint8Array');
  }

  if (row.length === 0) {
    return { uniform: true, value: 0, length: 0 };
  }

  const first = row[0];
  let isUniform = true;
  for (let i = 1; i < row.length; i += 1) {
    if (row[i] !== first) {
      isUniform = false;
      break;
    }
  }

  if (isUniform) {
    return { uniform: true, value: first, length: row.length };
  }

  return { uniform: false, length: row.length, bytes: Uint8Array.from(row) };
}

/**
 * unpackRow(packed: PackedRow) -> Uint8Array
 *
 * Rebuilds a full-length Uint8Array from a PackedRow produced by packRow(). Byte-
 * identical to the original row for both uniform and mixed inputs.
 */
export function unpackRow(packed) {
  if (!packed || typeof packed !== 'object') {
    throw new TypeError('unpackRow: packed must be a PackedRow object');
  }

  if (packed.uniform) {
    return new Uint8Array(packed.length).fill(packed.value);
  }

  if (!(packed.bytes instanceof Uint8Array) || packed.bytes.length !== packed.length) {
    throw new TypeError('unpackRow: mixed PackedRow.bytes must be a Uint8Array matching length');
  }
  return Uint8Array.from(packed.bytes);
}

/**
 * packedByteSize(packed: PackedRow) -> number
 *
 * Serialized-size accounting for a single PackedRow, matching the on-wire/on-disk
 * shape the packing scheme actually implies:
 *   - uniform row: 1 marker byte + 1 value byte = 2 bytes (independent of row length)
 *   - mixed row: 2 header bytes (marker + implied length is the row's own known
 *     length in this in-memory representation) + the raw row bytes
 *
 * This mirrors the plan's "1 byte if uniform, else 2-byte header + full row" contract
 * (Section 3.2) using a 2-byte uniform encoding (marker + value) so a uniform row of
 * any material id — not just 0/empty — is representable; the empty (all-zero) case is
 * still the overwhelmingly common one in practice and still collapses to a constant.
 */
export function packedByteSize(packed) {
  if (!packed || typeof packed !== 'object') {
    throw new TypeError('packedByteSize: packed must be a PackedRow object');
  }
  if (packed.uniform) {
    return 2; // marker + value byte, regardless of row length
  }
  return 2 + packed.length; // marker + length header + raw row bytes
}

/**
 * packGridRows(grid) -> { rows: PackedRow[], rawBytes: number, packedBytes: number, bytesPerVoxel: number }
 *
 * Packs a VoxelGrid's occupancy row-by-row along the x axis (the grid's fastest-
 * varying index per bench-core.mjs's x-fastest indexOf), one row per (y, z) pair.
 * Reports raw-vs-packed byte counts so callers (tests, the bench readout panel) can
 * measure the actual reduction on this codebase's own data, not just cite zeux's
 * numbers.
 */
export function packGridRows(grid) {
  if (!grid) throw new TypeError('packGridRows: grid is required');

  const { nx, ny, nz, occupancy } = grid;
  const rows = [];
  const rowBuf = new Uint8Array(nx);

  for (let z = 0; z < nz; z += 1) {
    for (let y = 0; y < ny; y += 1) {
      const rowStart = nx * (y + ny * z);
      rowBuf.set(occupancy.subarray(rowStart, rowStart + nx));
      rows.push(packRow(rowBuf));
    }
  }

  const rawBytes = occupancy.byteLength;
  let packedBytes = 0;
  for (const packed of rows) packedBytes += packedByteSize(packed);

  const voxelCount = nx * ny * nz;
  const bytesPerVoxel = voxelCount > 0 ? packedBytes / voxelCount : 0;

  return { rows, rawBytes, packedBytes, bytesPerVoxel };
}

/**
 * unpackGridRows(packedRows: PackedRow[], nx: number) -> Uint8Array
 *
 * Inverse of packGridRows's row list: concatenates each row's unpacked bytes back
 * into a single flat occupancy-shaped Uint8Array (caller supplies nx so this stays a
 * pure function with no grid-shape guessing).
 */
export function unpackGridRows(packedRows, nx) {
  if (!Array.isArray(packedRows)) {
    throw new TypeError('unpackGridRows: packedRows must be an array');
  }
  const out = new Uint8Array(packedRows.length * nx);
  for (let i = 0; i < packedRows.length; i += 1) {
    const rowBytes = unpackRow(packedRows[i]);
    out.set(rowBytes, i * nx);
  }
  return out;
}

export const ROW_PACK_MARKERS = Object.freeze({ UNIFORM_MARKER, RAW_MARKER });
