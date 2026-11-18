import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiveStockDto {
  @IsString()
  @IsNotEmpty()
  medicineId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  batchNumber: string;

  @IsDateString()
  expiryDate: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantityReceived: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  purchasePrice?: number;
}