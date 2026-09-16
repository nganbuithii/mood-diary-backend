import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenPayload, TokenIssuer } from '../domain/token-issuer';

@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  constructor(private readonly jwtService: JwtService) {}

  issueAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }
}
