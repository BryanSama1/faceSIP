
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import FaceCapture from '@/components/face/face-capture';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Loader2, LogIn, UserCheck } from 'lucide-react';

export default function LoginForm() {
  const [capturedFaceUri, setCapturedFaceUri] = useState<string | null>(null);
  const [capturedFaceDescriptor, setCapturedFaceDescriptor] = useState<number[] | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { loginWithFace, users, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleFaceCaptured = (dataUrl: string, descriptor: number[] | null) => {
    setCapturedFaceUri(dataUrl);
    setCapturedFaceDescriptor(descriptor);
    if (!descriptor) {
        toast({title: "Face Processing Issue", description: "Could not compute facial features from the captured image. Please try again with a clearer view of your face.", variant: "default", duration: 7000});
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!authLoading && users.length === 0) {
      toast({ title: "Login Not Possible", description: "No users are registered in the system. Please sign up first.", variant: "destructive" });
      return;
    }
    if (!capturedFaceUri) {
      toast({ title: "Face Capture Required", description: "Please capture your face to log in.", variant: "destructive" });
      return;
    }
    if (!capturedFaceDescriptor) {
      toast({ title: "Face Features Required", description: "Facial features could not be processed. Please recapture your face clearly.", variant: "destructive" });
      return;
    }

    setIsLoggingIn(true);
    try {
      const success = await loginWithFace(capturedFaceUri, capturedFaceDescriptor);
      if (success) {
        toast({ title: "Login Successful", description: "Welcome back!" });
        router.push('/dashboard');
      } else {
        // Specific failure toasts are handled within loginWithFace (e.g., "Face not recognized")
        setCapturedFaceUri(null); 
        setCapturedFaceDescriptor(null);
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({ title: "Login Error", description: "An unexpected error occurred. Please try again.", variant: "destructive" });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const canAttemptLogin = !!capturedFaceUri && !!capturedFaceDescriptor && (!authLoading && users.length > 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label className="font-medium text-foreground text-center block">Log In with Your Face</Label>
        <p className="text-sm text-muted-foreground text-center">
          Your face will be matched against registered users.
        </p>
        <FaceCapture onFaceCaptured={handleFaceCaptured} captureButtonText="Capture Face for Login" />
        {capturedFaceUri && capturedFaceDescriptor && <p className="text-xs text-green-600 text-center flex items-center justify-center gap-1"><UserCheck size={14}/> Face & features captured!</p>}
        {capturedFaceUri && !capturedFaceDescriptor && <p className="text-xs text-amber-600 text-center">Face captured, but features unclear. Retake.</p>}
        
        {!authLoading && users.length === 0 && !isLoggingIn && (
           <p className="text-xs text-amber-600 text-center pt-2">No users registered. Please sign up.</p>
        )}
      </div>

      <Button type="submit" disabled={isLoggingIn || !canAttemptLogin} className="w-full">
        {isLoggingIn ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="mr-2 h-4 w-4" />
        )}
        {isLoggingIn ? 'Verifying...' : 'Log In with Face'}
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

