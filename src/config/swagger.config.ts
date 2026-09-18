import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ACCESS_TOKEN_COOKIE } from '../modules/auth/infrastructure/auth-cookies';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Mood Diary API')
    .setDescription('Backend API for the Mood Diary learning project')
    .setVersion('0.1.0')
    .addCookieAuth(ACCESS_TOKEN_COOKIE, {
      type: 'apiKey',
      in: 'cookie',
      name: ACCESS_TOKEN_COOKIE,
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
}
