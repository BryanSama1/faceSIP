import AuthLayout from '@/components/layout/auth-layout';
import LoginForm from '@/components/forms/login-form';

export default function LoginPage() {
  return (
    <AuthLayout title="Welcome Back!" subtitle="Log in using your face.">
      <LoginForm />
    </AuthLayout>
  );
}
