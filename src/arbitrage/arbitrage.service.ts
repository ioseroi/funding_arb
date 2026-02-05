import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FundingRate } from "../db/entities/funding-rate.entity";
import { fundingIntToPct, priceIntToNumber, toInt, toMs } from "./arbitrage.utils";

type Leg = {
    exchange: string;
    fundingPct: number;
    intervalHours: number;
    fundingTimeMs: string;
    retrievedAtMs: string;
    ageSec: number;
};

type ArbRow = {
    symbol: string;
    long: Leg;
    short: Leg;

    diffPctPerHour: number;
    dailyPct: number;

    fundingSkewSec: number;
    markPrice: number | null;
};

type Resp = {
    page: number;
    limit: number;
    total: number;
    data: ArbRow[];
};

function pickLatestByExchange(rows: FundingRate[]): FundingRate[] {
    const latest = new Map<number, FundingRate>();

    for (const r of rows) {
        const exId = r.exchangeId;
        if (!Number.isFinite(exId)) continue;

        const prev = latest.get(exId);
        if (!prev || toMs(r.retrievedAtMs) > toMs(prev.retrievedAtMs)) {
            latest.set(exId, r);
        }
    }

    return Array.from(latest.values());
}

function pickComparableSnapshot(rows: FundingRate[]): FundingRate[] {
    const byTime = new Map<string, FundingRate[]>();

    for (const r of rows) {
        const key = r.fundingTimeMs;
        if (!key) continue;

        const arr = byTime.get(key) ?? [];
        arr.push(r);
        byTime.set(key, arr);
    }

    let bestKey: string | null = null;
    let bestCoverage = -1;
    let bestTime = -1;

    for (const [k, group] of byTime.entries()) {
        const coverage = new Set(group.map((g) => g.exchangeId)).size;
        const t = toMs(k);

        if (coverage > bestCoverage || (coverage === bestCoverage && t > bestTime)) {
            bestKey = k;
            bestCoverage = coverage;
            bestTime = t;
        }
    }

    const candidate = bestKey ? byTime.get(bestKey)! : rows;

    const perEx = pickLatestByExchange(candidate);

    if (perEx.length < 2) return pickLatestByExchange(rows);

    return perEx;
}

@Injectable()
export class ArbitrageService {
    constructor(
        @InjectRepository(FundingRate)
        private readonly frRepo: Repository<FundingRate>,
    ) {}

    async getArbitrage(pageRaw: number, limitRaw: number, minDailyPctRaw: number): Promise<Resp> {
        const now = Date.now();

        const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
        const limit =
            Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 20;
        const minDailyPct =
            Number.isFinite(minDailyPctRaw) && minDailyPctRaw >= 0 ? minDailyPctRaw : 0;

        const MAX_AGE_MS_DEFAULT = 3 * 60 * 1000; // 3 min
        const MAX_AGE_MS_BY_EXCHANGE: Record<string, number> = {
            mexc: 4 * 60 * 1000,  // MEXC slower
            aster: 2 * 60 * 1000, // Aster faster
        };

        const MAX_AGE_MAX = Math.max(
            MAX_AGE_MS_DEFAULT,
            ...Object.values(MAX_AGE_MS_BY_EXCHANGE),
        );

        const MAX_FUNDING_SKEW_MS = 10 * 60 * 1000;

        const minRetrievedAt = String(now - MAX_AGE_MAX);

        const all = await this.frRepo
            .createQueryBuilder("fr")
            .leftJoinAndSelect("fr.exchange", "ex")
            .leftJoinAndSelect("fr.symbol", "sym")
            .where("fr.retrievedAtMs >= :minRetrievedAt", { minRetrievedAt })
            .getMany();

        const rows = all.filter((r) => {
            const canonical = r.symbol?.canonical;
            const code = r.exchange?.code;
            if (!canonical || !code) return false;

            const maxAge = MAX_AGE_MS_BY_EXCHANGE[code] ?? MAX_AGE_MS_DEFAULT;
            return now - toMs(r.retrievedAtMs) <= maxAge;
        });

        const byCanonical = new Map<string, FundingRate[]>();
        for (const r of rows) {
            const canonical = r.symbol?.canonical;
            if (!canonical) continue;

            const arr = byCanonical.get(canonical) ?? [];
            arr.push(r);
            byCanonical.set(canonical, arr);
        }

        const arbs: ArbRow[] = [];

        for (const [canonical, group] of byCanonical.entries()) {
            // Choose comparable snapshot across exchanges (same fundingTimeMs if possible)
            const snapshot = pickComparableSnapshot(group);
            if (snapshot.length < 2) continue;

            let bestHigh = snapshot[0];
            let bestLow = snapshot[0];

            let bestHighPct = fundingIntToPct(bestHigh.fundingRate);
            let bestLowPct = fundingIntToPct(bestLow.fundingRate);

            let bestHighPerHour = bestHighPct / toInt(bestHigh.intervalHours, 8);
            let bestLowPerHour = bestLowPct / toInt(bestLow.intervalHours, 8);

            for (const r of snapshot) {
                const pct = fundingIntToPct(r.fundingRate);
                const perHour = pct / toInt(r.intervalHours, 8);

                if (perHour > bestHighPerHour) {
                    bestHigh = r;
                    bestHighPct = pct;
                    bestHighPerHour = perHour;
                }
                if (perHour < bestLowPerHour) {
                    bestLow = r;
                    bestLowPct = pct;
                    bestLowPerHour = perHour;
                }
            }

            const skewMs = Math.abs(toMs(bestHigh.fundingTimeMs) - toMs(bestLow.fundingTimeMs));
            if (skewMs > MAX_FUNDING_SKEW_MS) continue;

            const diffPerHour = bestHighPerHour - bestLowPerHour;
            const dailyPct = diffPerHour * 24;

            if (dailyPct < minDailyPct) continue;

            const markPrice =
                bestHigh.markPrice != null
                    ? priceIntToNumber(String(bestHigh.markPrice))
                    : bestLow.markPrice != null
                        ? priceIntToNumber(String(bestLow.markPrice))
                        : null;

            const longCode = bestLow.exchange?.code ?? "unknown";
            const shortCode = bestHigh.exchange?.code ?? "unknown";

            const longLeg: Leg = {
                exchange: longCode,
                fundingPct: bestLowPct,
                intervalHours: toInt(bestLow.intervalHours, 8),
                fundingTimeMs: bestLow.fundingTimeMs,
                retrievedAtMs: bestLow.retrievedAtMs,
                ageSec: Math.round((now - toMs(bestLow.retrievedAtMs)) / 1000),
            };

            const shortLeg: Leg = {
                exchange: shortCode,
                fundingPct: bestHighPct,
                intervalHours: toInt(bestHigh.intervalHours, 8),
                fundingTimeMs: bestHigh.fundingTimeMs,
                retrievedAtMs: bestHigh.retrievedAtMs,
                ageSec: Math.round((now - toMs(bestHigh.retrievedAtMs)) / 1000),
            };

            arbs.push({
                symbol: canonical,
                long: longLeg,
                short: shortLeg,
                diffPctPerHour: diffPerHour,
                dailyPct,
                fundingSkewSec: Math.round(skewMs / 1000),
                markPrice,
            });
        }

        arbs.sort((a, b) => b.dailyPct - a.dailyPct);

        const total = arbs.length;
        const start = (page - 1) * limit;
        const data = arbs.slice(start, start + limit);

        return { page, limit, total, data };
    }
}
