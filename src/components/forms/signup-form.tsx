
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
import { Loader2, UserPlus } from 'lucide-react';

export default function SignupForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [capturedFaceUri, setCapturedFaceUri] = useState<string | null>(null);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const { signup } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleFaceCaptured = (dataUrl: string, descriptor: number[] | null) => {
    setCapturedFaceUri(dataUrl);
    setFaceDescriptor(descriptor);
    if (descriptor) {
      toast({ title: "Face Captured", description: "Your face image and descriptor have been processed." });
    } else {
      toast({ title: "Face Captured (No Descriptor)", description: "Face image captured, but descriptor could not be computed. Try again with a clearer image for better recognition.", variant: "default", duration: 7000 });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      toast({ title: "Missing Information", description: "Please fill in your name and email.", variant: "destructive" });
      return;
    }
    if (!capturedFaceUri) {
      toast({ title: "Face Capture Required", description: "Please capture your face for registration.", variant: "destructive" });
      return;
    }
    if (!faceDescriptor) {
      toast({ title: "Descriptor Missing", description: "Facial descriptor not available. Please recapture your face clearly.", variant: "destructive" });
      return;
    }

    setIsSigningUp(true);
    try {
      const success = await signup(name, email, capturedFaceUri, faceDescriptor);

      if (success) {
        toast({ title: "Signup Successful", description: "Your account has been created. Welcome!" });
        router.push('/dashboard');
      } else {
        // Signup failure toasts are handled within the auth context's signup method
      }
    } catch (error) {
      console.error("Signup error:", error);
      toast({ title: "Signup Error", description: "An unexpected error occurred. Please try again.", variant: "destructive" });
    } finally {
      setIsSigningUp(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="name" className="font-medium text-foreground">Full Name</Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John Doe"
          required
          className="mt-1"
        />
      </div>
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
        <Label className="font-medium text-foreground">Register Your Face</Label>
        <p className="text-sm text-muted-foreground">
          This image will be used for logging in. Ensure good lighting and a clear view of your face.
        </p>
        <FaceCapture onFaceCaptured={handleFaceCaptured} captureButtonText="Capture Face & Get Descriptor" />
        {capturedFaceUri && faceDescriptor && <p className="text-xs text-green-600 text-center">Face and descriptor captured successfully!</p>}
        {capturedFaceUri && !faceDescriptor && <p className="text-xs text-amber-600 text-center">Face captured, but descriptor failed. Try retaking.</p>}
      </div>

      <Button type="submit" disabled={isSigningUp || !capturedFaceUri || !faceDescriptor} className="w-full">
        {isSigningUp ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="mr-2 h-4 w-4" />
        )}
        {isSigningUp ? 'Creating Account...' : 'Create Account'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
