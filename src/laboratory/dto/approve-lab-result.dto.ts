
import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ApproveLabResultDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  approvalNotes?: string;
}
