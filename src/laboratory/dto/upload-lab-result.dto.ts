
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UploadLabResultDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  resultText: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  resultFileUrl?: string;
}
