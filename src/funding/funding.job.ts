import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { FundingCollectorService } from "./funding-collector.service";
import { sleep } from "./funding.utils";

@Injectable()
export class FundingJob implements OnModuleInit, OnModuleDestroy {
    private readonly log = new Logger(FundingJob.name);
    private stopped = false;

    constructor(
        private readonly collector: FundingCollectorService,
        private readonly dataSource: DataSource,
        private readonly config: ConfigService,
    ) {}

    onModuleInit() {
        const msRaw = this.config.get<string>("FUNDING_POLL_MS", "45000");
        const ms = Number(msRaw);

        if (!Number.isFinite(ms) || ms < 5_000) {
            throw new Error(`Bad FUNDING_POLL_MS="${msRaw}" (min 5000)`);
        }

        this.log.log(`Funding job interval = ${ms}ms`);
        void this.loop(ms);
    }

    onModuleDestroy() {
        this.stopped = true;
    }

    private async loop(ms: number) {
        while (!this.stopped) {
            try {
                await this.tick();
            } catch (e) {}

            if (this.stopped) break;

            await sleep(ms);
        }
    }

    private async tick() {
        const lockId = 424242;

        try {
            const got: Array<{ locked: boolean }> = await this.dataSource.query(
                `SELECT pg_try_advisory_lock($1) AS locked`,
                [lockId],
            );

            if (!got?.[0]?.locked) {
                this.log.debug("Funding tick skipped (advisory lock not acquired)");
                return;
            }

            try {
                const t0 = Date.now();
                const r = await this.collector.runOnce();
                const dt = Date.now() - t0;

                this.log.log(
                    `funding ingest: aster=${r.aster} mexc=${r.mexc} (${dt}ms)`,
                );
            } finally {
                await this.dataSource.query(`SELECT pg_advisory_unlock($1)`, [lockId]);
            }
        } catch (e: any) {
            this.log.warn(`funding ingest failed: ${e?.message || e}`);
        }
    }
}
