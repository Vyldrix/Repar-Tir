import crypto from 'node:crypto';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export type UserResponse = Omit<User, 'passwordHash'>;

const users: User[] = [];

export class UserModel {
  static async findByEmail(email: string): Promise<User | undefined> {
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  static async findByUsername(username: string): Promise<User | undefined> {
    return users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  }

  static async create(data: { username: string; email: string; password: string }): Promise<User> {
    // Cifrado seguro utilizando sal y PBKDF2 de node:crypto
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data.password, salt, 1000, 64, 'sha512').toString('hex');
    const passwordHash = `${salt}:${hash}`;

    const newUser: User = {
      id: crypto.randomUUID(),
      username: data.username,
      email: data.email,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    return newUser;
  }

  static toResponse(user: User): UserResponse {
    const { passwordHash, ...userResponse } = user;
    return userResponse;
  }

  static verifyPassword(plainPassword: string, storedHash: string): boolean {
    const [salt, originalHash] = storedHash.split(':');
    if (!salt || !originalHash) return false;
    const hash = crypto.pbkdf2Sync(plainPassword, salt, 1000, 64, 'sha512').toString('hex');
    return hash === originalHash;
  }

  static clear(): void {
    users.length = 0;
  }
}
