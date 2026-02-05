import { Entity, Column, PrimaryGeneratedColumn, Index, OneToMany } from "typeorm";
import { FundingRate } from "./funding-rate.entity";

export enum ExchangeType {
    CEX = 1,
    DEX = 2,
}

@Entity({ name: "exchange" })
export class Exchange {
    @PrimaryGeneratedColumn({ type: "int" })
    id!: number;

    @Index({ unique: true })
    @Column({ type: "varchar", length: 32, nullable: false })
    code!: string; // mexc / aster

    @Column({ type: "varchar", length: 64, nullable: false })
    name!: string;

    @Index()
    @Column({ type: "int", nullable: false })
    type!: ExchangeType;

    @OneToMany(() => FundingRate, (fr) => fr.exchange)
    fundingRates?: FundingRate[];
}
