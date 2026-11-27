import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class QuizOptionDto {
  @ApiProperty({ example: 'A provider' })
  @IsString()
  @IsNotEmpty()
  optionText: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  isCorrect: boolean;
}
