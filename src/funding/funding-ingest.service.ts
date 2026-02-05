import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Exchange } from "../db/entities/exchange.entity";
import { SymbolEntity } from "../db/entities/symbol.entity";
import { FundingRate } from "../db/entities/funding-rate.entity";

export type IngestRow = {
    exchangeCode: string;
    canonical: string;
    fundingRateInt: string;
    fundingTimeMs: string;
    intervalHours: number;
    markPrice?: string | null;
    nextFundingTimeMs?: string | null;
    retrievedAtMs: string;
};

@Injectable()
export class FundingIngestService {
    constructor(
        @InjectRepository(Exchange) private exRepo: Repository<Exchange>,
        @InjectRepository(SymbolEntity) private symRepo: Repository<SymbolEntity>,
        @InjectRepository(FundingRate) private frRepo: Repository<FundingRate>,
    ) {}

    private async loadExchangeIds(): Promise<Map<string, number>> {
        const exchanges = await this.exRepo.find({ select: ["id", "code"] });
        return new Map(exchanges.map((e) => [e.code, e.id]));
    }

    private async ensureSymbols(
        canonicals: string[],
    ): Promise<Map<string, number>> {
        const uniq = [...new Set(canonicals.map(c => c.toUpperCase()))];

        const existing = await this.symRepo.find({
            select: ["id", "canonical"],
            where: { canonical: In(uniq) },
        });

        const existingSet = new Set(existing.map(r => r.canonical));
        const missing = uniq.filter(c => !existingSet.has(c));
        if (missing.length) {
            await this.symRepo.insert(
                missing.map(canonical => ({ canonical })),
            );
        }

        const rows =
            missing.length
                ? await this.symRepo.find({
                    select: ["id", "canonical"],
                    where: { canonical: In(uniq) },
                })
                : existing;

        return new Map(rows.map(r => [r.canonical, r.id]));
    }

    async ingest(rows: IngestRow[]): Promise<{ insertedOrUpdated: number }> {
        if (!rows?.length) return { insertedOrUpdated: 0 };

        const exIdByCode = await this.loadExchangeIds();
        const symIdByCanonical = await this.ensureSymbols(rows.map((r) => r.canonical));

        const payload: Partial<FundingRate>[] = [];

        for (const r of rows) {
            const exchangeId = exIdByCode.get(r.exchangeCode);
            const symbolId = symIdByCanonical.get(r.canonical.toUpperCase());
            if (!exchangeId || !symbolId) continue;

            payload.push({
                exchangeId,
                symbolId,
                fundingTimeMs: r.fundingTimeMs,
                intervalHours: r.intervalHours,
                fundingRate: r.fundingRateInt,
                markPrice: r.markPrice ?? null,
                nextFundingTimeMs: r.nextFundingTimeMs ?? null,
                retrievedAtMs: r.retrievedAtMs,
            });
        }

        if (!payload.length) return { insertedOrUpdated: 0 };

        await this.frRepo.upsert(payload, ["exchangeId", "symbolId"]);

        return { insertedOrUpdated: payload.length };
    }
}
