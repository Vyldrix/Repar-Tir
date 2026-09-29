import crypto from 'node:crypto';
import prisma from '../lib/prisma.js';
import { RegisterDto, UserResponseDto } from '../dtos/auth.dto.js';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export type UserResponse = UserResponseDto;

export class UserModel {
  static async findByEmail(email: string): Promise<User | undefined> {
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
        },
      },
    });

    if (!user) return undefined;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt.toISOString(),
    };
  }

  static async findByUsername(username: string): Promise<User | undefined> {
    const user = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
        },
      },
    });

    if (!user) return undefined;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt.toISOString(),
    };
  }

  static async create(data: RegisterDto): Promise<User> {
    // Cifrado seguro utilizando sal y PBKDF2 de node:crypto
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data.password, salt, 1000, 64, 'sha512').toString('hex');
    const passwordHash = `${salt}:${hash}`;

    const newUser = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash,
      },
    });

    return {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      passwordHash: newUser.passwordHash,
      createdAt: newUser.createdAt.toISOString(),
    };
  }

  static toResponse(user: User): UserResponseDto {
    const { passwordHash: _passwordHash, ...userResponse } = user;
    return userResponse;
  }

  static verifyPassword(plainPassword: string, storedHash: string): boolean {
    const [salt, originalHash] = storedHash.split(':');
    if (!salt || !originalHash) return false;
    const hash = crypto.pbkdf2Sync(plainPassword, salt, 1000, 64, 'sha512').toString('hex');
    return hash === originalHash;
  }

  static async clear(): Promise<void> {
    await prisma.list.deleteMany();
    await prisma.user.deleteMany();
  }
}
