import { Type } from "class-transformer";
import {
    IsInt,
    IsNumber,
    Min,
    Max,
} from "class-validator";

export class ArbitrageQueryDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page: number = 1;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit: number = 20;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    min: number = 0;
}
