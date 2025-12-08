import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors(); // para que luego Angular pueda llamar a la API

  const port = process.env.PORT || 3000; // 👈 Railway asigna este puerto automáticamente

  await app.listen(port, '0.0.0.0'); // 👈 Obligatorio para permitir conexiones externas

  console.log(`API Promanage escuchando en el puerto ${port}`);
}
bootstrap();
