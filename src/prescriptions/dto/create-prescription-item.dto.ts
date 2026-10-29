import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';

export class CreatePrescriptionItemDto {
  @IsUUID()
  medicineId: string;

  @IsString()
  @MaxLength(100)
  dosage: string;

  @IsString()
  @MaxLength(100)
  frequency: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;
}