import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import {
  AllergySeverity,
  AllergyType,
} from '../../generated/prisma/client.js';

export class CreatePatientAllergyDto {
  @IsUUID()
  patientId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  allergen!: string;

  @IsEnum(AllergyType)
  type!: AllergyType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reaction?: string;

  @IsOptional()
  @IsEnum(AllergySeverity)
  severity?: AllergySeverity;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}