import { Controller, Get, Query } from "@nestjs/common";
import { ArbitrageService } from "./arbitrage.service";
import { ArbitrageQueryDto } from "./arbitrage.query.dto";

@Controller("arbitrage")
export class ArbitrageController {
    constructor(private readonly arb: ArbitrageService) {}

    @Get()
    get(@Query() q: ArbitrageQueryDto) {
        return this.arb.getArbitrage(
            q.page,
            q.limit,
            q.min,
        );
    }
}
