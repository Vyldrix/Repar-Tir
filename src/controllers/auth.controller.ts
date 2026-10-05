import { Request, Response } from 'express';
import { UserModel } from '../models/user.model.js';
import { signJWT } from '../middlewares/auth.middleware.js';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    const { username, email, password } = req.body;

    // 1. Validar presencia de campos obligatorios
    if (!username || !email || !password) {
      res.status(400).json({
        message: 'Todos los campos (username, email, password) son obligatorios',
      });
      return;
    }

    // 2. Validar formatos requeridos
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        message: 'El formato del correo electrónico no es válido',
      });
      return;
    }

    if (typeof password !== 'string' || password.length < 6) {
      res.status(400).json({
        message: 'La contraseña debe tener al menos 6 caracteres',
      });
      return;
    }

    // 3. Validar duplicados (email y username)
    const existingEmail = await UserModel.findByEmail(email);
    if (existingEmail) {
      res.status(409).json({
        message: 'El correo electrónico ya se encuentra registrado',
      });
      return;
    }

    const existingUsername = await UserModel.findByUsername(username);
    if (existingUsername) {
      res.status(409).json({
        message: 'El nombre de usuario ya se encuentra registrado',
      });
      return;
    }

    // 4. Crear usuario con contraseña cifrada mediante bcrypt (HU #11) y retornar respuesta 201 Created sin datos sensibles
    const newUser = await UserModel.create({ username, email, password });
    const userResponse = UserModel.toResponse(newUser);

    res.status(201).json(userResponse);
  }

  static async login(req: Request, res: Response): Promise<void> {
    const { username, email, password } = req.body;

    // 1. Validar presencia de campos obligatorios
    if ((!email && !username) || !password) {
      res.status(400).json({
        message: 'Debe ingresar su correo o nombre de usuario y su contraseña',
      });
      return;
    }

    // 2. Validar formato de email si se envió
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          message: 'El formato del correo electrónico no es válido',
        });
        return;
      }
    }

    // 3. Buscar usuario por email o username
    let user;
    if (email) {
      user = await UserModel.findByEmail(email);
    } else if (username) {
      user = await UserModel.findByUsername(username);
    }

    if (!user) {
      res.status(401).json({
        message: 'El correo electrónico o nombre de usuario no se encuentra registrado',
      });
      return;
    }

    // 4. Validar que la contraseña coincida con la registrada utilizando bcrypt compare
    const isPasswordValid = await UserModel.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({
        message: 'La contraseña ingresada no coincide con la registrada',
      });
      return;
    }

    // 5. Responder 200 OK con el usuario sin datos sensibles y token de sesión JWT
    const userResponse = UserModel.toResponse(user);
    const token = signJWT({ userId: user.id });
    res.status(200).json({
      message: 'Inicio de sesión exitoso',
      user: userResponse,
      token,
    });
  }
}
