import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateQuizDto {
  @ApiProperty({ example: 'Module 1 check' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'A short quiz on the first module.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 70, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  passingPercentage: number;

  @ApiPropertyOptional({ description: 'Optional module this quiz belongs to' })
  @IsOptional()
  @IsUUID()
  moduleId?: string;
}
