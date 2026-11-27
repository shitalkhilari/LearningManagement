import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateLessonDto {
  @ApiProperty({ example: 'What is a module?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'A short explanation of Nest modules.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'A module groups related controllers and providers.' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
