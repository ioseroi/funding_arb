import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module";
import { AsterClient } from "./aster.client";
import { MexcClient } from "./mexc.client";
import { FundingIngestService } from "./funding-ingest.service";
import { FundingCollectorService } from "./funding-collector.service";
import { FundingJob } from "./funding.job";

@Module({
    imports: [DbModule],
    providers: [
        AsterClient,
        MexcClient,
        FundingIngestService,
        FundingCollectorService,
        FundingJob,
    ],
    exports: [FundingCollectorService],
})
export class FundingModule {}
