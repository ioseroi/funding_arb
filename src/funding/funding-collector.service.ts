import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AsterClient } from "./aster.client";
import { MexcClient } from "./mexc.client";
import { FundingIngestService, IngestRow } from "./funding-ingest.service";
import {
    fundingDecimalToIntStr,
    normalizeAsterSymbol,
    normalizeMexcSymbol,
    priceDecimalToIntStr,
} from "./funding.utils";

async function mapPool<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let i = 0;

    async function worker() {
        while (true) {
            const idx = i++;
            if (idx >= items.length) return;
            out[idx] = await fn(items[idx], idx);
        }
    }

    const n = Math.max(1, Math.floor(concurrency || 1));
    await Promise.all(Array.from({ length: n }, () => worker()));
    return out;
}

function sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
}

@Injectable()
export class FundingCollectorService {
    private readonly log = new Logger(FundingCollectorService.name);

    private readonly FUNDING_POLL_MS: number;
    private readonly MEXC_FUNDING_RPS: number;

    constructor(
        private readonly ingest: FundingIngestService,
        private readonly aster: AsterClient,
        private readonly mexc: MexcClient,
        private readonly config: ConfigService,
    ) {
        this.FUNDING_POLL_MS = Number(this.config.get("FUNDING_POLL_MS", "45000"));
        this.MEXC_FUNDING_RPS = Number(this.config.get("MEXC_FUNDING_RPS", "19"));

        if (!this.FUNDING_POLL_MS || this.FUNDING_POLL_MS < 5000) {
            throw new Error(`Bad FUNDING_POLL_MS="${this.config.get("FUNDING_POLL_MS")}"`);
        }
        if (!this.MEXC_FUNDING_RPS || this.MEXC_FUNDING_RPS <= 0) {
            throw new Error(`Bad MEXC_FUNDING_RPS="${this.config.get("MEXC_FUNDING_RPS")}"`);
        }
    }

    async runOnce() {
        const retrievedAtMs = String(Date.now());
        const runStart = Date.now();

        let asterRows: IngestRow[] = [];
        try {
            const aster = await this.aster.fetchFunding();
            asterRows = aster.map((x) => ({
                exchangeCode: "aster",
                canonical: normalizeAsterSymbol(x.symbol),
                fundingRateInt: fundingDecimalToIntStr(x.lastFundingRate),
                fundingTimeMs: String(x.nextFundingTime),
                intervalHours: Number(x.fundingIntervalHours),
                markPrice: priceDecimalToIntStr(x.markPrice),
                nextFundingTimeMs: String(x.nextFundingTime),
                retrievedAtMs,
            }));
        } catch (e: any) {
            this.log.warn(`Aster fetch failed: ${e?.message || e}`);
        }

        const outA = await this.ingest.ingest(asterRows);

        let mexcRows: IngestRow[] = [];

        try {
            const symbols = (await this.mexc.getSymbols()).slice().sort();
            const markBySym = await this.mexc.getMarkPriceCentsBySymbol();

            const BATCH_SIZE = Number(this.config.get("MEXC_BATCH_SIZE", "250"));
            const batch = this.mexc.getNextBatch(symbols, BATCH_SIZE);

            const rps = this.MEXC_FUNDING_RPS;
            const workers = 5;

            this.log.log(
                `MEXC symbols=${symbols.length} rps=${rps} workers=${workers}`,
            );

            for (let i = 0; i < batch.length; i += rps) {
                if (Date.now() - runStart >= this.FUNDING_POLL_MS) break;

                const slice = batch.slice(i, i + rps);
                const t0 = Date.now();

                const results = await mapPool(slice, workers, async (sym) => {
                    try {
                        const d = await this.mexc.fetchFunding(sym);
                        if (!d) return null;

                        return {
                            exchangeCode: "mexc",
                            canonical: normalizeMexcSymbol(d.symbol),
                            fundingRateInt: fundingDecimalToIntStr(d.fundingRate),
                            fundingTimeMs: String(d.nextSettleTime),
                            intervalHours: Number(d.collectCycle),
                            markPrice: markBySym.get(sym),
                            nextFundingTimeMs: String(d.nextSettleTime),
                            retrievedAtMs,
                        } as IngestRow;
                    } catch {
                        return null;
                    }
                });

                mexcRows.push(...(results.filter(Boolean) as IngestRow[]));

                const elapsed = Date.now() - t0;
                const wait = Math.max(0, 1000 - elapsed);
                if (wait > 0) await sleep(wait);
            }
        } catch (e: any) {
            this.log.warn(`MEXC fetch failed: ${e?.message || e}`);
        }

        const outM = await this.ingest.ingest(mexcRows);

        return {
            aster: outA.insertedOrUpdated,
            mexc: outM.insertedOrUpdated,
            retrievedAtMs,
        };
    }
}
