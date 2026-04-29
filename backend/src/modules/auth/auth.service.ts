import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SignupDto } from './DTO/signup.dto';
import { LoginDto } from './DTO/login.dto';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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

    const isValid = await argon2.verify(currentUser.passwordHash,password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(currentUser);
  }

  private async buildAuthResponse(user: User) {
    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);
    const { passwordHash: _, ...safeUser } = user;
    return { accessToken, user: safeUser };
  }
}
