import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  AllergySeverity,
  AllergyType,
} from '../../generated/prisma/client.js';

export class UpdatePatientAllergyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  allergen?: string;

  @IsOptional()
  @IsEnum(AllergyType)
  type?: AllergyType;

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