import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { DbModule } from "./db/db.module";
import { FundingModule } from "./funding/funding.module";
import { Exchange } from "./db/entities/exchange.entity";
import { SymbolEntity } from "./db/entities/symbol.entity";
import { FundingRate } from "./db/entities/funding-rate.entity";
import { ArbitrageModule } from "./arbitrage/arbitrage.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ScheduleModule.forRoot(),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: "postgres",
        host: cfg.get<string>("DB_HOST"),
        port: Number(cfg.get<string>("DB_PORT")),
        username: cfg.get<string>("DB_USER"),
        password: cfg.get<string>("DB_PASSWORD"),
        database: cfg.get<string>("DB_NAME"),
        entities: [Exchange, SymbolEntity, FundingRate],
        synchronize: cfg.get<string>("DB_SYNC") === "true",
        logging: cfg.get<string>("DB_LOGGING") === "true",
        keepConnectionAlive: true,
      }),
    }),

    DbModule,
    FundingModule,
    ArbitrageModule,
  ],
})
export class AppModule {}
