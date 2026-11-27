import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { QuizAttempt } from './quiz-attempt.entity';
import { QuizQuestion } from './quiz-question.entity';
import { QuizOption } from './quiz-option.entity';

@Entity('quiz_responses')
export class QuizResponse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'attempt_id', type: 'uuid' })
  attemptId: string;

  @ManyToOne(() => QuizAttempt, (attempt) => attempt.responses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attempt_id' })
  attempt: QuizAttempt;

  @Column({ name: 'question_id', type: 'uuid' })
  questionId: string;

  @ManyToOne(() => QuizQuestion, (question) => question.responses, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'question_id' })
  question: QuizQuestion;

  @Column({ name: 'selected_option_id', type: 'uuid' })
  selectedOptionId: string;

  @ManyToOne(() => QuizOption, (option) => option.responses, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'selected_option_id' })
  selectedOption: QuizOption;

  @Column({ name: 'is_correct' })
  isCorrect: boolean;
}
