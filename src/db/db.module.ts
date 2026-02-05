import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Exchange } from "./entities/exchange.entity";
import { SymbolEntity } from "./entities/symbol.entity";
import { FundingRate } from "./entities/funding-rate.entity";
import { SeedService } from "./seed.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Exchange,
            SymbolEntity,
            FundingRate,
        ]),
    ],
    providers: [SeedService],
    exports: [
        TypeOrmModule,
        SeedService,
    ],
})
export class DbModule {}
