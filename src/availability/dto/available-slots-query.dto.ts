import { IsDateString } from 'class-validator';

export class AvailableSlotsQueryDto {
  @IsDateString({ strict: true })
  date!: string;
}