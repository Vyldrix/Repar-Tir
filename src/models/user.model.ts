import bcrypt from 'bcrypt';
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

/**
 * =========================================================================
 * NOTA PARA EL EQUIPO / COMPAÑERA (HU #11 - Cifrado con Bcrypt):
 * 1. Factor de costo (Salt Rounds = 10):
 *    Se utiliza 10 salt rounds como estándar recomendado por OWASP para
 *    proteger contra ataques de fuerza bruta y diccionarios, garantizando al
 *    mismo tiempo tiempos de respuesta óptimos (< 200 ms).
 * 2. Protección de contraseñas:
 *    La contraseña en texto plano NUNCA se persiste en la base de datos ni
 *    se expone en logs o respuestas.
 * =========================================================================
 */
export const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

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

  static async findById(id: string): Promise<User | undefined> {
    const user = await prisma.user.findUnique({
      where: {
        id,
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
    // Cifrar la contraseña con el algoritmo bcrypt utilizando un factor de costo adecuado antes de persistir
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

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

  static toResponse(user: User): UserResponse {
    // Garantizar que la contraseña o su hash nunca se incluyan en la respuesta del usuario
    const { passwordHash: _passwordHash, ...userResponse } = user;
    return userResponse;
  }

  static async verifyPassword(plainPassword: string, storedHash: string): Promise<boolean> {
    try {
      if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
        return await bcrypt.compare(plainPassword, storedHash);
      }
      // Soporte retrocompatible por si existen hashes creados con PBKDF2 previamente
      const [salt, originalHash] = storedHash.split(':');
      if (salt && originalHash) {
        const hash = crypto.pbkdf2Sync(plainPassword, salt, 1000, 64, 'sha512').toString('hex');
        return hash === originalHash;
      }
      return await bcrypt.compare(plainPassword, storedHash);
    } catch {
      return false;
    }
  }

  static async clear(): Promise<void> {
    await prisma.list.deleteMany();
    await prisma.user.deleteMany();
  }
}
