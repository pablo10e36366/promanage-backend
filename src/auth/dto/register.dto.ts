export class RegisterDto {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'colaborador' | 'usuario';
}
