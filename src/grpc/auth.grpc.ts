import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { OAuth2Client } from 'google-auth-library';
import { UserModel } from '../models/user.model.js';
import { signJWT, signRefreshToken } from '../middlewares/auth.middleware.js';

export interface GoogleTokenPayload {
  sub: string;
  email: string;
  name?: string;
  email_verified?: boolean;
}

export interface GrpcAuthResponse {
  message: string;
  token: string;
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    username: string;
    email: string;
    created_at: string;
  };
}

export interface AuthGrpcClient extends grpc.Client {
  LoginWithGoogle(
    request: { id_token: string },
    callback: (err: grpc.ServiceError | null, response: GrpcAuthResponse) => void
  ): grpc.ClientUnaryCall;
}

export type GoogleTokenVerifier = (idToken: string) => Promise<GoogleTokenPayload>;

const PROTO_PATH = path.resolve(process.cwd(), 'src/proto/auth.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as unknown as {
  auth: {
    AuthService: grpc.ServiceClientConstructor & {
      service: grpc.ServiceDefinition;
    };
  };
};

const authProto = protoDescriptor.auth;

async function defaultGoogleTokenVerifier(idToken: string): Promise<GoogleTokenPayload> {
  // Soporte para token de prueba interactiva en entorno local de desarrollo sin credenciales de GCP
  if (process.env.NODE_ENV !== 'production' && idToken.startsWith('dev-google:')) {
    const parts = idToken.split(':');
    const email = parts[1] || 'demo.repartir@gmail.com';
    const name = parts[2] || email.split('@')[0];
    return {
      sub: `google-dev-${email}`,
      email,
      name,
      email_verified: true,
    };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || undefined;
  const oauthClient = new OAuth2Client(clientId);
  const ticket = await oauthClient.verifyIdToken({
    idToken,
    audience: clientId,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email || !payload.sub) {
    throw new Error('El token de Google no contiene información de cuenta válida');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    email_verified: payload.email_verified,
  };
}

let activeVerifier: GoogleTokenVerifier = defaultGoogleTokenVerifier;

export function setGoogleTokenVerifier(verifier: GoogleTokenVerifier): void {
  activeVerifier = verifier;
}

export function resetGoogleTokenVerifier(): void {
  activeVerifier = defaultGoogleTokenVerifier;
}

export async function loginWithGoogleHandler(
  call: grpc.ServerUnaryCall<{ id_token?: string }, GrpcAuthResponse>,
  callback: grpc.sendUnaryData<GrpcAuthResponse>
): Promise<void> {
  const idToken = call.request?.id_token?.trim();

  if (!idToken) {
    callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: 'El id_token de Google es obligatorio',
    });
    return;
  }

  let googlePayload: GoogleTokenPayload;
  try {
    googlePayload = await activeVerifier(idToken);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Token de Google inválido o no autorizado';
    callback({
      code: grpc.status.UNAUTHENTICATED,
      message,
    });
    return;
  }

  if (!googlePayload.email || !googlePayload.sub) {
    callback({
      code: grpc.status.UNAUTHENTICATED,
      message: 'El token de Google no incluye un correo electrónico válido',
    });
    return;
  }

  try {
    const user = await UserModel.findOrCreateByGoogle({
      googleId: googlePayload.sub,
      email: googlePayload.email,
      name: googlePayload.name,
    });

    const token = signJWT({
      userId: user.id,
      id: user.id,
      username: user.username,
      email: user.email,
    });

    const refreshToken = signRefreshToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    callback(null, {
      message: 'Inicio de sesión con Google exitoso',
      token,
      access_token: token,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.createdAt,
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Error interno al autenticar con Google';
    callback({
      code: grpc.status.INTERNAL,
      message,
    });
  }
}

let grpcServerInstance: grpc.Server | null = null;
let grpcBoundPort: number | null = null;

export async function startAuthGrpcServer(port: number = 0): Promise<number> {
  if (grpcServerInstance && grpcBoundPort !== null) {
    return grpcBoundPort;
  }

  const server = new grpc.Server();
  server.addService(authProto.AuthService.service, {
    LoginWithGoogle: loginWithGoogleHandler,
  });

  return new Promise<number>((resolve, reject) => {
    server.bindAsync(
      `127.0.0.1:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (err, boundPort) => {
        if (err) {
          reject(err);
          return;
        }
        grpcServerInstance = server;
        grpcBoundPort = boundPort;
        resolve(boundPort);
      }
    );
  });
}

export async function stopAuthGrpcServer(): Promise<void> {
  if (!grpcServerInstance) return;

  const serverToStop = grpcServerInstance;
  grpcServerInstance = null;
  grpcBoundPort = null;

  return new Promise<void>((resolve) => {
    serverToStop.tryShutdown(() => {
      resolve();
    });
  });
}

export function createAuthGrpcClient(address: string): AuthGrpcClient {
  return new authProto.AuthService(
    address,
    grpc.credentials.createInsecure()
  ) as unknown as AuthGrpcClient;
}

export async function authenticateWithGoogleViaGrpc(idToken: string): Promise<GrpcAuthResponse> {
  const port = grpcBoundPort ?? (await startAuthGrpcServer(Number(process.env.GRPC_PORT) || 0));
  const client = createAuthGrpcClient(`127.0.0.1:${port}`);

  return new Promise((resolve, reject) => {
    client.LoginWithGoogle(
      { id_token: idToken },
      (err: grpc.ServiceError | null, response: GrpcAuthResponse) => {
        client.close();
        if (err) {
          reject(err);
          return;
        }
        resolve(response);
      }
    );
  });
}
