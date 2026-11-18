import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DispensePrescriptionItemDto {
  @IsString()
  @IsNotEmpty()
  prescriptionItemId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class DispensePrescriptionDto {
  @IsString()
  @IsNotEmpty()
  prescriptionId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DispensePrescriptionItemDto)
  items: DispensePrescriptionItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}