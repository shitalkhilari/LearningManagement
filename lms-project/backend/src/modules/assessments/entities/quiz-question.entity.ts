import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Quiz } from './quiz.entity';
import { QuizOption } from './quiz-option.entity';
import { QuizResponse } from './quiz-response.entity';

@Entity('quiz_questions')
export class QuizQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quiz_id', type: 'uuid' })
  quizId: string;

  @ManyToOne(() => Quiz, (quiz) => quiz.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: Quiz;

  @Column({ name: 'question_text', type: 'text' })
  questionText: string;

  @Column({ type: 'int' })
  sequence: number;

  @OneToMany(() => QuizOption, (option) => option.question)
  options: QuizOption[];

  @OneToMany(() => QuizResponse, (response) => response.question)
  responses: QuizResponse[];
}
