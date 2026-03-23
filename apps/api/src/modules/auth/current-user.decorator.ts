import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface RequestWithUser {
  authUser?: AuthenticatedUser;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const req = ctx.switchToHttp().getRequest<RequestWithUser>();
  if (!req.authUser) {
    throw new Error('Auth user not found on request');
  }

  return req.authUser;
});
