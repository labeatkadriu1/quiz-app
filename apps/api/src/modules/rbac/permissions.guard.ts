import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class PermissionsGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // Policy evaluation will be introduced once auth claims are in place.
    return true;
  }
}
