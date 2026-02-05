import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from "typeorm";
import { Exchange } from "./exchange.entity";
import { SymbolEntity } from "./symbol.entity";

@Index("uq_funding_exchange_symbol", ["exchangeId", "symbolId"], { unique: true })
@Entity({ name: "funding_rate" })
export class FundingRate {
    @PrimaryGeneratedColumn({ type: "int" })
    id!: number;

    @Column({ type: "int", nullable: false })
    exchangeId!: number;

    @ManyToOne(() => Exchange, (e) => e.fundingRates, { nullable: false })
    @JoinColumn({ name: "exchangeId" })
    exchange?: Exchange;

    @Column({ type: "int", nullable: false })
    symbolId!: number;

    @ManyToOne(() => SymbolEntity, (s) => s.fundingRates, { nullable: false })
    @JoinColumn({ name: "symbolId" })
    symbol?: SymbolEntity;

    @Column({ type: "bigint", nullable: false })
    fundingTimeMs!: string;

    @Column({ type: "int", nullable: false })
    intervalHours!: number;

    @Column({ type: "bigint", nullable: false })
    fundingRate!: string;

    @Column({ type: "bigint", nullable: true })
    markPrice!: string | null;

    @Column({ type: "bigint", nullable: true })
    nextFundingTimeMs!: string | null;

    @Index()
    @Column({ type: "bigint", nullable: false })
    retrievedAtMs!: string;
}
