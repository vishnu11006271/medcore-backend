import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

export class GetUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn([
    'SUPER_ADMIN',
    'HOSPITAL_ADMIN',
    'DOCTOR',
    'NURSE',
    'RECEPTIONIST',
    'LAB_TECHNICIAN',
    'PHARMACIST',
    'ACCOUNTANT',
    'PATIENT',
  ])
  role?: string;

  @IsOptional()
  @IsString()
  hospitalId?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  emailVerified?: string;

  @IsOptional()
  @Matches(/^[1-9]\d*$/)
  page?: string;

  @IsOptional()
  @Matches(/^[1-9]\d*$/)
  limit?: string;
}