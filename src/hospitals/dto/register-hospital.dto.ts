
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterHospitalDto {
  // Hospital details
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  hospitalName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  slug: string;

  @IsEmail()
  @MaxLength(254)
  hospitalEmail: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  hospitalPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  // Initial Hospital Admin details
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  adminFirstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  adminLastName: string;

  @IsEmail()
  @MaxLength(254)
  adminEmail: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  adminPhone?: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;
}
