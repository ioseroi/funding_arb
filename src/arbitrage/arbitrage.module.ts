import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ArbitrageService } from "./arbitrage.service";
import { ArbitrageController } from "./arbitrage.controller";
import { FundingRate } from "../db/entities/funding-rate.entity";
import { SymbolEntity } from "../db/entities/symbol.entity";
import { Exchange } from "../db/entities/exchange.entity";

@Module({
    imports: [TypeOrmModule.forFeature([FundingRate, SymbolEntity, Exchange])],
    providers: [ArbitrageService],
    controllers: [ArbitrageController],
})
export class ArbitrageModule {}
