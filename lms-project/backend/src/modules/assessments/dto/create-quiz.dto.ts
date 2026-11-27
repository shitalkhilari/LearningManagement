import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

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

  @ApiProperty({ description: 'Module this quiz belongs to. A module can have more than one quiz.' })
  @IsUUID()
  moduleId: string;
}
