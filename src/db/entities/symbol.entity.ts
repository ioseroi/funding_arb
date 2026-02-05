import { Entity, Column, PrimaryGeneratedColumn, Index, OneToMany } from "typeorm";
import { FundingRate } from "./funding-rate.entity";

@Entity({ name: "symbol" })
export class SymbolEntity {
    @PrimaryGeneratedColumn({ type: "int" })
    id!: number;

    @Index({ unique: true })
    @Column({ type: "varchar", length: 64, nullable: false })
    canonical!: string; // BTCUSDT

    @OneToMany(() => FundingRate, (fr) => fr.symbol)
    fundingRates?: FundingRate[];
}
