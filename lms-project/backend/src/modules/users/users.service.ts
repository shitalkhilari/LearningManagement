import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { paginate } from '../../common/utils/pagination';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserRole } from '../../common/enums/user-role.enum';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const email = dto.email.trim().toLowerCase();
    await this.ensureEmailAvailable(email);
    const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.usersRepository.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email,
      password,
      role: dto.role,
      isActive: dto.isActive ?? true,
    });
    return this.usersRepository.save(user);
  }

  async findAll(query: ListUsersQueryDto): Promise<PaginatedResult<User>> {
    const qb = this.usersRepository.createQueryBuilder('user').orderBy('user.createdAt', 'DESC');
    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }
    if (query.search) {
      qb.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    return paginate(qb, query.page, query.limit);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: email.trim().toLowerCase() })
      .getOne();
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      if (email !== user.email) {
        await this.ensureEmailAvailable(email);
        user.email = email;
      }
    }
    if (dto.firstName !== undefined) {
      user.firstName = dto.firstName.trim();
    }
    if (dto.lastName !== undefined) {
      user.lastName = dto.lastName.trim();
    }
    if (dto.role !== undefined) {
      user.role = dto.role;
    }
    if (dto.isActive !== undefined) {
      user.isActive = dto.isActive;
    }
    return this.usersRepository.save(user);
  }

  async countByRole(): Promise<{
    totalUsers: number;
    totalLearners: number;
    totalInstructors: number;
    totalAdmins: number;
  }> {
    const rows = await this.usersRepository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.role')
      .getRawMany<{ role: UserRole; count: string }>();

    const counts = new Map(rows.map((row) => [row.role, Number(row.count)]));
    const totalLearners = counts.get(UserRole.LEARNER) ?? 0;
    const totalInstructors = counts.get(UserRole.INSTRUCTOR) ?? 0;
    const totalAdmins = counts.get(UserRole.ADMIN) ?? 0;
    return {
      totalUsers: totalLearners + totalInstructors + totalAdmins,
      totalLearners,
      totalInstructors,
      totalAdmins,
    };
  }

  private async ensureEmailAvailable(email: string): Promise<void> {
    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }
  }
}
