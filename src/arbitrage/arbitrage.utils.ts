import { FUNDING_SCALE, PRICE_SCALE } from "../common/constants/constants";

export function toMs(v: string | null | undefined): number {
    if (!v) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

export function toInt(v: number | null | undefined, fallback: number): number {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function tryBigInt(v: unknown): bigint | null {
    if (v == null) return null;
    if (typeof v === "bigint") return v;
    if (typeof v === "number") {
        if (!Number.isFinite(v)) return null;
        return BigInt(Math.trunc(v));
    }
    if (typeof v === "string") {
        const s = v.trim();
        if (!s) return null;
        try {
            return BigInt(s);
        } catch {
            return null;
        }
    }
    return null;
}

export function fundingIntToPct(intStr: string): number {
    const n = Number(intStr);
    if (!Number.isFinite(n)) return 0;
    return (n / FUNDING_SCALE) * 100;
}

export function priceIntToNumber(intStr: string): number | null {
    const bi = tryBigInt(intStr);
    if (bi == null) return null;
    return Number(bi) / PRICE_SCALE;
}