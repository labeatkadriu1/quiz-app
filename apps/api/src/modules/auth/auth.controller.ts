import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

@Controller('auth')
export class AuthController {
  @Post('login')
  login(@Body() body: LoginDto): { message: string; email: string } {
    return {
      message: 'Login flow will be implemented with JWT in next step.',
      email: body.email
    };
  }
}
