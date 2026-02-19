/**
 * Core math types for the poqpoq script engine.
 * These map directly to LSL's vector and rotation types,
 * and align with Babylon.js equivalents for engine integration.
 */

/** 3D vector — maps to LSL `vector` type */
export class Vector3 {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0,
  ) {}

  add(other: Vector3): Vector3 {
    return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  subtract(other: Vector3): Vector3 {
    return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  scale(factor: number): Vector3 {
    return new Vector3(this.x * factor, this.y * factor, this.z * factor);
  }

  dot(other: Vector3): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  cross(other: Vector3): Vector3 {
    return new Vector3(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x,
    );
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize(): Vector3 {
    const len = this.length();
    if (len === 0) return new Vector3();
    return this.scale(1 / len);
  }

  distanceTo(other: Vector3): number {
    return this.subtract(other).length();
  }

  equals(other: Vector3, epsilon = 1e-6): boolean {
    return (
      Math.abs(this.x - other.x) < epsilon &&
      Math.abs(this.y - other.y) < epsilon &&
      Math.abs(this.z - other.z) < epsilon
    );
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  toString(): string {
    return `<${this.x}, ${this.y}, ${this.z}>`;
  }

  static readonly ZERO = new Vector3(0, 0, 0);
  static readonly ONE = new Vector3(1, 1, 1);
  static readonly UP = new Vector3(0, 1, 0);
  static readonly FORWARD = new Vector3(0, 0, 1);
  static readonly RIGHT = new Vector3(1, 0, 0);

  /** Parse LSL-style vector string: "<1.0, 2.0, 3.0>" */
  static fromLSL(str: string): Vector3 {
    const match = str.match(
      /<\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*>/,
    );
    if (!match) throw new Error(`Invalid LSL vector: ${str}`);
    return new Vector3(
      parseFloat(match[1]),
      parseFloat(match[2]),
      parseFloat(match[3]),
    );
  }
}

/** Quaternion rotation — maps to LSL `rotation` type */
export class Quaternion {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0,
    public s: number = 1, // LSL uses 's' for the scalar component, not 'w'
  ) {}

  multiply(other: Quaternion): Quaternion {
    return new Quaternion(
      this.s * other.x + this.x * other.s + this.y * other.z - this.z * other.y,
      this.s * other.y - this.x * other.z + this.y * other.s + this.z * other.x,
      this.s * other.z + this.x * other.y - this.y * other.x + this.z * other.s,
      this.s * other.s - this.x * other.x - this.y * other.y - this.z * other.z,
    );
  }

  normalize(): Quaternion {
    const len = Math.sqrt(
      this.x * this.x + this.y * this.y + this.z * this.z + this.s * this.s,
    );
    if (len === 0) return new Quaternion();
    return new Quaternion(
      this.x / len,
      this.y / len,
      this.z / len,
      this.s / len,
    );
  }

  inverse(): Quaternion {
    const norm =
      this.x * this.x + this.y * this.y + this.z * this.z + this.s * this.s;
    if (norm === 0) return new Quaternion();
    return new Quaternion(
      -this.x / norm,
      -this.y / norm,
      -this.z / norm,
      this.s / norm,
    );
  }

  /** Convert to Euler angles (degrees) — matches llRot2Euler behavior */
  toEuler(): Vector3 {
    const sinr_cosp = 2 * (this.s * this.x + this.y * this.z);
    const cosr_cosp = 1 - 2 * (this.x * this.x + this.y * this.y);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    const sinp = 2 * (this.s * this.y - this.z * this.x);
    const pitch =
      Math.abs(sinp) >= 1 ? (Math.sign(sinp) * Math.PI) / 2 : Math.asin(sinp);

    const siny_cosp = 2 * (this.s * this.z + this.x * this.y);
    const cosy_cosp = 1 - 2 * (this.y * this.y + this.z * this.z);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    return new Vector3(roll, pitch, yaw);
  }

  equals(other: Quaternion, epsilon = 1e-6): boolean {
    return (
      Math.abs(this.x - other.x) < epsilon &&
      Math.abs(this.y - other.y) < epsilon &&
      Math.abs(this.z - other.z) < epsilon &&
      Math.abs(this.s - other.s) < epsilon
    );
  }

  clone(): Quaternion {
    return new Quaternion(this.x, this.y, this.z, this.s);
  }

  toString(): string {
    return `<${this.x}, ${this.y}, ${this.z}, ${this.s}>`;
  }

  static readonly IDENTITY = new Quaternion(0, 0, 0, 1);

  /** Create from Euler angles (radians) — matches llEuler2Rot */
  static fromEuler(v: Vector3): Quaternion {
    const cr = Math.cos(v.x / 2);
    const sr = Math.sin(v.x / 2);
    const cp = Math.cos(v.y / 2);
    const sp = Math.sin(v.y / 2);
    const cy = Math.cos(v.z / 2);
    const sy = Math.sin(v.z / 2);

    return new Quaternion(
      sr * cp * cy - cr * sp * sy,
      cr * sp * cy + sr * cp * sy,
      cr * cp * sy - sr * sp * cy,
      cr * cp * cy + sr * sp * sy,
    );
  }

  /** Create rotation from axis and angle */
  static fromAxisAngle(axis: Vector3, angle: number): Quaternion {
    const half = angle / 2;
    const s = Math.sin(half);
    const norm = axis.normalize();
    return new Quaternion(norm.x * s, norm.y * s, norm.z * s, Math.cos(half));
  }

  /** Parse LSL-style rotation string: "<0.0, 0.0, 0.0, 1.0>" */
  static fromLSL(str: string): Quaternion {
    const match = str.match(
      /<\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*>/,
    );
    if (!match) throw new Error(`Invalid LSL rotation: ${str}`);
    return new Quaternion(
      parseFloat(match[1]),
      parseFloat(match[2]),
      parseFloat(match[3]),
      parseFloat(match[4]),
    );
  }
}

/** RGB color with 0-1 range — maps to LSL color vectors */
export class Color3 {
  constructor(
    public r: number = 0,
    public g: number = 0,
    public b: number = 0,
  ) {}

  toVector3(): Vector3 {
    return new Vector3(this.r, this.g, this.b);
  }

  toHex(): string {
    const toHex = (c: number) =>
      Math.round(c * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(this.r)}${toHex(this.g)}${toHex(this.b)}`;
  }

  toString(): string {
    return `<${this.r}, ${this.g}, ${this.b}>`;
  }

  static readonly WHITE = new Color3(1, 1, 1);
  static readonly BLACK = new Color3(0, 0, 0);
  static readonly RED = new Color3(1, 0, 0);
  static readonly GREEN = new Color3(0, 1, 0);
  static readonly BLUE = new Color3(0, 0, 1);

  static fromHex(hex: string): Color3 {
    const h = hex.replace("#", "");
    return new Color3(
      parseInt(h.substring(0, 2), 16) / 255,
      parseInt(h.substring(2, 4), 16) / 255,
      parseInt(h.substring(4, 6), 16) / 255,
    );
  }

  static fromVector3(v: Vector3): Color3 {
    return new Color3(v.x, v.y, v.z);
  }
}
