export interface RegisterDto {
  username: string;
  email: string;
  password: string;
}

export interface LoginDto {
  username?: string;
  email?: string;
  password: string;
}

export interface UserResponseDto {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}
