
"use client";

import { useState, useEffect } from 'react';
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
        toast({title: "Problema al Procesar Rostro", description: "No se pudieron calcular los rasgos faciales de la imagen capturada. Intenta de nuevo con una vista más clara de tu rostro.", variant: "default", duration: 7000});
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!authLoading && users.length === 0) {
      toast({ title: "Inicio de Sesión No Posible", description: "No hay usuarios registrados en el sistema. Por favor, regístrate primero.", variant: "destructive" });
      return;
    }
    if (!capturedFaceUri) {
      toast({ title: "Se Requiere Captura de Rostro", description: "Por favor, captura tu rostro para iniciar sesión.", variant: "destructive" });
      return;
    }
    if (!capturedFaceDescriptor) {
      toast({ title: "Se Requieren Rasgos Faciales", description: "Los rasgos faciales no pudieron ser procesados. Por favor, captura tu rostro de nuevo con claridad.", variant: "destructive" });
      return;
    }

    setIsLoggingIn(true);
    try {
      const success = await loginWithFace(capturedFaceUri, capturedFaceDescriptor);
      if (success) {
        toast({ title: "Inicio de Sesión Exitoso", description: "¡Bienvenido de nuevo!" });
        router.push('/dashboard');
      } else {
        // Specific failure toasts are handled within loginWithFace
        setCapturedFaceUri(null); 
        setCapturedFaceDescriptor(null);
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({ title: "Error de Inicio de Sesión", description: "Ocurrió un error inesperado. Por favor, inténtalo de nuevo.", variant: "destructive" });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const canAttemptLogin = !!capturedFaceUri && !!capturedFaceDescriptor && !authLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label className="font-medium text-foreground text-center block">Inicia Sesión con Tu Rostro</Label>
        <p className="text-sm text-muted-foreground text-center">
          Tu rostro se comparará con los usuarios registrados.
        </p>
        <FaceCapture onFaceCaptured={handleFaceCaptured} captureButtonText="Capturar Rostro para Iniciar Sesión" />
        {capturedFaceUri && capturedFaceDescriptor && <p className="text-xs text-green-600 text-center flex items-center justify-center gap-1"><UserCheck size={14}/> ¡Rostro y rasgos capturados!</p>}
        {capturedFaceUri && !capturedFaceDescriptor && <p className="text-xs text-amber-600 text-center">Rostro capturado, pero rasgos no claros. Intenta de nuevo.</p>}
        
        {!authLoading && users.length === 0 && !isLoggingIn && (
           <p className="text-xs text-amber-600 text-center pt-2">No hay usuarios registrados. Por favor, regístrate.</p>
        )}
      </div>

      <Button type="submit" disabled={isLoggingIn || !canAttemptLogin || (users.length === 0 && !authLoading)} className="w-full">
        {isLoggingIn ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="mr-2 h-4 w-4" />
        )}
        {isLoggingIn ? 'Verificando...' : 'Iniciar Sesión con Rostro'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes una cuenta?{' '}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Regístrate
        </Link>
      </p>
    </form>
  );
}
