import { FUNDING_SCALE, PRICE_SCALE } from "../common/constants/constants";

export function normalizeMexcSymbol(sym: string): string {
    return String(sym || "").replaceAll("_", "").toUpperCase();
}

export function normalizeAsterSymbol(sym: string): string {
    return String(sym || "").toUpperCase();
}

export function fundingDecimalToIntStr(x: string | number): string {
    const n = typeof x === "number" ? x : Number(x);
    if (!Number.isFinite(n)) return "0";
    return String(Math.round(n * FUNDING_SCALE));
}

export function priceDecimalToIntStr(x: string | number | null | undefined): string | null {
    const n = typeof x === "number" ? x : Number(x);
    if (!Number.isFinite(n)) return "0";
    return String(Math.round(n * PRICE_SCALE));
}

export function sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
}

export function normalizeProxyUrl(raw: string): string {
    const s = (raw || "").trim();
    if (!s) return "";
    const fixed = s.replace(/^https::\/\//i, "https://").replace(/^http::\/\//i, "http://");
    if (!/^[a-z]+:\/\//i.test(fixed)) return `http://${fixed}`;
    return fixed;
}