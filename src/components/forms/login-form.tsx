
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import FaceCapture from '@/components/face/face-capture';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Loader2, LogIn } from 'lucide-react';

export default function LoginForm() {
  const [capturedFaceUri, setCapturedFaceUri] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { loginWithFace, users } = useAuth(); // Access users to check if any are registered
  const router = useRouter();
  const { toast } = useToast();

  const handleFaceCaptured = (dataUrl: string) => {
    setCapturedFaceUri(dataUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (users.length === 0) {
      toast({ title: "Login Not Possible", description: "No users are registered in the system. Please sign up first.", variant: "destructive" });
      return;
    }
    if (!capturedFaceUri) {
      toast({ title: "Face Capture Required", description: "Please capture your face to log in.", variant: "destructive" });
      return;
    }

    setIsLoggingIn(true);
    try {
      const success = await loginWithFace(capturedFaceUri);
      if (success) {
        toast({ title: "Login Successful", description: "Welcome back!" });
        router.push('/dashboard');
      } else {
        // This message might need adjustment based on how authContext.loginWithFace behaves.
        // If it always succeeds if a face is captured and users exist, this branch might not be hit often
        // unless there's an internal error in loginWithFace.
        toast({ title: "Login Failed", description: "Face not recognized or no users registered. Please try again or sign up.", variant: "destructive" });
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
      <div className="space-y-2">
        <Label className="font-medium text-foreground text-center block">Log In with Your Face</Label>
        <p className="text-sm text-muted-foreground text-center">
          Ensure good lighting and a clear view of your face.
        </p>
        <FaceCapture onFaceCaptured={handleFaceCaptured} captureButtonText="Capture Face for Login" />
        {capturedFaceUri && <p className="text-xs text-green-600 text-center">Face captured successfully!</p>}
        {users.length === 0 && !isLoggingIn && (
           <p className="text-xs text-amber-600 text-center pt-2">No users registered. Please sign up.</p>
        )}
      </div>

      <Button type="submit" disabled={isLoggingIn || !capturedFaceUri || users.length === 0} className="w-full">
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
