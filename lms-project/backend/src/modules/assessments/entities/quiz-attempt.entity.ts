import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { QuizAttemptStatus } from '../../../common/enums/quiz-attempt-status.enum';
import { Quiz } from './quiz.entity';
import { User } from '../../users/entities/user.entity';
import { QuizResponse } from './quiz-response.entity';

@Entity('quiz_attempts')
export class QuizAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quiz_id', type: 'uuid' })
  quizId: string;

  @ManyToOne(() => Quiz, (quiz) => quiz.attempts, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: Quiz;

  @Column({ name: 'learner_id', type: 'uuid' })
  learnerId: string;

  @ManyToOne(() => User, (user) => user.quizAttempts, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'learner_id' })
  learner: User;

  @Column({ type: 'int' })
  score: number;

  @Column({ name: 'total_questions', type: 'int' })
  totalQuestions: number;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  percentage: number;

  @Column({ type: 'varchar', length: 10 })
  status: QuizAttemptStatus;

  @Column({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;

  @OneToMany(() => QuizResponse, (response) => response.attempt)
  responses: QuizResponse[];
}
