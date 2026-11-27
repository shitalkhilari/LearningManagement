import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateEnrollmentDto {
  @ApiProperty({ example: '3f1c0c3e-6a1d-4c2a-9c1e-0b7d2a6f4e11' })
  @IsUUID()
  courseId: string;
}
