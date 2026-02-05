import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Exchange, ExchangeType } from "./entities/exchange.entity";

@Injectable()
export class SeedService implements OnModuleInit {
    constructor(
        @InjectRepository(Exchange)
        private readonly exchangeRepo: Repository<Exchange>,
    ) {}

    async onModuleInit() {
        await this.exchangeRepo.upsert(
            [
                {
                    code: "mexc",
                    name: "MEXC",
                    type: ExchangeType.CEX,
                },
                {
                    code: "aster",
                    name: "Aster",
                    type: ExchangeType.DEX,
                },
            ],
            ["code"],
        );
    }
}
