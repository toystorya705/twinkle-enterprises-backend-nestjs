import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@twinkle.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password' })
  @IsString()
  @MinLength(8)
  password!: string;
}
