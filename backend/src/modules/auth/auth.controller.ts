import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Request, Response } from 'express';
import { SignupDto } from './DTO/signup.dto';
import { LoginDto } from './DTO/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {

    constructor (private authService: AuthService){}

    @Get('me')
    @UseGuards(AuthGuard('jwt'))
    getMe(@CurrentUser() user : any) {
        return user;
    }

    @Post('signup')
    async signup( @Body() signupDto : SignupDto ){
        const user = await this.authService.signup(signupDto);
        return user;
    }

    @Post('login')
    @HttpCode(200)
    async login( @Body() loginDto : LoginDto ){
        const user = await this.authService.login(loginDto);
        return user;
    }

    @Post('refresh-token')
    @HttpCode(200)
    async refeshToken (@Req() req : Request){
        const refreshToken = req.cookies?.refreshToken;
        const result = await this.authService.refreshToken(refreshToken);
        return result;
    }
}
