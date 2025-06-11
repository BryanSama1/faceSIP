import AuthLayout from '@/components/layout/auth-layout';
import SignupForm from '@/components/forms/signup-form';

export default function SignupPage() {
  return (
    <AuthLayout title="Create Your Account" subtitle="Join FaceLog with a quick face scan.">
      <SignupForm />
    </AuthLayout>
  );
}
