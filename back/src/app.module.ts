import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AuthModule, 
    UsersModule, 
    PrismaModule, 
    ConfigModule.forRoot({ isGlobal: true}),
    PassportModule.register({ session: true }),
    UsersModule
  ],
})
export class AppModule {}
