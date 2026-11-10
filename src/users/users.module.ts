import { Module } from '@nestjs/common';
import { PasswordHasher } from './password-hasher.js';
import { UsersService } from './users.service.js';

@Module({
  providers: [UsersService, PasswordHasher],
  exports: [UsersService, PasswordHasher],
})
export class UsersModule {}
