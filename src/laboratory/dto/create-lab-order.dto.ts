
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateLabOrderDto {
  @IsUUID()
  @IsNotEmpty()
  medicalRecordId: string;

  @IsUUID()
  @IsNotEmpty()
  labTestId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
