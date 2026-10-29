import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVitalSignDto {
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(300)
  systolicBP?: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(200)
  diastolicBP?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  pulseBpm?: number;

  @IsOptional()
  @IsNumber()
  @Min(25)
  @Max(45)
  temperatureC?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  respiratoryRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  oxygenSaturation?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  heightCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  weightKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}