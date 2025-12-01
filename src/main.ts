import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // para que luego Angular pueda llamar a la API
  await app.listen(3000);
  console.log('API Promanage escuchando en http://localhost:3000');
}
bootstrap();
