"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import FaceCapture from '@/components/face/face-capture';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Loader2, LogIn } from 'lucide-react';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [capturedFaceUri, setCapturedFaceUri] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { loginWithFace } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleFaceCaptured = (dataUrl: string) => {
    setCapturedFaceUri(dataUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Email Required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    if (!capturedFaceUri) {
      toast({ title: "Face Capture Required", description: "Please capture your face to log in.", variant: "destructive" });
      return;
    }

    setIsLoggingIn(true);
    try {
      const success = await loginWithFace(email, capturedFaceUri);
      if (success) {
        toast({ title: "Login Successful", description: "Welcome back!" });
        router.push('/dashboard');
      } else {
        toast({ title: "Login Failed", description: "Invalid email or face not recognized. Please try again or sign up.", variant: "destructive" });
        setCapturedFaceUri(null); // Reset face capture for retry
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({ title: "Login Error", description: "An unexpected error occurred. Please try again.", variant: "destructive" });
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="email" className="font-medium text-foreground">Email Address</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="mt-1"
        />
      </div>
      
      <div className="space-y-2">
        <Label className="font-medium text-foreground">Face Capture</Label>
        <FaceCapture onFaceCaptured={handleFaceCaptured} captureButtonText="Capture Face for Login" />
        {capturedFaceUri && <p className="text-xs text-green-600 text-center">Face captured successfully!</p>}
      </div>

      <Button type="submit" disabled={isLoggingIn || !capturedFaceUri} className="w-full">
        {isLoggingIn ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="mr-2 h-4 w-4" />
        )}
        {isLoggingIn ? 'Logging In...' : 'Log In with Face'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Don't have an account?{' '}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
