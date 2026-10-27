import {
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  MaxLength,
  MinLength,
  IsNotEmpty,
} from 'class-validator';

export class CreateDoctorDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  temporaryPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  licenseNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  specialization!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  qualification?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  consultationFee?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}