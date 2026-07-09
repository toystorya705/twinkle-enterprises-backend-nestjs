import { UnauthorizedException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { Role: true, UserRole: { include: { Role: true } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const validPassword = await compare(dto.password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const roles = Array.from(
      new Set([
        ...(user.Role ? [user.Role.name] : []),
        ...user.UserRole.map((entry) => entry.Role.name),
      ]),
    );
    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      roles,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        country: user.country,
        companyName: user.companyName,
        avatarUrl: user.avatarUrl,
        roleId: user.roleId,
        roles,
      },
    };
  }
}
