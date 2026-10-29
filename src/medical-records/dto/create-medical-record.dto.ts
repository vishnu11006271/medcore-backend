
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateMedicalRecordDto {
  @IsUUID()
  appointmentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  diagnosis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  symptoms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  clinicalNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  treatmentPlan?: string;
}
