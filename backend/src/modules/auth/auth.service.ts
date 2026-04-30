import {
  ConflictException,
  Injectable,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { SignupDto } from './DTO/signup.dto';
import { LoginDto } from './DTO/login.dto';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { User } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    private redisService: RedisService,
  ) {}

  async signup(signupDto: SignupDto) {
    const { email, password } = signupDto;

    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('User already exists.');
    }

    const options = {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    };

    const passwordHash = await argon2.hash(password, options);

    const newUser = await this.usersService.create(email, passwordHash);

    return this.buildAuthResponse(newUser);
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const currentUser = await this.usersService.findByEmail(email);
    if (!currentUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await argon2.verify(currentUser.passwordHash, password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(currentUser);
  }

  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const payload = await this.jwtService.verifyAsync(refreshToken, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
    });

    const userId = payload.sub;

    const storedToken = await this.redisService.get(`refreshToken:${userId}`);

    if (!storedToken) {
      throw new UnauthorizedException('Session expired');
    }

    const isValid = await argon2.verify(storedToken, refreshToken);

    if (!isValid) {
      throw new UnauthorizedException('Token mismatch');
    }

    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: User) {
    const payload = { sub: user.id, email: user.email };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.getOrThrow<string>('JWT_REFRESH_EXPIRATION') as any,
    });
    const hashedRefreshToken = await argon2.hash(refreshToken);
    await this.redisService.set(
      `refreshToken:${user.id}`,
      hashedRefreshToken,
      604800,
    );
    const { passwordHash: _, ...safeUser } = user;
    return { refreshToken, accessToken, user: safeUser };
  }
}
